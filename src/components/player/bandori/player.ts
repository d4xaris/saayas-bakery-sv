import { bgmUrl } from "@/lib/bestdori/playerAssets"
import type { Scenario, Step } from "@/lib/bestdori/timeline"
import { doEffect } from "./effects"
import { doLayout } from "./layout"
import { doSound, doTalk } from "./talk"
import type { Ctx } from "./types"

const execute = (ctx: Ctx, step: Step): Promise<void> => {
  switch (step.kind) {
    case "talk": return doTalk(ctx, step)
    case "layout": return doLayout(ctx, step.ref)
    case "effect": return doEffect(ctx, step)
    case "sound": return doSound(ctx, step)
    default: return Promise.resolve()
  }
}

// Bestdori's rule: a "waitFinished" step first waits until everything already running has finished.
// A "now" step starts immediately, alongside the others (after its own delay).
export const play = async (ctx: Ctx, scenario: Scenario) => {
  const { token, clock, overlay, ui, audio } = ctx
  ui.setPhase("playing")

  // If a location card comes before the first line, the music waits until that card is finished.
  const firstTelop = scenario.steps.findIndex((s) => s.kind === "effect" && Number(s.ref.effectType) === 8)
  const firstTalk = scenario.steps.findIndex((s) => s.kind === "talk")
  audio.setGate(!(firstTelop >= 0 && (firstTalk < 0 || firstTelop < firstTalk)))
  if (scenario.firstBgm) audio.playBgm(bgmUrl(scenario.firstBgm))

  overlay.tint = 0x000000
  overlay.alpha = 1
  void clock.tween(0.6, (t) => (overlay.alpha = 1 - t)) // fade in from black

  const running = new Set<Promise<void>>()
  for (const step of scenario.steps) {
    if (token.dead) return
    if (step.block) await Promise.all([...running])
    if (token.dead) return
    const p = (async () => {
      if (step.delay) await clock.sleep(step.delay)
      if (token.dead) return
      await execute(ctx, step).catch((e) => console.warn("[bandori-player] step failed", step.kind, e))
    })()
    running.add(p)
    void p.finally(() => running.delete(p))
  }
  await Promise.all([...running])
  if (token.dead) return
  ui.setDialog(null)
  overlay.tint = 0x000000
  await clock.tween(0.8, (t) => (overlay.alpha = t)) // fade out to black
  if (!token.dead) ui.setPhase("ended")
}