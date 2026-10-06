import * as PIXI from "pixi.js"
import { Live2DModel } from "pixi-live2d-display/cubism2"
import type { Story } from "@/lib/editor/types"
import { fetchScenario } from "@/lib/bestdori/api"
import { backgroundUrl, buildModelSettings } from "@/lib/bestdori/live2d"
import { buildScenario, type Scenario, type Step } from "@/lib/bestdori/timeline"
import { bgmUrl, effectFrameUrl, seUrl, voiceUrl } from "@/lib/bestdori/playerAssets"
import {
  APPEAR_MS,
  AUTO_INTERVALS_MS,
  HIDE_MS,
  MOVE_MS,
  SIDE,
  TELOP_FADE_MS,
  TEXT_CHARS_PER_SECOND,
  mouthOpen,
  sideToX,
  type TelopState,
} from "@/lib/bestdori/viewerSpec"
import { plainRichText } from "@/lib/story/rich-text"
import { loadStoryVolumes, storyPlayerVolumes } from "@/lib/story/player-settings"

;(window as any).PIXI = PIXI
Live2DModel.registerTicker(PIXI.Ticker as any)

// 16:9, the same screen shape as Bestdori's story viewer (its layout numbers depend on it).
export const W = 1280
export const H = 720

/** Auto mode: how long to wait after the text has finished typing (and its voice has ended) before the next line. */
const AUTO_AFTER_TEXT_MS = 1000

// Add ?bdDebug to the page URL to log every layout step to the console.
const DEBUG = new URLSearchParams(location.search).has("bdDebug")

export type Phase = "loading" | "ready" | "playing" | "ended" | "error"
export interface Dialog { name: string; text: string }
export interface Telop { text: string; state: TelopState; progress: number }

export interface EngineUi {
  setPhase(p: Phase): void
  setInfo(s: string): void
  setDialog(d: Dialog | null): void
  setTelop(t: Telop | null): void
  /** line: 0-based index of the current line (-1 before the start); total: number of lines */
  setLine(line: number, total: number): void
}

export interface EngineOptions {
  host: HTMLElement
  getStory: () => Story
  ui: EngineUi
  isAuto: () => boolean
}

export interface Engine {
  start(): void
  advance(): void
  pause(): void
  resume(): void
  isPaused(): boolean
  /** master volume 0..1 for music, effects and voice */
  setVolume(level: number): void
  dispose(): void
}

/** Bestdori x: 0 = stage centre, +-1 = stage edge. Pixi x in pixels. */
const stageX = (x: number) => (W / 2) * (1 + x)
const sidePos = (side: unknown, offset: unknown) =>
  stageX(sideToX(SIDE[Number(side)] ?? "center", Number(offset) || 0))

let warnedFade = false
/**
 * Bestdori's setAlpha: the opacity of every mesh inside the Live2D (Cubism 2) core model.
 * Container alpha does nothing for Cubism 2 models, so the fade has to go through the core.
 */
function applyFade(core: any, alpha: number) {
  const list = core?._$5S?._$Hr
  if (!list || typeof list.forEach !== "function") {
    if (!warnedFade) {
      warnedFade = true
      console.warn("[bandori-player] cannot fade: core model has no _$5S._$Hr (other live2d.min.js build?)")
    }
    return
  }
  list.forEach((d: any) => {
    if (d) d._$VS = alpha
  })
}

export function createBandoriEngine(opts: EngineOptions): Engine {
  const { host, getStory, ui, isAuto } = opts
  const b = getStory().bandori!
  const token = { dead: false }
  const volumes = storyPlayerVolumes(loadStoryVolumes())
  let startFn: (() => void) | null = null
  let advanceFn: (() => void) | null = null
  let started = false
  let totalTalks = 0
  let talkNo = -1

  const app = new PIXI.Application({ width: W, height: H, backgroundColor: 0x000000 })
  const canvas = app.view as HTMLCanvasElement
  canvas.style.cssText = "width:100%;height:100%;display:block"
  host.appendChild(canvas)
  const bgLayer = new PIXI.Container()
  const charLayer = new PIXI.Container()
  const bg = new PIXI.Sprite()
  bgLayer.addChild(bg)
  const frameSprite = new PIXI.Sprite()
  frameSprite.width = W
  frameSprite.height = H
  frameSprite.visible = false
  const overlay = new PIXI.Graphics()
  overlay.beginFill(0xffffff).drawRect(0, 0, W, H).endFill()
  overlay.tint = 0x000000
  overlay.alpha = 1 // starts black, fades in on Play
  app.stage.addChild(bgLayer, charLayer, frameSprite, overlay)

  const models = new Map<string, any>() // costume -> model
  const charCostume = new Map<number, string>() // characterId -> current costume
  const mouthAudio = new Map<any, HTMLAudioElement>() // model -> the voice it is speaking
  const fades = new Map<any, number>() // model -> current mesh opacity (Bestdori's setAlpha)
  const restX = new Map<any, number>() // model -> the x it rests at (Bestdori's side + sideOffset)
  let bgm: HTMLAudioElement | null = null
  const voices: HTMLAudioElement[] = []
  const sfx: HTMLAudioElement[] = []

  const setFade = (m: any, a: number) => {
    fades.set(m, a)
    try {
      applyFade(m.internalModel.coreModel, a)
    } catch {
      /* ignore */
    }
  }
  const restOf = (m: any) => restX.get(m) ?? stageX(0)

  // ---- audio volume: each sound has its own base volume, multiplied by one master level ----
  let master = 1
  const baseVol = new WeakMap<HTMLAudioElement, number>()
  const setVol = (a: HTMLAudioElement, base: number) => {
    baseVol.set(a, base)
    a.volume = Math.min(1, Math.max(0, base * master))
  }
  const allAudio = () => [bgm, ...voices, ...sfx].filter(Boolean) as HTMLAudioElement[]

  // ---- one clock for everything: it stands still while paused ----
  let clock = 0 // ms of playing time
  let paused = false
  let last = performance.now()
  const waiters: { at: number; fn: () => void }[] = []
  const frames = new Set<() => boolean>() // return true when finished

  const pump = () => {
    const now = performance.now()
    if (!paused) clock += Math.min(100, now - last)
    last = now
    for (const f of [...frames]) if (f()) frames.delete(f)
    const due = waiters.filter((w) => token.dead || w.at <= clock)
    if (due.length) {
      const rest = waiters.filter((w) => !due.includes(w))
      waiters.splice(0, waiters.length, ...rest)
      due.forEach((w) => w.fn())
    }
  }
  const loop = () => {
    if (token.dead) return
    pump()
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)

  const sleep = (sec: number) =>
    new Promise<void>((resolve) => {
      waiters.push({ at: clock + sec * 1000, fn: resolve })
    })
  const tween = (sec: number, fn: (t: number) => void) =>
    new Promise<void>((resolve) => {
      const start = clock
      const ms = Math.max(1, sec * 1000)
      const step = () => {
        if (token.dead) {
          resolve()
          return true
        }
        const t = Math.min(1, (clock - start) / ms)
        fn(t)
        if (t >= 1) {
          resolve()
          return true
        }
        return false
      }
      if (!step()) frames.add(step)
    })
  /** Bestdori's telop wait: ends on a click, or in auto mode after the auto-play interval. */
  const waitClickOrAuto = () =>
    new Promise<void>((resolve) => {
      const startedAt = clock
      let finished = false
      const check = () => {
        if (token.dead) {
          done()
          return true
        }
        if (isAuto() && clock >= startedAt + AUTO_INTERVALS_MS[1]) {
          done()
          return true
        }
        return false
      }
      const done = () => {
        if (finished) return
        finished = true
        frames.delete(check)
        if (advanceFn === done) advanceFn = null
        resolve()
      }
      advanceFn = done
      frames.add(check)
    })

  const modelOf = (id: number) => {
    const c = charCostume.get(id)
    return c ? models.get(c) : undefined
  }
  const applyMotion = (m: any, motion?: string, expression?: string) => {
    if (motion) void Promise.resolve(m.motion(motion, 0, 3)).catch(() => {})
    if (expression) void Promise.resolve(m.expression(expression)).catch(() => {})
  }
  const stopVoices = () => {
    voices.splice(0).forEach((a) => a.pause())
    mouthAudio.clear()
  }
  const playBgm = (url: string) => {
    bgm?.pause()
    bgm = new Audio(url)
    bgm.loop = true
    setVol(bgm, volumes.Bgm)
    if (!paused) void bgm.play().catch(() => {})
  }
  const setBackground = async (bundle: string, name: string) => {
    if (!bundle || !name) return
    try {
      const tex = await PIXI.Texture.fromURL(backgroundUrl(bundle, name))
      if (token.dead) return
      bg.texture = tex
      bg.anchor.set(0.5)
      // Bestdori: 110% of the stage width, centred, cropped by the stage.
      bg.scale.set((1.1 * W) / tex.width)
      bg.position.set(W / 2, H / 2)
    } catch (e) {
      console.warn("[bandori-player] background failed", bundle, name, e)
    }
  }
  const showFrame = async (sub: string) => {
    const url = effectFrameUrl(sub)
    if (!url) return
    try {
      const tex = await PIXI.Texture.fromURL(url)
      if (token.dead) return
      frameSprite.texture = tex
      frameSprite.width = W
      frameSprite.height = H
      frameSprite.alpha = 0
      frameSprite.visible = true
      await tween(0.3, (t) => (frameSprite.alpha = t))
    } catch (e) {
      console.warn("[bandori-player] effect frame failed", sub, e)
    }
  }
  const hideFrame = async () => {
    if (!frameSprite.visible) return
    await tween(0.3, (t) => (frameSprite.alpha = 1 - t))
    frameSprite.visible = false
  }

  // layoutData.type: 0 none (motion/expression only), 1 move, 2 appear, 3 hide (Bestdori enum).
  // Ported from Bestdori's onPlayingUpdate: appear 250 ms, move 250 ms, hide 200 ms.
  const doLayout = async (e: any) => {
    const id = Number(e.characterId)
    if (DEBUG) {
      console.log(
        "[layout]", "type", e.type, "char", id, e.costumeType,
        "from", e.sideFrom, e.sideFromOffsetX, "to", e.sideTo, e.sideToOffsetX,
        e.motionName, e.expressionName,
      )
    }
    switch (e.type) {
      case 2: { // appear: visible, opacity 0 -> 1 while sliding from sideFrom to sideTo
        const costume = e.costumeType || charCostume.get(id)
        if (!costume) return
        const prev = charCostume.get(id)
        if (prev && prev !== costume) {
          const old = models.get(prev)
          if (old) old.visible = false
        }
        charCostume.set(id, costume)
        const m = models.get(costume)
        if (!m) return
        const to = sidePos(e.sideTo, e.sideToOffsetX)
        const from = Number(e.sideFrom) ? sidePos(e.sideFrom, e.sideFromOffsetX) : restX.has(m) ? restOf(m) : to
        m.x = from
        m.visible = true
        setFade(m, 0)
        charLayer.setChildIndex(m, 0) // Bestdori draws a newly appearing character behind the others
        applyMotion(m, e.motionName, e.expressionName)
        await tween(APPEAR_MS / 1000, (t) => {
          setFade(m, t)
          m.x = from + (to - from) * t
        })
        setFade(m, 1)
        m.x = to
        restX.set(m, to)
        return
      }
      case 3: { // hide: opacity 1 -> 0, then invisible
        const m = modelOf(id)
        if (!m) return
        applyMotion(m, e.motionName, e.expressionName)
        const from = Number(e.sideFrom) ? sidePos(e.sideFrom, e.sideFromOffsetX) : restOf(m)
        const to = sidePos(e.sideTo, e.sideToOffsetX)
        await tween(HIDE_MS / 1000, (t) => {
          setFade(m, 1 - t)
          m.x = from + (to - from) * t
        })
        m.visible = false
        m.x = restOf(m)
        return
      }
      case 1: { // move
        const m = modelOf(id)
        if (!m) return
        applyMotion(m, e.motionName, e.expressionName)
        const from = Number(e.sideFrom) ? sidePos(e.sideFrom, e.sideFromOffsetX) : restOf(m)
        const to = sidePos(e.sideTo, e.sideToOffsetX)
        await tween(MOVE_MS / 1000, (t) => (m.x = from + (to - from) * t))
        m.x = to
        restX.set(m, to)
        return
      }
      case 0: { // motion / expression only
        const m = modelOf(id)
        if (m) applyMotion(m, e.motionName, e.expressionName)
      }
    }
  }

  const doEffect = async (step: Step) => {
    const e = step.ref
    const dur = Number(e.duration) || 0.5
    switch (e.effectType) {
      case 1:
      case 3: // blackIn / whiteIn: starts covered, fades away
        overlay.tint = e.effectType === 1 ? 0x000000 : 0xffffff
        overlay.alpha = 1
        await tween(dur, (t) => (overlay.alpha = 1 - t))
        break
      case 2:
      case 4: // blackOut / whiteOut: starts clear, fades to cover
        overlay.tint = e.effectType === 2 ? 0x000000 : 0xffffff
        overlay.alpha = 0
        await tween(dur, (t) => (overlay.alpha = t))
        break
      case 5:
      case 6:
        await tween(0.5, (t) => (app.stage.x = Math.sin(t * 40) * (1 - t) * 12))
        app.stage.x = 0
        break
      case 7:
        await setBackground(String(e.stringVal ?? ""), String(e.stringValSub ?? ""))
        break
      case 8: { // telop (location card): fade in 0.5 s, wait (click, or auto interval), fade out 0.5 s
        const key = `${b.scenarioId}:fx${step.refIndex}`
        const lab = getStory().labels?.find((l) => l.key === key)
        const text = lab?.translated || lab?.reference || lab?.original || String(e.stringVal ?? "")
        const show = (state: TelopState, progress: number) => ui.setTelop({ text, state, progress })
        ui.setDialog(null)
        await tween(TELOP_FADE_MS / 1000, (t) => show("fadeIn", t))
        show("wait", 0)
        await waitClickOrAuto()
        await tween(TELOP_FADE_MS / 1000, (t) => show("fadeOut", t))
        ui.setTelop(null)
        break
      }
      case 15: // UNVERIFIED: effect frame on
        await showFrame(String(e.stringValSub ?? ""))
        break
      case 16: // UNVERIFIED: effect frame off
        await hideFrame()
        break
    }
  }

  const doSound = async (step: Step) => {
    const e = step.ref
    if (e.bgm) playBgm(bgmUrl(String(e.bgm)))
    if (e.se && e.seBundleName) {
      const a = new Audio(seUrl(String(e.seBundleName), String(e.se)))
      setVol(a, Math.min(1, volumes.Se * (Number(e.volume) || 1)))
      sfx.push(a)
      void a.play().catch(() => {})
    }
  }

  const doTalk = async (step: Step) => {
    const t = step.ref
    const s = getStory()
    const key = `${b.scenarioId}:${step.lineIndex}`
    const line = s.lines.find((l) => l.id === key || l.key === key)
    const jp = String(t.windowDisplayName ?? "")
    const names = (s.names ?? {}) as unknown as Record<string, string>
    const refs = (s.speakerRef ?? {}) as unknown as Record<string, string>
    const name = names[jp] || refs[jp] || jp
    const text = plainRichText(line?.translated || line?.reference || line?.original || String(t.body ?? ""))
    talkNo++
    ui.setLine(talkNo, totalTalks)
    ui.setTelop(null)
    ui.setDialog({ name, text })
    stopVoices()

    // Bestdori plays each motion timingSyncValue seconds after the line starts.
    for (const m of t.motions ?? []) {
      const run = () => {
        const mod = modelOf(Number(m.characterId))
        if (mod) applyMotion(mod, m.motionName, m.expressionName)
      }
      const at = Number(m.timingSyncValue) || 0
      if (at > 0) void sleep(at).then(() => !token.dead && run())
      else run()
    }

    // Voices: plain Audio; the mouth follows the playback time (see the model hook).
    const voiceDone: Promise<void>[] = []
    for (const v of t.voices ?? []) {
      const url = voiceUrl(b.scenarioId, String(v.voiceId ?? ""))
      if (!url) continue
      const a = new Audio(url)
      setVol(a, Math.min(1, volumes.Voice * (Number(v.volume) || 1)))
      voices.push(a)
      const mod = modelOf(Number(v.characterId))
      if (mod) mouthAudio.set(mod, a)
      voiceDone.push(
        new Promise<void>((resolve) => {
          a.addEventListener("ended", () => resolve())
          a.addEventListener("error", () => resolve())
          a.play().catch(() => resolve())
        }),
      )
    }

    // Wait for a click, or in auto mode: typing and voice finished + AUTO_AFTER_TEXT_MS.
    const typingSec = Array.from(text).length / TEXT_CHARS_PER_SECOND
    await new Promise<void>((resolve) => {
      let readyAt = Infinity
      let finished = false
      const check = () => {
        if (token.dead) {
          done()
          return true
        }
        if (isAuto() && clock >= readyAt + AUTO_AFTER_TEXT_MS) {
          done()
          return true
        }
        return false
      }
      const done = () => {
        if (finished) return
        finished = true
        frames.delete(check)
        if (advanceFn === done) advanceFn = null
        stopVoices()
        resolve()
      }
      advanceFn = done
      frames.add(check)
      void Promise.all([sleep(typingSec), ...voiceDone]).then(() => {
        readyAt = clock
      })
    })

    // Bestdori: a line flagged whenFinishCloseWindow closes the text window when it ends.
    if (t.whenFinishCloseWindow) ui.setDialog(null)
  }

  const execute = (step: Step): Promise<void> => {
    switch (step.kind) {
      case "talk": return doTalk(step)
      case "layout": return doLayout(step.ref)
      case "effect": return doEffect(step)
      case "sound": return doSound(step)
      default: return Promise.resolve()
    }
  }

  // Bestdori's rule: a "waitFinished" step first waits until everything already running has finished.
  // A "now" step starts immediately, alongside the others (after its own delay).
  const play = async (scenario: Scenario) => {
    ui.setPhase("playing")
    if (scenario.firstBgm) playBgm(bgmUrl(scenario.firstBgm))
    overlay.tint = 0x000000
    overlay.alpha = 1
    void tween(0.6, (t) => (overlay.alpha = 1 - t)) // fade in from black

    const running = new Set<Promise<void>>()
    for (const step of scenario.steps) {
      if (token.dead) return
      if (step.block) await Promise.all([...running])
      if (token.dead) return
      const p = (async () => {
        if (step.delay) await sleep(step.delay)
        if (token.dead) return
        await execute(step).catch((e) => console.warn("[bandori-player] step failed", step.kind, e))
      })()
      running.add(p)
      void p.finally(() => running.delete(p))
    }
    await Promise.all([...running])
    if (token.dead) return
    ui.setDialog(null)
    overlay.tint = 0x000000
    await tween(0.8, (t) => (overlay.alpha = t)) // fade out to black
    if (!token.dead) ui.setPhase("ended")
  }

  ;(async () => {
    try {
      const raw = await fetchScenario(b.server, b.folder, b.scenarioId)
      if (token.dead) return
      const scenario = buildScenario(raw)
      totalTalks = scenario.steps.filter((s) => s.kind === "talk").length
      ui.setLine(-1, totalTalks)
      if (scenario.firstBackground) await setBackground(scenario.firstBackground.bundle, scenario.firstBackground.name)
      const failed: string[] = []
      let n = 0
      for (const costume of scenario.costumes) {
        ui.setInfo(`Loading models ${n}/${scenario.costumes.length}…`)
        try {
          const m: any = await Live2DModel.from((await buildModelSettings(costume)) as any, { autoInteract: false })
          if (token.dead) {
            m.destroy()
            return
          }
          // Bestdori: scale 1.25 and y -0.12 in its matrix = model height 1.25 x stage height, top 6.5% above the stage.
          m.scale.set((1.25 * H) / m.height)
          m.anchor.set(0.5, 0)
          m.x = stageX(0)
          m.y = -0.065 * H
          m.visible = false

          // ---- Switch off the library's own idle / blink / sway and do it Bestdori's way ----
          const im = m.internalModel
          const mm = im.motionManager
          // 1. The library starts a random "idle" motion by itself whenever nothing else plays
          //    (cubism2.es.js lines 634-635). Bestdori has nothing like it. Only the idle call
          //    (priority 1) is blocked; story motions go through startMotion and are not touched.
          //    UNVERIFIED: that this is what moves the heads.
          const startRandom = mm.startRandomMotion.bind(mm)
          mm.startRandomMotion = (group: string, priority?: number) =>
            priority === 1 ? Promise.resolve(false) : startRandom(group, priority)
          // 2. The library's eye blink updates every frame (cubism2.es.js line 1858, optional call,
          //    so removing it is safe). UNVERIFIED: that it overwrites the expressions' eye values.
          im.eyeBlink = undefined
          // 3. Bestdori's version: breathing always; blinking only while no motion plays, and
          //    multiplied into the eye value (so an expression with closed eyes stays closed).
          im.updateNaturalMovements = (_dt: number, now: number) => {
            const core = im.coreModel
            try {
              core.setParamFloat("PARAM_BREATH", 0.5 + 0.5 * Math.sin(((now / 1000) * 2 * Math.PI) / 3.2345), 1)
              if (mm.state?.currentGroup === undefined) {
                const t = now % 4300
                const v = t < 100 ? (100 - t) / 100 : t < 150 ? 0 : t < 300 ? (t - 150) / 150 : 1
                core.multParamFloat("PARAM_EYE_L_OPEN", v, 1)
                core.multParamFloat("PARAM_EYE_R_OPEN", v, 1)
              }
            } catch {
              /* ignore */
            }
          }

          // Every frame, before the model updates: keep the fade, and drive the mouth while its voice plays.
          m.internalModel.on("beforeModelUpdate", () => {
            const core = m.internalModel.coreModel
            const fade = fades.get(m)
            if (fade !== undefined) applyFade(core, fade)
            const a = mouthAudio.get(m)
            if (!a || a.paused || a.ended) return
            try {
              core.setParamFloat("PARAM_MOUTH_OPEN_Y", mouthOpen(a.currentTime))
            } catch {
              /* ignore */
            }
          })
          charLayer.addChild(m)
          models.set(costume, m)
        } catch (e) {
          failed.push(costume)
          console.warn("[bandori-player] model failed", costume, e)
        }
        n++
      }
      startFn = () => {
        if (started) return
        started = true
        void play(scenario)
      }
      ui.setInfo(failed.length ? `Models not loaded: ${failed.join(", ")}` : "")
      ui.setPhase("ready")
    } catch (e) {
      if (token.dead) return
      ui.setInfo(e instanceof Error ? e.message : String(e))
      ui.setPhase("error")
    }
  })()

  const setModelsUpdating = (on: boolean) => {
    for (const m of models.values()) {
      try {
        m.autoUpdate = on // UNVERIFIED: freezes the Live2D motion while paused
      } catch {
        /* ignore */
      }
    }
  }

  return {
    start: () => startFn?.(),
    advance: () => {
      if (!paused) advanceFn?.()
    },
    pause: () => {
      if (paused) return
      paused = true
      setModelsUpdating(false)
      allAudio().forEach((a) => a.pause())
    },
    resume: () => {
      if (!paused) return
      paused = false
      setModelsUpdating(true)
      allAudio().forEach((a) => {
        if (!a.ended) void a.play().catch(() => {})
      })
    },
    isPaused: () => paused,
    setVolume: (level: number) => {
      master = Math.min(1, Math.max(0, level))
      for (const a of allAudio()) setVol(a, baseVol.get(a) ?? 1)
    },
    dispose: () => {
      token.dead = true
      pump() // lets every waiting tween and timer finish
      advanceFn?.()
      startFn = null
      bgm?.pause()
      sfx.splice(0).forEach((a) => a.pause())
      stopVoices()
      app.destroy(true, { children: true })
    },
  }
}