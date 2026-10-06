export type StepKind = "wait" | "talk" | "layout" | "effect" | "sound"

export interface Step {
  kind: StepKind
  ref: any
  refIndex: number
  delay: number
  /** progressType 1: wait for the step before going on (UNVERIFIED meaning). */
  block: boolean
  /** For talk steps: the index in the Story's line ids (scenarioId:index). */
  lineIndex?: number
}

export interface Scenario {
  steps: Step[]
  firstBgm: string
  firstBackground: { bundle: string; name: string } | null
  costumes: string[]
}

/**
 * snippets actionType: 0 wait, 1 talk (talkData), 2 and 4 layout (layoutData, together = all entries on 319-01),
 * 6 effect (specialEffectData), 7 sound (soundData). Others (3, 5) are ignored.
 */
export function buildScenario(raw: any): Scenario {
  const base = raw?.Base ?? raw
  const arr = (v: any): any[] => (Array.isArray(v) ? v : [])
  const talk = arr(base?.talkData)
  const layout = arr(base?.layoutData)
  const fx = arr(base?.specialEffectData)
  const sound = arr(base?.soundData)
  const snippets = arr(base?.snippets)

  // Same rule as parseScenario, so line ids match.
  const byOrder = snippets.filter((s) => s?.actionType === 1).length === talk.length
  const steps: Step[] = []
  let k = 0
  for (const s of snippets) {
    const delay = Number(s?.delay) || 0
    const block = s?.progressType === 1
    const i = Number(s?.referenceIndex)
    switch (s?.actionType) {
      case 0:
        steps.push({ kind: "wait", ref: null, refIndex: i, delay, block })
        break
      case 1:
        if (talk[i]) steps.push({ kind: "talk", ref: talk[i], refIndex: i, delay, block, lineIndex: byOrder ? k : i })
        k++
        break
      case 2:
      case 4:
        if (layout[i]) steps.push({ kind: "layout", ref: layout[i], refIndex: i, delay, block })
        break
      case 6:
        if (fx[i]) steps.push({ kind: "effect", ref: fx[i], refIndex: i, delay, block })
        break
      case 7:
        if (sound[i]) steps.push({ kind: "sound", ref: sound[i], refIndex: i, delay, block })
        break
    }
  }

  const costumes = [...new Set(layout.map((l) => String(l?.costumeType ?? "")).filter(Boolean))]
  const bundle = String(base?.firstBackgroundBundleName ?? "")
  const name = String(base?.firstBackground ?? "")
  return {
    steps,
    firstBgm: String(base?.firstBgm ?? ""),
    firstBackground: bundle && name ? { bundle, name } : null,
    costumes,
  }
}