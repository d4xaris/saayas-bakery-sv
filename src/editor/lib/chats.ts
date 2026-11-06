import { SITE } from "@/games/ournotes/lib/importGame"
import type { StoryChat, StorySubtitle } from "./types"

type LangRow = { japanese?: string; english?: string }

async function fetchJson(asset: string) {
  const r = await fetch(`${SITE}/${asset}`)
  if (!r.ok) throw new Error(`${r.status} ${asset}`)
  const raw = new Uint8Array(await r.arrayBuffer())
  const bytes =
    raw[0] === 0x1f && raw[1] === 0x8b
      ? new Uint8Array(
          await new Response(
            new Blob([raw as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip")),
          ).arrayBuffer(),
        )
      : raw
  return JSON.parse(new TextDecoder().decode(bytes))
}

/**
 * Everything besides Talk and Location that carries text, from one episode.json:
 * phone messages (ChatTalk), typing previews (ChatTyping) and on-screen subtitles (Subtitles).
 * An episode without them returns empty lists.
 * UNVERIFIED: sender and window names are looked up in ep.text by id; if missing, the id is shown.
 */
export async function importExtras(
  advId: number,
): Promise<{ chats: StoryChat[]; subtitles: StorySubtitle[] }> {
  const m = await (await fetch(`${SITE}/stories/${advId}.json`)).json()
  const asset = m.files?.["episode.json"]?.asset as string | undefined
  if (!asset) throw new Error("No episode.json in manifest")
  const ep = await fetchJson(asset)

  const text = (ep.text ?? {}) as Record<string, LangRow>
  const jp = (id: string) => text[id]?.japanese?.trim() || ""
  const en = (id: string) => text[id]?.english?.trim() || ""

  const chats: StoryChat[] = []
  const subtitles: StorySubtitle[] = []
  let windowId = ""

  for (const c of ep.commands as any[]) {
    if (c.cmd === "ChatWindow") {
      windowId = c.TargetTextIDs?.[0] ?? c.TargetName ?? ""
      continue
    }
    // A Subtitles command without lines clears the subtitle; only the ones with text are imported.
    if (c.cmd === "Subtitles" && c.lines?.japanese) {
      subtitles.push({
        key: String(c.i),
        textId: c.AdvTextID ?? "",
        speaker: c.TargetName ?? "",
        original: c.lines.japanese ?? "",
        reference: c.lines.english ?? "",
        translated: "",
      })
      continue
    }
    if ((c.cmd === "ChatTalk" || c.cmd === "ChatTyping") && c.lines) {
      const senderId: string = c.TargetTextIDs?.[0] ?? c.TargetName ?? ""
      chats.push({
        key: String(c.i),
        textId: c.AdvTextID ?? "",
        kind: c.cmd === "ChatTyping" ? "typing" : "message",
        windowId,
        windowName: jp(windowId) || windowId,
        windowNameReference: en(windowId),
        sender: jp(senderId) || senderId,
        senderReference: en(senderId),
        original: c.lines.japanese ?? "",
        reference: c.lines.english ?? "",
        translated: "",
      })
    }
  }

  // UNVERIFIED guess: a typing preview is the start of a later message in the same window.
  chats.forEach((c, i) => {
    if (c.kind !== "typing") return
    const head = c.original.trim()
    c.covered =
      head.length > 0 &&
      chats.slice(i + 1).some((n) => n.kind === "message" && n.windowId === c.windowId && n.original.startsWith(head))
  })

  return { chats, subtitles }
}