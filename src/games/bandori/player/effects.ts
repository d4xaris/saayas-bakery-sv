import { AUTO_INTERVALS_MS, TELOP_FADE_MS, type TelopState } from "@/games/bandori/bestdori/viewerSpec"
import type { Step } from "@/games/bandori/bestdori/timeline"
import { hideFrame, setBackground, showFrame } from "./visuals"
import type { Ctx } from "./types"

/** Bestdori's telop wait: ends on a click, or in auto mode after the auto-play interval. */
export const waitClickOrAuto = (ctx: Ctx) =>
  new Promise<void>((resolve) => {
    const { clock } = ctx
    const startedAt = clock.now()
    let finished = false
    const check = () => {
      if (ctx.token.dead) {
        done()
        return true
      }
      if (ctx.isAuto() && clock.now() >= startedAt + AUTO_INTERVALS_MS[1]) {
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
      resolve()
    }
    ctx.advance.fn = done
    clock.addFrame(check)
  })

export const doEffect = async (ctx: Ctx, step: Step) => {
  const { overlay, app, clock, ui, b } = ctx
  const e = step.ref
  const dur = Number(e.duration) || 0.5
  switch (e.effectType) {
    case 1:
    case 3: // blackIn / whiteIn: starts covered, fades away
      overlay.tint = e.effectType === 1 ? 0x000000 : 0xffffff
      overlay.alpha = 1
      await clock.tween(dur, (t) => (overlay.alpha = 1 - t))
      break
    case 2:
    case 4: // blackOut / whiteOut: starts clear, fades to cover
      overlay.tint = e.effectType === 2 ? 0x000000 : 0xffffff
      overlay.alpha = 0
      await clock.tween(dur, (t) => (overlay.alpha = t))
      break
    case 5:
    case 6:
      await clock.tween(0.5, (t) => (app.stage.x = Math.sin(t * 40) * (1 - t) * 12))
      app.stage.x = 0
      break
    case 7: // changeBackground
    case 11: // changeCardStill (same drawing: 110% of the stage width)
    case 17: // changeBackgroundStill
      await setBackground(ctx, String(e.stringVal ?? ""), String(e.stringValSub ?? ""))
      break
    case 8: { // telop (location card): fade in 0.5 s, wait (click, or auto interval), fade out 0.5 s
      const key = `${b.scenarioId}:fx${step.refIndex}`
      const lab = ctx.getStory().labels?.find((l) => l.key === key)
      const text = lab?.translated || lab?.reference || lab?.original || String(e.stringVal ?? "")
      const show = (state: TelopState, progress: number) => ui.setTelop({ text, state, progress })
      ui.setDialog(null)
      await clock.tween(TELOP_FADE_MS / 1000, (t) => show("fadeIn", t))
      show("wait", 0)
      await waitClickOrAuto(ctx)
      await clock.tween(TELOP_FADE_MS / 1000, (t) => show("fadeOut", t))
      ui.setTelop(null)
      ctx.audio.openGate() // the first location card is done: now the music may start
      break
    }
    case 15: // UNVERIFIED: effect frame on
      await showFrame(ctx, String(e.stringValSub ?? ""))
      break
    case 16: // UNVERIFIED: effect frame off
      await hideFrame(ctx)
      break
  }
}