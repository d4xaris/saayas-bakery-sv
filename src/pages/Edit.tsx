import { useState } from "react"
import { useParams } from "react-router"
import { useStory } from "@/lib/editor/useStory"
import { importGameStory } from "@/lib/editor/importGame"
import type { Story, StoryLine } from "@/lib/editor/types"
import GameStoryPicker from "@/components/editor/GameStoryPicker"

const stripTags = (s: string) => s.replace(/<[^>]*>/g, "")

export default function Edit() {
  const { id = "" } = useParams()
  const { story, update } = useStory(id) as {
    story: Story | null | undefined
    update: (fn: (s: Story) => Story) => void
  }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [showPicker, setShowPicker] = useState(false)

  if (!story) return <p>Loading…</p>

  // If your update() takes a patch object instead of a function, change only this line.
  const patch = (fn: (s: Story) => Story) => update(fn)

  const imported = !!story.source
  const speakers = [...new Set(story.lines.map((l) => l.speaker).filter(Boolean))]

  const setLine = (lineId: string, changes: Partial<StoryLine>) =>
    patch((s) => ({
      ...s,
      lines: s.lines.map((l) => (l.id === lineId ? { ...l, ...changes } : l)),
    }))

  const newLine = (): StoryLine => ({
    id: crypto.randomUUID(),
    speaker: "",
    original: "",
    translated: "",
  })

  const insertAt = (index: number) =>
    patch((s) => {
      const lines = [...s.lines]
      lines.splice(index, 0, newLine())
      return { ...s, lines }
    })

  const move = (index: number, delta: number) =>
    patch((s) => {
      const to = index + delta
      if (to < 0 || to >= s.lines.length) return s
      const lines = [...s.lines]
      ;[lines[index], lines[to]] = [lines[to], lines[index]]
      return { ...s, lines }
    })

  const remove = (lineId: string) =>
    patch((s) => ({ ...s, lines: s.lines.filter((l) => l.id !== lineId) }))

  const doImport = async (advId: number) => {
    if (story.lines.some((l) => l.translated.trim()) && !window.confirm("This replaces the current lines and translations. Continue?")) {
      return
    }
    setBusy(true)
    setError("")
    try {
      const g = await importGameStory(advId)
      patch((s) => ({
        ...s,
        title: s.title.trim() ? s.title : g.title,
        source: g.source,
        language: g.language,
        names: g.names,
        lines: g.lines,
      }))
      setShowPicker(false)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <button className="btn" onClick={() => setShowPicker((v) => !v)}>
            {showPicker ? "Close story list" : "Import game story"}
          </button>
          {imported && <span className="opacity-60">Imported from ADV {story.source!.advId}</span>}
        </div>
        {error && <p className="text-red-400">{error}</p>}
        {showPicker && <GameStoryPicker busy={busy} onPick={doImport} />}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Speaker names</h2>
        {speakers.length === 0 && <p className="opacity-60">Speakers appear here once lines have speakers.</p>}
        {speakers.map((sp) => (
          <div key={sp} className="flex items-center gap-2">
            <span className="w-40 shrink-0">{sp}</span>
            <input
              className="input flex-1"
              value={story.names[sp] ?? ""}
              placeholder={sp}
              onChange={(e) => patch((s) => ({ ...s, names: { ...s.names, [sp]: e.target.value } }))}
            />
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Lines ({story.lines.length})</h2>

        {!imported && (
          <button className="btn" onClick={() => insertAt(0)}>
            Add line at top
          </button>
        )}

        {story.lines.map((line, i) => (
          <div key={line.id} className="space-y-2 rounded border border-white/10 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="opacity-60">
                #{i + 1}
                {imported && line.speaker ? ` · ${story.names[line.speaker] || line.speaker}` : ""}
              </span>
              {!imported && (
                <div className="flex gap-1">
                  <button className="btn" onClick={() => move(i, -1)} disabled={i === 0}>
                    ↑
                  </button>
                  <button className="btn" onClick={() => move(i, 1)} disabled={i === story.lines.length - 1}>
                    ↓
                  </button>
                  <button className="btn" onClick={() => insertAt(i + 1)}>
                    Insert below
                  </button>
                  <button className="btn btn-danger" onClick={() => remove(line.id)}>
                    Delete
                  </button>
                </div>
              )}
            </div>

            {imported ? (
              <>
                <p className="whitespace-pre-wrap">{stripTags(line.original)}</p>
                {line.reference && (
                  <p className="whitespace-pre-wrap text-sm opacity-50">EN: {stripTags(line.reference)}</p>
                )}
              </>
            ) : (
              <>
                <input
                  className="input w-full"
                  placeholder="Speaker"
                  value={line.speaker}
                  onChange={(e) => setLine(line.id, { speaker: e.target.value })}
                />
                <textarea
                  className="input w-full"
                  rows={2}
                  placeholder="Original"
                  value={line.original}
                  onChange={(e) => setLine(line.id, { original: e.target.value })}
                />
              </>
            )}

            <textarea
              className="input w-full"
              rows={2}
              placeholder="Translation"
              value={line.translated}
              onChange={(e) => setLine(line.id, { translated: e.target.value })}
            />
          </div>
        ))}
      </section>
    </div>
  )
}