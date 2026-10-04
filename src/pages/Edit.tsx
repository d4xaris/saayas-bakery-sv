import { useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "react-router"
import { useStory } from "@/lib/editor/useStory"
import { importGameStory } from "@/lib/editor/importGame"
import { importLabels } from "@/lib/editor/labels"
import { TARGET_LANGUAGE } from "@/lib/editor/config"
import type { Story, StoryLine } from "@/lib/editor/types"
import GameStoryPicker from "@/components/editor/GameStoryPicker"
import LabelsCard from "@/components/editor/LabelsCard"

const stripTags = (s: string) => s.replace(/<[^>]*>/g, "")

export default function Edit() {
  const { id = "" } = useParams()
  const { story, update, flush } = useStory(id) as {
    story: Story | null | undefined
    update: (fn: (s: Story) => Story) => void
    flush?: () => void | Promise<void>
  }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [showPicker, setShowPicker] = useState(false)

  // Save when leaving the page (back button, tab change, closing the tab).
  const flushRef = useRef(flush)
  flushRef.current = flush
  useEffect(() => {
    const save = () => { void flushRef.current?.() }
    window.addEventListener("pagehide", save)
    return () => {
      window.removeEventListener("pagehide", save)
      save()
    }
  }, [])

  const speakers = useMemo(
    () => [...new Set((story?.lines ?? []).map((l) => l.speaker).filter(Boolean))],
    [story?.lines],
  )

  if (!story) return <p>Loading…</p>

  const patch = (fn: (s: Story) => Story) => update(fn)
  const imported = !!story.source
  const total = story.lines.length
  const done = story.lines.filter((l) => l.translated.trim()).length

  const setLine = (lineId: string, changes: Partial<StoryLine>) =>
    patch((s) => ({ ...s, lines: s.lines.map((l) => (l.id === lineId ? { ...l, ...changes } : l)) }))

  const newLine = (): StoryLine => ({ id: crypto.randomUUID(), speaker: "", original: "", translated: "" })

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
    if (done > 0 && !window.confirm("This replaces the current lines and translations. Continue?")) return
    setBusy(true)
    setError("")
    try {
      const g = await importGameStory(advId)
      const lb = await importLabels(advId)
      patch((s) => ({
        ...s,
        title: s.title.trim() ? s.title : g.title,
        source: g.source,
        language: TARGET_LANGUAGE,
        names: g.names,
        lines: g.lines,
        ...lb,
      }))
      setShowPicker(false)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <aside className="space-y-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
        <div className="card space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Import</h2>
            <button className="btn" onClick={() => setShowPicker((v) => !v)}>
              {showPicker ? "Close list" : "Game story"}
            </button>
          </div>
          {imported && <p className="text-xs opacity-60">From ADV {story.source!.advId}</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
          {showPicker && <GameStoryPicker busy={busy} onPick={doImport} />}
        </div>

        <LabelsCard story={story} patch={patch} />

        <div className="card space-y-2">
          <h2 className="font-semibold">Speaker names</h2>
          {speakers.length === 0 && <p className="text-sm opacity-60">Speakers appear once lines have speakers.</p>}
          {speakers.map((sp) => (
            <div key={sp} className="grid grid-cols-[84px_1fr] items-center gap-2">
              <span className="truncate text-xs opacity-70" title={sp}>{sp}</span>
              <input
                className="input !p-1.5 text-sm"
                value={story.names[sp] ?? ""}
                placeholder={sp}
                onChange={(e) => patch((s) => ({ ...s, names: { ...s.names, [sp]: e.target.value } }))}
              />
            </div>
          ))}
        </div>
      </aside>

      <section className="space-y-3">
        {story.lines.map((line, i) => {
          const isDone = !!line.translated.trim()
          return (
            <div key={line.id} className={`card space-y-2 ${isDone ? "card-done" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm opacity-70">
                  #{i + 1}
                  {imported && line.speaker ? ` · ${story.names[line.speaker] || line.speaker}` : ""}
                </span>
                {!imported && (
                  <div className="flex gap-1">
                    <button className="btn" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                    <button className="btn" onClick={() => move(i, 1)} disabled={i === total - 1}>↓</button>
                    <button className="btn" onClick={() => insertAt(i + 1)}>Insert below</button>
                    <button className="btn btn-danger" onClick={() => remove(line.id)}>Delete</button>
                  </div>
                )}
              </div>

              {imported ? (
                <div className="space-y-0.5 text-sm leading-snug">
                  <p className="whitespace-pre-wrap">{stripTags(line.original)}</p>
                  {line.reference && (
                    <p className="whitespace-pre-wrap opacity-60">{stripTags(line.reference)}</p>
                  )}
                </div>
              ) : (
                <>
                  <input className="input" placeholder="Speaker" value={line.speaker}
                    onChange={(e) => setLine(line.id, { speaker: e.target.value })} />
                  <textarea className="input" rows={2} placeholder="Original" value={line.original}
                    onChange={(e) => setLine(line.id, { original: e.target.value })} />
                </>
              )}

              <textarea className="input" rows={2} placeholder="Translation" value={line.translated}
                onChange={(e) => setLine(line.id, { translated: e.target.value })} />
            </div>
          )
        })}
      </section>
    </div>
  )
}
