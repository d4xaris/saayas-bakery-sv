import { Live2DModel } from "pixi-live2d-display/cubism2"
import { buildModelSettings, fetchDefaultMotion } from "@/lib/bestdori/live2d"
import { mouthOpen } from "@/lib/bestdori/viewerSpec"
import { applyFade, stageX } from "./helpers"
import { H, type Ctx } from "./types"

/** Loads one costume's Live2D model and hooks it up the way Bestdori's viewer drives it. */
export async function setupModel(ctx: Ctx, costume: string) {
  const m: any = await Live2DModel.from((await buildModelSettings(costume)) as any, { autoInteract: false })
  if (ctx.token.dead) {
    m.destroy()
    return
  }
  // Bestdori: scale 1.25 and y -0.12 in its matrix = model height 1.25 x stage height, top 6.5% above the stage.
  m.scale.set((1.25 * H) / m.height)
  m.anchor.set(0.5, 0)
  m.x = stageX(0)
  m.y = -0.065 * H
  m.visible = false

  // ---- Switch off the library's own blink / sway and do it Bestdori's way ----
  const im = m.internalModel
  const mm = im.motionManager

  // The library resets the face when a motion starts (cubism2.es.js, before _startMotion), which makes
  // the eyebrows jump to the default and back. Bestdori keeps the current expression, so do the same.
  const em = mm.expressionManager
  if (em) em.resetExpression = () => {}

  // 1. The library's own eye blink is removed.
  im.eyeBlink = undefined
  // 2. Whether a motion was playing in the last frame (same flag the library and Bestdori use to decide on blinking).
  let motionPlaying = false
  const motionUpdate = mm.update.bind(mm)
  mm.update = (core: unknown, now: number) => {
    motionPlaying = Boolean(motionUpdate(core, now))
    return motionPlaying
  }
  // 3. Breathing always; blinking only while no motion plays, multiplied into the eye value.
  im.updateNaturalMovements = (_dt: number, now: number) => {
    const core = im.coreModel
    try {
      core.setParamFloat("PARAM_BREATH", 0.5 + 0.5 * Math.sin(((now / 1000) * 2 * Math.PI) / 3.2345), 1)
      if (!motionPlaying) {
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
    const fade = ctx.fades.get(m)
    if (fade !== undefined) applyFade(core, fade)
    const a = ctx.audio.mouth.get(m)
    if (!a || a.paused || a.ended) return
    try {
      core.setParamFloat("PARAM_MOUTH_OPEN_Y", mouthOpen(a.currentTime))
    } catch {
      /* ignore */
    }
  })
  ctx.charLayer.addChild(m)
  ctx.models.set(costume, m)

  // Bestdori's defaultMotion for this costume (played when the character appears).
  const dm = await fetchDefaultMotion(costume)
  if (ctx.token.dead) return
  if (dm) ctx.defaultMotions.set(m, dm)
}