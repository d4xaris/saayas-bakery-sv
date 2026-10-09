import { bgmUrl, seUrl, voiceUrl } from "@/lib/bestdori/playerAssets"
import { TEXT_CHARS_PER_SECOND } from "@/lib/bestdori/viewerSpec"
import type { Step } from "@/lib/bestdori/timeline"
import { plainRichText } from "@/lib/story/rich-text"
import { applyMotion, modelOf } from "./helpers"
import type { Ctx } from "./types"

/** Auto mode: how long to wait after the text has finished typing (and its voice has ended) before the next line. */
const AUTO_AFTER_TEXT_MS = 1200

export const doSound = async (ctx: Ctx, step: Step) => {
  const { audio } = ctx
  const e = step.ref
  if (e.bgm) audio.playBgm(bgmUrl(String(e.bgm)))
  if (e.se && e.seBundleName) {
    const a = new Audio(audio.src(seUrl(String(e.seBundleName), String(e.se))))
    audio.setVol(a, Math.min(1, audio.volumes.Se * (Number(e.volume) || 1)))
    audio.sfx.push(a)
    void a.play().catch(() => {})
  }
}

export const doTalk = async (ctx: Ctx, step: Step) => {
  const { audio, clock, ui, b } = ctx
  audio.openGate() // safety: the music never waits past the first line
  const t = step.ref
  const s = ctx.getStory()
  const key = `${b.scenarioId}:${step.lineIndex}`
  const line = s.lines.find((l) => l.id === key || l.key === key)
  const jp = String(t.windowDisplayName ?? "")
  const names = (s.names ?? {}) as unknown as Record<string, string>
  const refs = (s.speakerRef ?? {}) as unknown as Record<string, string>
  const name = names[jp] || refs[jp] || jp
  const text = plainRichText(line?.translated || line?.reference || line?.original || String(t.body ?? ""))
  ctx.talk.no++
  ui.setLine(ctx.talk.no, ctx.talk.total)
  ui.setTelop(null)
  ui.setDialog({ name, text })
  audio.stopVoices()

  // Bestdori plays each motion timingSyncValue seconds after the line starts.
  for (const m of t.motions ?? []) {
    const run = () => {
      const mod = modelOf(ctx, Number(m.characterId))
      if (mod) applyMotion(mod, m.motionName, m.expressionName)
    }
    const at = Number(m.timingSyncValue) || 0
    if (at > 0) void clock.sleep(at).then(() => !ctx.token.dead && run())
    else run()
  }

  // Voices: plain Audio; the mouth follows the playback time (see the model hook).
  const voiceDone: Promise<void>[] = []
  for (const v of t.voices ?? []) {
    const url = voiceUrl(b.scenarioId, String(v.voiceId ?? ""))
    if (!url) continue
    const a = new Audio(audio.src(url))
    audio.setVol(a, Math.min(1, audio.volumes.Voice * (Number(v.volume) || 1)))
    audio.voices.push(a)
    const mod = modelOf(ctx, Number(v.characterId))
    if (mod) audio.mouth.set(mod, a)
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
      if (ctx.token.dead) {
        done()
        return true
      }
      if (ctx.isAuto() && clock.now() >= readyAt + AUTO_AFTER_TEXT_MS) {
        done()
        return true
      }
      return false
    }
    const done = () => {
      if (finished) return
      finished = true
      clock.removeFrame(check)
      if (ctx.advance.fn === done) ctx.advance.fn = null
      audio.stopVoices()
      resolve()
    }
    ctx.advance.fn = done
    clock.addFrame(check)
    void Promise.all([clock.sleep(typingSec), ...voiceDone]).then(() => {
      readyAt = clock.now()
    })
  })

  // Bestdori: a line flagged whenFinishCloseWindow closes the text window when it ends.
  if (t.whenFinishCloseWindow) ui.setDialog(null)
}