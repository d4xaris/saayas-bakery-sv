import { SIDE, sideToX } from "@/lib/bestdori/viewerSpec"
import { W, type Ctx } from "./types"

/** Bestdori x: 0 = stage centre, +-1 = stage edge. Pixi x in pixels. */
export const stageX = (x: number) => (W / 2) * (1 + x)
export const sidePos = (side: unknown, offset: unknown) =>
  stageX(sideToX(SIDE[Number(side)] ?? "center", Number(offset) || 0))

let warnedFade = false
/**
 * Bestdori's setAlpha: the opacity of every mesh inside the Live2D (Cubism 2) core model.
 * Container alpha does nothing for Cubism 2 models, so the fade has to go through the core.
 */
export function applyFade(core: any, alpha: number) {
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

/** Runs the jobs `size` at a time. */
export async function pool(jobs: Array<() => Promise<void>>, size: number) {
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(size, jobs.length) }, async () => {
      while (i < jobs.length) {
        const job = jobs[i++]
        await job()
      }
    }),
  )
}

export const modelOf = (ctx: Ctx, id: number) => {
  const c = ctx.charCostume.get(id)
  return c ? ctx.models.get(c) : undefined
}

export const restOf = (ctx: Ctx, m: any) => ctx.restX.get(m) ?? stageX(0)

export const setFade = (ctx: Ctx, m: any, a: number) => {
  ctx.fades.set(m, a)
  try {
    applyFade(m.internalModel.coreModel, a)
  } catch {
    /* ignore */
  }
}

const warnedAnim = new Set<string>()
const noteFailed = (kind: string, name: string) => {
  const key = `${kind}:${name}`
  if (warnedAnim.has(key)) return
  warnedAnim.add(key)
  console.warn(`[bandori-player] ${kind} "${name}" did not play (not in the model settings, or it failed to load)`)
}

export const applyMotion = (m: any, motion?: string, expression?: string) => {
  const setExpression = () => {
    if (!expression) return
    void Promise.resolve(m.expression(expression))
      .then((ok: unknown) => {
        if (ok === false) noteFailed("expression", expression)
      })
      .catch(() => noteFailed("expression", expression))
  }
  if (!motion) {
    setExpression()
    return
  }
  // The expression is set AFTER the motion has started, so starting the motion cannot wipe it.
  void Promise.resolve(m.motion(motion, 0, 3))
    .then((ok: unknown) => {
      if (ok === false) noteFailed("motion", motion)
    })
    .catch(() => noteFailed("motion", motion))
    .then(setExpression)
}