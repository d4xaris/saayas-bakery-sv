import type { Story } from "./types"

export type Entry = {
  kind: "title" | "label" | "line" | "message" | "chatwindow" | "subtitle"
  speaker: string
  text: string
  /** Japanese original, only for entries that have a translation */
  original?: string
}

const clean = (s: string) => s.replace(/<[^>]+>/g, "")
const num = (k?: string) => {
  if (k === undefined || k === "") return null
  const n = Number(k)
  return Number.isFinite(n) ? n : null
}

/** Something that goes between the dialogue lines at the place of its command index. */
type Extra = { key: number; entries: Entry[] }

/**
 * Title first, then dialogues in the order of the game's rows, with location cards, phone messages
 * (with their chat names) and subtitles placed by their command index.
 */
export function buildEntries(story: Story): Entry[] {
  const out: Entry[] = []

  const t = story.episodeTitle
  const title = clean(t?.translated?.trim() || t?.original?.trim() || "")
  if (title) out.push({ kind: "title", speaker: "", text: title })

  const extras: Extra[] = []

  for (const l of story.labels ?? []) {
    const text = clean(l.translated?.trim() || l.original?.trim() || "")
    if (text) extras.push({ key: num(l.key) ?? Infinity, entries: [{ kind: "label", speaker: "", text }] })
  }

  // Phone messages. A typing preview that a later message starts with is skipped (covered).
  const chatNames = story.chatNames ?? {}
  let prevWindow: string | null = null
  const chats = [...(story.chats ?? [])]
    .filter((c) => c.kind === "message" || !c.covered)
    .sort((a, b) => (num(a.key) ?? Infinity) - (num(b.key) ?? Infinity))
  for (const c of chats) {
    const text = clean(c.translated?.trim() || c.original?.trim() || "")
    if (!text) continue
    const entries: Entry[] = []
    if (c.windowId !== prevWindow) {
      prevWindow = c.windowId
      // A window without a real name only has its id as the name: no heading then.
      const windowTitle = clean(chatNames[`w:${c.windowName}`]?.trim() || c.windowName || "")
      if (windowTitle && c.windowName !== c.windowId) {
        entries.push({ kind: "chatwindow", speaker: "", text: windowTitle })
      }
    }
    entries.push({
      kind: "message",
      speaker: clean(chatNames[`s:${c.sender}`]?.trim() || c.sender || ""),
      text,
      original: c.translated?.trim() && c.original ? clean(c.original) : undefined,
    })
    extras.push({ key: num(c.key) ?? Infinity, entries })
  }

  for (const s of story.subtitles ?? []) {
    const text = clean(s.translated?.trim() || s.original?.trim() || "")
    if (!text) continue
    extras.push({
      key: num(s.key) ?? Infinity,
      entries: [
        {
          kind: "subtitle",
          speaker: clean(story.names[s.speaker]?.trim() || ""),
          text,
          original: s.translated?.trim() && s.original ? clean(s.original) : undefined,
        },
      ],
    })
  }

  extras.sort((a, b) => a.key - b.key) // stable: equal keys keep their order

  let ei = 0
  const flushBefore = (key: number | null) => {
    if (key === null) return
    while (ei < extras.length && extras[ei].key < key) out.push(...extras[ei++].entries)
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
  while (ei < extras.length) out.push(...extras[ei++].entries)
  return out
}