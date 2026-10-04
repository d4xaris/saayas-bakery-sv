import type { Story } from "./types"

const clean = (s: string) => s.replace(/<[^>]+>/g, "")

/** Speaker on one line, text under it, empty line between dialogues. */
export function buildScript(story: Story): string {
  const blocks: string[] = []
  for (const l of story.lines) {
    const text = clean(l.translated?.trim() || l.original?.trim() || "")
    if (!text) continue
    const name = clean(story.names[l.speaker]?.trim() || l.speaker || "")
    blocks.push(name ? `${name}\n${text}` : text)
  }
  return blocks.join("\n\n")
}

export function exportStoryTxt(story: Story) {
  const blob = new Blob([buildScript(story)], { type: "text/plain;charset=utf-8" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `${(story.title || "story").replace(/[\\/:*?"<>|]/g, "_")}.txt`
  a.click()
  URL.revokeObjectURL(a.href)
}