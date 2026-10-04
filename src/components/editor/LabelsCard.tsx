import { useState } from "react"
import { importLabels, mergeLabels } from "@/lib/editor/labels"
import type { Story } from "@/lib/editor/types"

const stripTags = (s: string) => s.replace(/<[^>]*>/g, "")

export default function LabelsCard({ story, patch }: { story: Story; patch: (fn: (s: Story) => Story) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const advId = story.source?.advId
  if (!advId) return null

  const load = async () => {
    setBusy(true)
    setError("")
    try {
      const fresh = await importLabels(advId)
      patch((s) => ({ ...s, ...mergeLabels(s, fresh) }))
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  const t = story.episodeTitle
  const labels = story.labels ?? []

  return (
    <div className="card space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Title and labels</h2>
        <button className="btn" onClick={load} disabled={busy}>{t || labels.length ? "Reload" : "Load"}</button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}

      {t && (
        <div className={`space-y-1 rounded border p-2 ${t.translated.trim() ? "card-done" : "border-white/10"}`}>
          <p className="text-xs opacity-60">Title</p>
          <p className="text-sm leading-snug">{stripTags(t.original)}</p>
          <p className="text-sm leading-snug opacity-60">{stripTags(t.reference)}</p>
          <input className="input" placeholder="Translation" value={t.translated}
            onChange={(e) => patch((s) => ({ ...s, episodeTitle: { ...s.episodeTitle!, translated: e.target.value } }))} />
        </div>
      )}

      {labels.map((l) => (
        <div key={l.key} className={`space-y-1 rounded border p-2 ${l.translated.trim() ? "card-done" : "border-white/10"}`}>
          <p className="text-xs opacity-60">Location card</p>
          <p className="text-sm leading-snug">{stripTags(l.original)}</p>
          <p className="text-sm leading-snug opacity-60">{stripTags(l.reference)}</p>
          <input className="input" placeholder="Translation" value={l.translated}
            onChange={(e) =>
              patch((s) => ({ ...s, labels: (s.labels ?? []).map((x) => (x.key === l.key ? { ...x, translated: e.target.value } : x)) }))
            } />
        </div>
      ))}
    </div>
  )
}