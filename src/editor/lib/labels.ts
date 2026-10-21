import { SITE } from "@/games/ournotes/lib/importGame"
import type { Story, StoryLabel } from "./types"

async function fetchJson(asset: string) {
  const r = await fetch(`${SITE}/${asset}`)
  if (!r.ok) throw new Error(`${r.status} ${asset}`)
  const raw = new Uint8Array(await r.arrayBuffer())
  const bytes =
    raw[0] === 0x1f && raw[1] === 0x8b
      ? new Uint8Array(await new Response(new Blob([raw as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer())
      : raw
  return JSON.parse(new TextDecoder().decode(bytes))
}

/** Location cards and the episode title, in order of appearance. */
export async function importLabels(advId: number): Promise<Pick<Story, "labels" | "episodeTitle">> {
  const m = await (await fetch(`${SITE}/stories/${advId}.json`)).json()
  const asset = m.files?.["episode.json"]?.asset as string | undefined
  if (!asset) throw new Error("No episode.json in manifest")
  const ep = await fetchJson(asset)

  const labels: StoryLabel[] = (ep.commands as any[])
    .filter((c) => c.cmd === "Location" && c.lines)
    .map((c) => ({
      key: String(c.i),
      textId: c.AdvTextID ?? "",
      original: c.lines.japanese ?? "",
      reference: c.lines.english ?? "",
      translated: "",
    }))

  const episodeTitle = ep.title
    ? { original: ep.title.japanese ?? "", reference: ep.title.english ?? "", translated: "" }
    : undefined

  return { labels, episodeTitle }
}

/** Keep existing translations when labels are loaded again. */
export function mergeLabels(
  old: Pick<Story, "labels" | "episodeTitle">,
  fresh: Pick<Story, "labels" | "episodeTitle">,
): Pick<Story, "labels" | "episodeTitle"> {
  const prev = new Map((old.labels ?? []).map((l) => [l.key, l.translated]))
  return {
    labels: (fresh.labels ?? []).map((l) => ({ ...l, translated: prev.get(l.key) ?? "" })),
    episodeTitle: fresh.episodeTitle && {
      ...fresh.episodeTitle,
      translated: old.episodeTitle?.translated ?? "",
    },
  }
}