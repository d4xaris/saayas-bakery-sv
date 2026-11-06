import type { Story } from "@/editor/lib/types"

const stripTags = (s: string) => s.replace(/<[^>]*>/g, "")

export default function SubtitlesCard({
  story,
  patch,
}: {
  story: Story
  patch: (fn: (s: Story) => Story) => void
}) {
  const subtitles = story.subtitles ?? []
  if (subtitles.length === 0) return null

  const done = subtitles.filter((c) => c.translated.trim()).length
  const setSubtitle = (key: string, translated: string) =>
    patch((s) => ({
      ...s,
      subtitles: (s.subtitles ?? []).map((c) => (c.key === key ? { ...c, translated } : c)),
    }))

  return (
    <div className="card space-y-3">
      <h2 className="font-semibold">
        Subtitles ({done}/{subtitles.length})
      </h2>
      {subtitles.map((c) => (
        <div key={c.key} className="space-y-1">
          <div className="space-y-0.5 text-sm leading-snug">
            {c.speaker && <p className="text-xs opacity-50">{c.speaker}</p>}
            <p className="whitespace-pre-wrap">{stripTags(c.original)}</p>
            {c.reference && <p className="whitespace-pre-wrap opacity-60">{stripTags(c.reference)}</p>}
          </div>
          <textarea
            className="input"
            rows={2}
            placeholder="Translation"
            value={c.translated}
            onChange={(e) => setSubtitle(c.key, e.target.value)}
          />
        </div>
      ))}
    </div>
  )
}