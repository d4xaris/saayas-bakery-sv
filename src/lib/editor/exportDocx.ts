import { Document, Packer, Paragraph, TextRun } from "docx";
import type { Story } from "./types";

const clean = (s: string) => s.replace(/<[^>]+>/g, "");

type Options = {
  /** Add the original Japanese line in grey under the translation. */
  withOriginal?: boolean;
  /** Make speaker names bold. */
  boldSpeakers?: boolean;
};

export async function exportStoryDocx(story: Story, opts: Options = {}) {
  const { withOriginal = false, boldSpeakers = false } = opts;
  const children: Paragraph[] = [];

  story.lines.forEach((l) => {
    const speaker = clean(story.names[l.speaker]?.trim() || l.speaker || "");
    const text = clean(l.translated?.trim() || l.original || "");

    // Speaker name
    if (speaker) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: speaker, bold: boldSpeakers })],
        }),
      );
    }

    // Dialogue text (keeps line breaks inside one dialogue)
    text.split("\n").forEach((part) => {
      children.push(new Paragraph({ children: [new TextRun(part)] }));
    });

    // Optional original, grey
    if (withOriginal && l.translated?.trim() && l.original) {
      clean(l.original).split("\n").forEach((part) => {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: part, color: "888888" })],
          }),
        );
      });
    }

    // Empty line between dialogues
    children.push(new Paragraph({ children: [] }));
  });

  const doc = new Document({
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${(story.title || "story").replace(/[\\/:*?"<>|]/g, "_")}.docx`;
  a.click();
  URL.revokeObjectURL(a.href);
}