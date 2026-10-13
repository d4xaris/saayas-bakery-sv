import type { Story, StoryLine } from "./types"

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
  /** "event" for event chapters, otherwise the group kind of stories.json (chapter, liveResult, friendship, ...). */
  kind: string
  chapterId: number
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

export async function listGameStories(): Promise<GameStoryEntry[]> {
  // "no-cache" makes the browser ask the server whether its copy is still current, so a new event is never missed.
  const [index, events] = await Promise.all([
    fetchJson<any>(`${SITE}/stories.json`, { cache: "no-cache" }),
    loadEventChapters(),
  ])

  const entries = (index.stories ?? []).map((s: any): GameStoryEntry => {
    const g = s.groups?.[0]
    const chapterId: number = g?.chapter?.id ?? 0
    const isEvent = g?.kind === "chapter" && events.has(chapterId)
    return {
      advId: s.advId,
      title: s.titles?.en || s.titles?.ja || `ADV ${s.advId}`,
      chapter: g?.chapter?.names?.en || g?.chapter?.names?.ja || "",
      kind: isEvent ? "event" : (g?.kind ?? "other"),
      chapterId,
      episode: g?.episodeNumber ?? 0,
    }
  })

  // Events: newest first. Band story: in reading order. Everything else: by id. Episodes of a group stay in order.
  return entries.sort((a: GameStoryEntry, b: GameStoryEntry) => {
    const byKind = kindRank(a.kind) - kindRank(b.kind)
    if (byKind) return byKind
    if (a.kind === "event") return b.chapterId - a.chapterId || a.episode - b.episode || a.advId - b.advId
    if (a.kind === "chapter") return a.chapterId - b.chapterId || a.episode - b.episode || a.advId - b.advId
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