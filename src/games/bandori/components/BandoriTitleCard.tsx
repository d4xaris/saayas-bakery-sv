import type { Story } from "@/editor/lib/types"

export default function BandoriTitleCard(props: {
  story: Story
  patch: (fn: (s: Story) => Story) => void
}) {
  const labels = props.story.labels ?? []
  if (labels.length === 0) return null

  const setLabel = (key: string, translated: string) =>
    props.patch((s) => ({
      ...s,
      labels: (s.labels ?? []).map((l) => (l.key === key ? { ...l, translated } : l)),
    }))

  return (
    <div className="card space-y-2">
      <h2 className="font-semibold">Labels ({labels.length})</h2>
      {labels.map((l) => (
        <div key={l.key} className={`card space-y-1 ${l.translated.trim() ? "card-done" : ""}`}>
          <p className="text-sm">{l.original}</p>
          {l.reference && <p className="text-sm opacity-60">{l.reference}</p>}
          <input
            className="input"
            placeholder="Translation"
            value={l.translated}
            onChange={(e) => setLabel(l.key, e.target.value)}
          />
        </div>
      ))}
    </div>
  )
}