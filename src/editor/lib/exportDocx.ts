import { Document, Packer, Paragraph, TextRun } from "docx"
import type { Story } from "./types"
import { buildEntries } from "./exportEntries"

type Options = {
  /** Add the original Japanese line in grey under the translation. */
  withOriginal?: boolean
  /** Make speaker names bold. */
  boldSpeakers?: boolean
}

export async function exportStoryDocx(story: Story, opts: Options = {}) {
  const { withOriginal = false, boldSpeakers = false } = opts
  const children: Paragraph[] = []

  for (const e of buildEntries(story)) {
    // Speaker name (or the sender of a phone message)
    if (e.speaker) {
      children.push(new Paragraph({ children: [new TextRun({ text: e.speaker, bold: boldSpeakers })] }))
    }

    // Text (keeps line breaks inside one entry).
    // Title and chat window names are bold; location cards and subtitles are italic.
    e.text.split("\n").forEach((part) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: part,
              bold: e.kind === "title" || e.kind === "chatwindow",
              italics: e.kind === "label" || e.kind === "subtitle",
            }),
          ],
        }),
      )
    })

    // Optional original, grey
    if (withOriginal && e.original) {
      e.original.split("\n").forEach((part) => {
        children.push(new Paragraph({ children: [new TextRun({ text: part, color: "888888" })] }))
      })
    }

    // Empty line between entries
    children.push(new Paragraph({ children: [] }))
  }

  const doc = new Document({ sections: [{ children }] })

  const blob = await Packer.toBlob(doc)
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `${(story.title || "story").replace(/[\\/:*?"<>|]/g, "_")}.docx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}