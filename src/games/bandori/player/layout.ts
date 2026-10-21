import { APPEAR_MS, HIDE_MS, MOVE_MS } from "@/games/bandori/bestdori/viewerSpec"
import { applyMotion, modelOf, restOf, setFade, sidePos } from "./helpers"
import type { Ctx } from "./types"

// Add ?bdDebug to the page URL to log every layout step to the console.
const DEBUG = new URLSearchParams(location.search).has("bdDebug")

// layoutData.type: 0 none (motion/expression only), 1 move, 2 appear, 3 hide (Bestdori enum).
// Ported from Bestdori's onPlayingUpdate: appear 250 ms, move 250 ms, hide 200 ms.
export const doLayout = async (ctx: Ctx, e: any) => {
  const { models, charCostume, defaultMotions, restX, charLayer, clock } = ctx
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
      const from = Number(e.sideFrom) ? sidePos(e.sideFrom, e.sideFromOffsetX) : restX.has(m) ? restOf(ctx, m) : to
      m.x = from
      m.visible = true
      setFade(ctx, m, 0)
      charLayer.setChildIndex(m, 0) // Bestdori draws a newly appearing character behind the others
      // Bestdori plays the default motion and then the step's motion in the same tick, so the step's
      // motion wins when there is one. Without one, the default motion plays.
      applyMotion(m, e.motionName || defaultMotions.get(m), e.expressionName)
      await clock.tween(APPEAR_MS / 1000, (t) => {
        setFade(ctx, m, t)
        m.x = from + (to - from) * t
      })
      setFade(ctx, m, 1)
      m.x = to
      restX.set(m, to)
      return
    }
    case 3: { // hide: opacity 1 -> 0, then invisible
      const m = modelOf(ctx, id)
      if (!m) return
      applyMotion(m, e.motionName, e.expressionName)
      const from = Number(e.sideFrom) ? sidePos(e.sideFrom, e.sideFromOffsetX) : restOf(ctx, m)
      const to = sidePos(e.sideTo, e.sideToOffsetX)
      await clock.tween(HIDE_MS / 1000, (t) => {
        setFade(ctx, m, 1 - t)
        m.x = from + (to - from) * t
      })
      m.visible = false
      m.x = restOf(ctx, m)
      return
    }
    case 1: { // move
      const m = modelOf(ctx, id)
      if (!m) return
      applyMotion(m, e.motionName, e.expressionName)
      const from = Number(e.sideFrom) ? sidePos(e.sideFrom, e.sideFromOffsetX) : restOf(ctx, m)
      const to = sidePos(e.sideTo, e.sideToOffsetX)
      await clock.tween(MOVE_MS / 1000, (t) => (m.x = from + (to - from) * t))
      m.x = to
      restX.set(m, to)
      return
    }
    case 0: { // motion / expression only
      const m = modelOf(ctx, id)
      if (m) applyMotion(m, e.motionName, e.expressionName)
    }
  }
}