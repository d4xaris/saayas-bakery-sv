import { storyPlayerFetch } from "@/games/ournotes/lib/player-client"
import { SITE } from "./importGame"
import { PLAYER_LANG } from "@/editor/lib/config"
import { addFallbackFont, buildUkFont, UK_ASSET, UK_MANIFEST_PATH } from "./ukFont"
import type { Story } from "@/editor/lib/types"

type Fetcher = typeof fetch

export async function getEpisodeAsset(advId: number): Promise<string> {
  const res = await fetch(`${SITE}/stories/${advId}.json`)
  if (!res.ok) throw new Error(`${res.status} manifest ${advId}`)
  const manifest = await res.json()
  const asset = manifest.files?.["episode.json"]?.asset as string | undefined
  if (!asset) throw new Error("No episode.json in manifest")
  return asset
}

const isGzip = (b: Uint8Array) => b[0] === 0x1f && b[1] === 0x8b

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(out).arrayBuffer())
}

async function shortHash(bytes: Uint8Array) {
  const d = await crypto.subtle.digest("SHA-256", bytes as BufferSource)
  return [...new Uint8Array(d)].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("")
}

function patchEpisode(ep: any, story: Story) {
  const text = (ep.text ??= {})
  const byKey = new Map(story.lines.filter((l) => l.key).map((l) => [l.key!, l]))

  // Location cards and the episode title
  const labelByKey = new Map((story.labels ?? []).map((l) => [l.key, l]))
  for (const c of ep.commands as any[]) {
    if (c.cmd !== "Location") continue
    const l = labelByKey.get(String(c.i))
    const t = l?.translated.trim()
    if (!l || !t) continue
    if (c.lines) c.lines.english = t
    if (c.AdvTextID && text[c.AdvTextID]) text[c.AdvTextID].english = t
  }
  const tt = story.episodeTitle?.translated.trim()
  if (tt && ep.title) ep.title.english = tt

  for (const c of ep.commands as any[]) {
    if (c.cmd !== "Talk") continue
    const line = byKey.get(String(c.i))
    if (!line) continue

    const t = line.translated.trim()
    if (t) {
      if (c.lines) c.lines.english = t
      if (c.AdvTextID && text[c.AdvTextID]) text[c.AdvTextID].english = t
    }

    const name = (story.names[line.speaker] ?? "").trim()
    const ids: string[] = c.TargetTextIDs ?? []
    if (name && ids.length) {
      const parts = ids.length === 1 ? [name] : name.split(" & ")
      if (parts.length === ids.length) {
        ids.forEach((id, k) => {
          if (text[id]) text[id].english = parts[k].trim()
        })
      }
    }
  }

  // ---- Phone messages, nicknames, chat names, subtitles ----

  /** Finds text-table entries that hold `original` in any non-"english" field and sets their `english`. */
  const setEnglishByOriginal = (original: string, translated: string) => {
    if (!original || !translated) return
    for (const entry of Object.values(text) as any[]) {
      if (!entry || typeof entry !== "object") continue
      for (const [k, v] of Object.entries(entry)) {
        if (k !== "english" && v === original) {
          entry.english = translated
          break
        }
      }
    }
  }

  const chatByKey = new Map((story.chats ?? []).map((c) => [c.key, c]))
  const subByKey = new Map((story.subtitles ?? []).map((s) => [s.key, s]))

  for (const c of ep.commands as any[]) {
    const isChat = c.cmd === "ChatTalk" || c.cmd === "ChatTyping"
    const item = isChat
      ? chatByKey.get(String(c.i))
      : c.cmd === "Subtitles"
        ? subByKey.get(String(c.i))
        : undefined
    if (!item) continue
    const t = item.translated.trim()
    if (!t) continue
    if (c.lines) c.lines.english = t
    if (c.AdvTextID && text[c.AdvTextID]) text[c.AdvTextID].english = t
  }

  // Nicknames ("s:" + sender) and chat window names ("w:" + window name)
  for (const [k, v] of Object.entries(story.chatNames ?? {})) {
    const value = v.trim()
    if (value) setEnglishByOriginal(k.slice(2), value)
  }

  // Chat window titles (the phone header). The title is expected in the text table (the ChatWindow command only holds an id),
  // under its original or its official English name, so every string equal to either one is replaced there.
  const refByWindow = new Map<string, string>()
  for (const c of story.chats ?? []) if (c.windowName) refByWindow.set(c.windowName, c.windowNameReference)
  const windowTr = new Map<string, string>()
  for (const [k, v] of Object.entries(story.chatNames ?? {})) {
    const value = v.trim()
    if (!k.startsWith("w:") || !value) continue
    const name = k.slice(2)
    if (!name.startsWith("advchat_")) windowTr.set(name, value) // never an id: ids are keys the player looks up
    const ref = refByWindow.get(name)
    if (ref && !ref.startsWith("advchat_")) windowTr.set(ref, value)
  }
  if (windowTr.size) {
    const walk = (node: any) => {
      if (!node || typeof node !== "object") return
      for (const k of Object.keys(node)) {
        const v = node[k]
        if (typeof v === "string") {
          const r = windowTr.get(v.trim())
          if (r !== undefined) {
            node[k] = r
          }
        } else walk(v)
      }
    }
    for (const entry of Object.values(text)) walk(entry)
  }

  return ep
}

const urlOf = (input: any): string =>
  typeof input === "string" ? input : input instanceof URL ? input.href : input.url

const json = (v: unknown) =>
  new Response(JSON.stringify(v), { status: 200, headers: { "Content-Type": "application/json" } })

/**
 * A fetch for the player that serves an edited episode.json and a ui/fonts.json with a
 * Cyrillic fallback font. Edited files get hashed names, so the player's URL cache
 * can never hand back an older edit. The manifest sizes are rewritten to match.
 */
export function makePatchedFetch(getStory: () => Story | null, _episodeAsset: string): Fetcher {
  const base = storyPlayerFetch as Fetcher
  const served = new Map<string, { bytes: Uint8Array; type: string }>()
  let ukPromise: ReturnType<typeof buildUkFont> | null = null

  async function readJson(asset: string) {
    const r = await base(`${SITE}/${asset}`)
    if (!r.ok) throw new Error(`${r.status} ${asset}`)
    const raw = new Uint8Array(await r.arrayBuffer())
    const gz = isGzip(raw)
    const bytes = gz ? await pipe(raw, new DecompressionStream("gzip")) : raw
    return { data: JSON.parse(new TextDecoder().decode(bytes)), gz }
  }

  async function encode(data: unknown, gz: boolean) {
    const raw = new TextEncoder().encode(JSON.stringify(data))
    return { rawLength: raw.length, bytes: gz ? await pipe(raw, new CompressionStream("gzip")) : raw }
  }

  /** Store the bytes under a hashed name and point the manifest entry at it. */
  async function serve(entry: any, prefix: string, bytes: Uint8Array, rawLength: number, gz: boolean) {
    const ext = gz ? ".json.gz" : ".json"
    const name = `${prefix}-${await shortHash(bytes)}${ext}`
    served.set(name, { bytes, type: "application/json" })
    entry.asset = `assets/${name}`
    entry.size = rawLength
    if (gz || "stored" in entry) entry.stored = bytes.length
  }

  return (async (input: any, init?: any) => {
    const url = urlOf(input)
    const story = getStory()
    if (!story) return base(input, init)

    if (/\/stories\/\d+\.json(\?|$)/.test(url)) {
      const res = await base(input, init)
      if (!res.ok) return res
      const manifest = await res.json()
      served.clear()

      const ee = manifest.files?.["episode.json"]
      if (ee) {
        const { data, gz } = await readJson(ee.asset)
        const out = await encode(patchEpisode(data, story), gz)
        await serve(ee, "edited-episode", out.bytes, out.rawLength, gz)
      }

      const group = manifest.languages?.[PLAYER_LANG]
      const fe = group?.files?.["ui/fonts.json"]
      if (fe) {
        const uk = await (ukPromise ??= buildUkFont())
        const { data, gz } = await readJson(fe.asset)
        addFallbackFont(data, uk)
        const out = await encode(data, gz)
        await serve(fe, "uk-fonts", out.bytes, out.rawLength, gz)
        served.set(UK_ASSET.split("/").pop()!, { bytes: uk.png, type: "image/png" })
        group.files[UK_MANIFEST_PATH] = { asset: UK_ASSET, size: uk.png.length }
      }

      return json(manifest)
    }

    for (const [name, f] of served) {
      if (url.includes(name)) {
        return new Response(f.bytes as BlobPart, { status: 200, headers: { "Content-Type": f.type } })
      }
    }
    return base(input, init)
  }) as Fetcher
}