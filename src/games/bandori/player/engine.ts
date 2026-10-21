import * as PIXI from "pixi.js"
import { Live2DModel } from "pixi-live2d-display/cubism2"
import { fetchCardScenario, fetchScenario } from "@/games/bandori/bestdori/api"
import { buildScenario } from "@/games/bandori/bestdori/timeline"
import { loadStoryVolumes, storyPlayerVolumes } from "@/shared/lib/player-settings"
import { createAudioBank } from "./audio"
import { createClock } from "./clock"
import { setupModel } from "./models"
import { play } from "./player"
import { preloadAll } from "./preload"
import { setBackground } from "./visuals"
import { H, W, type Ctx, type Engine, type EngineOptions } from "./types"

export { W, H } from "./types"
export type { Phase, Dialog, Telop, EngineUi, EngineOptions, Engine } from "./types"

;(window as any).PIXI = PIXI
Live2DModel.registerTicker(PIXI.Ticker as any)

export function createBandoriEngine(opts: EngineOptions): Engine {
  const { host, getStory, ui, isAuto } = opts
  const b = getStory().bandori!
  const token = { dead: false }
  let startFn: (() => void) | null = null
  let started = false

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

  const clock = createClock(token)
  const audio = createAudioBank(storyPlayerVolumes(loadStoryVolumes()), clock.isPaused)

  const ctx: Ctx = {
    token, b, getStory, ui, isAuto,
    app, bg, charLayer, frameSprite, overlay,
    models: new Map(),
    charCostume: new Map(),
    defaultMotions: new Map(),
    fades: new Map(),
    restX: new Map(),
    clock,
    audio,
    advance: { fn: null },
    talk: { no: -1, total: 0 },
  }

  ;(async () => {
    try {
      // Card stories live under the card's resource set, event stories under an event folder.
      const raw = b.card
        ? await fetchCardScenario(b.server, b.card.resourceSetName, b.scenarioId)
        : await fetchScenario(b.server, b.folder, b.scenarioId)
      if (token.dead) return
      const scenario = buildScenario(raw)
      ctx.talk.total = scenario.steps.filter((s) => s.kind === "talk").length
      ui.setLine(-1, ctx.talk.total)
      if (scenario.firstBackground) await setBackground(ctx, scenario.firstBackground.bundle, scenario.firstBackground.name)

      const failed: string[] = []
      let n = 0
      for (const costume of scenario.costumes) {
        ui.setInfo(`Loading models ${n}/${scenario.costumes.length}…`)
        try {
          await setupModel(ctx, costume)
        } catch (e) {
          failed.push(costume)
          console.warn("[bandori-player] model failed", costume, e)
        }
        if (token.dead) return
        n++
      }

      const { missing, failedFiles } = await preloadAll(ctx, scenario)
      if (token.dead) return

      startFn = () => {
        if (started) return
        started = true
        void play(ctx, scenario)
      }
      const notes: string[] = []
      if (failed.length) notes.push(`Models not loaded: ${failed.join(", ")}`)
      if (missing.length) notes.push(`${missing.length} animations not found (see console)`)
      if (failedFiles.length) notes.push(`${failedFiles.length} files not loaded (see console)`)
      ui.setInfo(notes.join(" · "))
      ui.setPhase("ready")
    } catch (e) {
      if (token.dead) return
      ui.setInfo(e instanceof Error ? e.message : String(e))
      ui.setPhase("error")
    }
  })()

  const setModelsUpdating = (on: boolean) => {
    for (const m of ctx.models.values()) {
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
      if (!clock.isPaused()) ctx.advance.fn?.()
    },
    pause: () => {
      if (clock.isPaused()) return
      clock.setPaused(true)
      setModelsUpdating(false)
      audio.pauseAll()
    },
    resume: () => {
      if (!clock.isPaused()) return
      clock.setPaused(false)
      setModelsUpdating(true)
      audio.resumeAll()
    },
    isPaused: () => clock.isPaused(),
    setVolume: (level: number) => audio.setMaster(level),
    dispose: () => {
      token.dead = true
      clock.pump() // lets every waiting tween and timer finish
      ctx.advance.fn?.()
      startFn = null
      audio.stopAll()
      app.destroy(true, { children: true })
    },
  }
}