import type { Story } from "./types"

export type Entry = {
  kind: "title" | "label" | "line"
  speaker: string
  text: string
  /** Japanese original, only for lines that have a translation */
  original?: string
}

const clean = (s: string) => s.replace(/<[^>]+>/g, "")
const num = (k?: string) => {
  if (k === undefined || k === "") return null
  const n = Number(k)
  return Number.isFinite(n) ? n : null
}

/** Title first, then location cards and dialogues in the order of the game's rows. */
export function buildEntries(story: Story): Entry[] {
  const out: Entry[] = []

  const t = story.episodeTitle
  const title = clean(t?.translated?.trim() || t?.original?.trim() || "")
  if (title) out.push({ kind: "title", speaker: "", text: title })

  const labels = (story.labels ?? [])
    .map((l) => ({ key: num(l.key), text: clean(l.translated?.trim() || l.original?.trim() || "") }))
    .filter((l) => l.text)
    .sort((a, b) => (a.key ?? Infinity) - (b.key ?? Infinity))
  let li = 0
  const flushBefore = (key: number | null) => {
    if (key === null) return
    while (li < labels.length && labels[li].key !== null && (labels[li].key as number) < key) {
      out.push({ kind: "label", speaker: "", text: labels[li].text })
      li++
    }
  }

  for (const l of story.lines) {
    flushBefore(num(l.key))
    const text = clean(l.translated?.trim() || l.original?.trim() || "")
    if (!text) continue
    out.push({
      kind: "line",
      speaker: clean(story.names[l.speaker]?.trim() || l.speaker || ""),
      text,
      original: l.translated?.trim() && l.original ? clean(l.original) : undefined,
    })
  }
  while (li < labels.length) {
    out.push({ kind: "label", speaker: "", text: labels[li].text })
    li++
  }
  return out
}