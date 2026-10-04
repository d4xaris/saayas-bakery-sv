import type { Story, StoryLine } from "./types"

const SITE: string =
  (import.meta.env.PUBLIC_STORY_SITE as string | undefined) ??
  "https://storage.bdon.moe/moenotes"

type LangRow = { japanese?: string; english?: string }

export type GameStoryEntry = {
  advId: number
  title: string
  chapter: string
  kind: string
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
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

export async function listGameStories(): Promise<GameStoryEntry[]> {
  const index = await fetchJson<any>(`${SITE}/stories.json`)
  return (index.stories ?? []).map((s: any): GameStoryEntry => {
    const g = s.groups?.[0]
    return {
      advId: s.advId,
      title: s.titles?.en || s.titles?.ja || `ADV ${s.advId}`,
      chapter: g?.chapter?.names?.en || g?.chapter?.names?.ja || "",
      kind: g?.kind ?? "other",
    }
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