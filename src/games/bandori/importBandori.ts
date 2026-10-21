import { fetchCardScenario, fetchScenario } from "@/games/bandori/bestdori/api"
import { parseLabels, parseScenario } from "@/games/bandori/bestdori/parse"
import type { BandoriSource, StoryLabel, StoryLine } from "@/editor/lib/types"

// Event stories live under scenario/eventstory/<folder>; card stories under characters/resourceset/<res>_rip.
const loadScenario = (source: BandoriSource, server: string) =>
  source.card
    ? fetchCardScenario(server, source.card.resourceSetName, source.scenarioId)
    : fetchScenario(server, source.folder, source.scenarioId)

export async function importBandoriStory(source: BandoriSource) {
  const raw = await loadScenario(source, source.server)
  const parsed = parseScenario(raw, source.scenarioId)
  if (parsed.length === 0) throw new Error("This chapter has no dialogue.")
  const parsedLabels = parseLabels(raw, source.scenarioId)

  // Official English, matched by position. Quietly skipped if unavailable.
  let english: string[] | null = null
  const speakerRef: Record<string, string> = {}
  let enLabels = new Map<number, string>()
  try {
    const rawEn = await loadScenario(source, "en")
    const en = parseScenario(rawEn, source.scenarioId)
    if (en.length === parsed.length) {
      english = en.map((l) => l.text)
      parsed.forEach((p, i) => {
        const name = en[i].speaker
        if (p.speaker && name && !(p.speaker in speakerRef)) speakerRef[p.speaker] = name
      })
    }
    enLabels = new Map(parseLabels(rawEn, source.scenarioId).map((l) => [l.index, l.text]))
  } catch {
    /* no English version */
  }

  const lines: StoryLine[] = parsed.map((p, i) => ({
    id: p.key, // stable: scenarioId:index
    key: p.key,
    speaker: p.speaker,
    original: p.text,
    reference: english?.[i] || undefined,
    translated: "",
    voice: p.voice,
  }))

  const labels: StoryLabel[] = parsedLabels.map((l) => ({
    key: l.key,
    textId: l.key,
    original: l.text,
    reference: enLabels.get(l.index) ?? "",
    translated: "",
  }))

  return { bandori: source, lines, labels, speakerRef, hasReference: !!english }
}