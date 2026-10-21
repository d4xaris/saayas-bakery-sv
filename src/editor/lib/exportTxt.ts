import type { Story } from "./types"
import { buildEntries } from "./exportEntries"

/** Speaker on one line, text under it, empty line between entries. Title and location cards are single lines. */
export function buildScript(story: Story): string {
  return buildEntries(story)
    .map((e) => (e.speaker ? `${e.speaker}\n${e.text}` : e.text))
    .join("\n\n")
}

export function exportStoryTxt(story: Story) {
  const blob = new Blob([buildScript(story)], { type: "text/plain;charset=utf-8" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `${(story.title || "story").replace(/[\\/:*?"<>|]/g, "_")}.txt`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}