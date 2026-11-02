import type { Story, StoryLine } from "@/editor/lib/types"

export const SITE: string =
  (import.meta.env.PUBLIC_STORY_SITE as string | undefined) ??
  "https://storage.bdon.moe/moenotes"

// Which story chapters are events is not in stories.json (main and event chapters are both kind "chapter"),
// so the ids come from the masterdata's MasterEvent table (`_storyChapterId`).
const EVENT_TABLE_URL =
  "https://raw.githubusercontent.com/StarMoe-org/moenotes-masterdata/main/en/MasterEvent.json"

type LangRow = { japanese?: string; english?: string }

export type GameStoryEntry = {
  advId: number
  title: string
  chapter: string
  chapterId: number | null
  /** "event" for event chapters, otherwise the group kind of stories.json (chapter, liveResult, friendship, ...). */
  kind: string
  episode: number
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  const buf = new Uint8Array(await res.arrayBuffer())
  // gzip magic bytes: the browser may or may not have decompressed already
  const bytes =
    buf[0] === 0x1f && buf[1] === 0x8b
      ? new Uint8Array(
          await new Response(
            new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip")),
          ).arrayBuffer(),
        )
      : buf
  return JSON.parse(new TextDecoder().decode(bytes)) as T
}

async function loadEventChapters(): Promise<Set<number>> {
  try {
    const data = await fetchJson<{ _allData?: Array<{ _storyChapterId?: number }> }>(EVENT_TABLE_URL)
    return new Set(
      (data._allData ?? [])
        .map((e) => e._storyChapterId)
        .filter((id): id is number => typeof id === "number" && id > 0),
    )
  } catch {
    return new Set() // without it, event chapters are simply listed as band story
  }
}

// Order of the kinds in the picker: events first, then the rest.
const KIND_ORDER = ["event", "chapter", "friendship", "liveResult", "spotTalk", "spot"]
const kindRank = (k: string) => {
  const i = KIND_ORDER.indexOf(k)
  return i === -1 ? KIND_ORDER.length : i
}

// Stories that exist on the server but are not in stories.json yet (the index lags behind).
// Once the index lists one, it is skipped here automatically. Delete the entry whenever you like.
const PENDING_STORIES = [
  { advId: 11200, title: "2026 Birthday: Yuno Sengoku (11/4)", chapterId: 33, episode: 3 },
]

export async function listGameStories(): Promise<GameStoryEntry[]> {
  // "no-cache" makes the browser ask the server whether its copy is still current, so a new event is never missed.
  const [index, events] = await Promise.all([
    fetchJson<any>(`${SITE}/stories.json`, { cache: "no-cache" }),
    loadEventChapters(),
  ])

  const entries: GameStoryEntry[] = (index.stories ?? []).map((s: any): GameStoryEntry => {
    const g = s.groups?.[0]
    const chapterId: number | null = typeof g?.chapter?.id === "number" ? g.chapter.id : null
    const isEvent = g?.kind === "chapter" && chapterId !== null && events.has(chapterId)
    return {
      advId: s.advId,
      title: s.titles?.en || s.titles?.ja || `ADV ${s.advId}`,
      chapter: g?.chapter?.names?.en || g?.chapter?.names?.ja || "",
      chapterId,
      kind: isEvent ? "event" : (g?.kind ?? "other"),
      episode: g?.episodeNumber ?? 0,
    }
  })

  // Add stories the index doesn't list yet, borrowing chapter name and kind from a sibling episode.
  const known = new Set(entries.map((e) => e.advId))
  for (const p of PENDING_STORIES) {
    if (known.has(p.advId)) continue
    const sibling = entries.find((e) => e.chapterId === p.chapterId)
    entries.push({
      advId: p.advId,
      title: p.title,
      chapter: sibling?.chapter ?? "",
      chapterId: p.chapterId,
      kind: sibling?.kind ?? "chapter",
      episode: p.episode,
    })
  }

  // Entries of one chapter sometimes spell its name differently (HAPPY BIRTHDAY vs Happy Birthday).
  // Use the first name seen for every episode of that chapter so they land in one group.
  const nameByChapter = new Map<number, string>()
  for (const e of entries) {
    if (e.chapterId !== null && e.chapter && !nameByChapter.has(e.chapterId)) {
      nameByChapter.set(e.chapterId, e.chapter)
    }
  }
  for (const e of entries) {
    if (e.chapterId !== null) e.chapter = nameByChapter.get(e.chapterId) ?? e.chapter
  }

  // Events: newest first. Band story: in reading order. Everything else: by id. Episodes of a group stay in order.
  return entries.sort((a, b) => {
    const byKind = kindRank(a.kind) - kindRank(b.kind)
    if (byKind) return byKind
    if (a.kind === "event")
      return (b.chapterId ?? 0) - (a.chapterId ?? 0) || a.episode - b.episode || a.advId - b.advId
    if (a.kind === "chapter")
      return (a.chapterId ?? 0) - (b.chapterId ?? 0) || a.episode - b.episode || a.advId - b.advId
    return a.advId - b.advId
  })
}

export async function importGameStory(
  advId: number,
): Promise<Pick<Story, "title" | "summary" | "source" | "language" | "names" | "lines">> {
  const manifest = await fetchJson<any>(`${SITE}/stories/${advId}.json`)
  const asset = manifest.files?.["episode.json"]?.asset as string | undefined
  if (!asset) throw new Error(`No episode.json in manifest for ${advId}`)
  const ep = await fetchJson<any>(`${SITE}/${asset}`)

  const text = (ep.text ?? {}) as Record<string, LangRow>
  const nameOf = (id: string) => text[id]?.japanese?.trim() || id
  const names: Record<string, string> = {}

  const lines: StoryLine[] = (ep.commands as any[])
    .filter((c) => c.cmd === "Talk" && c.lines?.japanese)
    .map((c): StoryLine => {
      const ids: string[] = c.TargetTextIDs ?? []
      const speaker = ids.map(nameOf).join("・")
      if (speaker && !(speaker in names)) {
        names[speaker] = ids
          .map((id) => text[id]?.english?.trim() || nameOf(id))
          .join(" & ")
      }
      return {
        id: crypto.randomUUID(),
        key: String(c.i),
        textId: c.AdvTextID,
        speaker,
        original: c.lines.japanese,
        reference: c.lines.english,
        translated: "",
      }
    })

  return {
    title: ep.title?.english ?? ep.asset ?? `ADV ${advId}`,
    summary: "",
    source: { advId },
    language: "en",
    names,
    lines,
  }
}