import { useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "react-router"
import { useStory } from "@/editor/lib/useStory"
import { importGameStory } from "@/games/ournotes/lib/importGame"
import { importBandoriStory } from "@/games/bandori/importBandori"
import { importLabels } from "@/editor/lib/labels"
import { importExtras } from "@/editor/lib/chats"
import { TARGET_LANGUAGE } from "@/editor/lib/config"
import { eventFolder } from "@/games/bandori/bestdori/api"
import {
  pick,
  type CardEpisode,
  type CardSummary,
  type EventChapter,
  type EventSummary,
} from "@/games/bandori/bestdori/types"
import type { Story, StoryLine } from "@/editor/lib/types"
import GameStoryPicker from "@/games/ournotes/GameStoryPicker"
import BandoriPicker from "@/games/bandori/components/BandoriPicker"
import CardPicker from "@/games/bandori/components/CardPicker"
import BandoriTitleCard from "@/games/bandori/components/BandoriTitleCard"
import LabelsCard from "@/editor/components/LabelsCard"
import ChatsCard from "@/editor/components/ChatsCard"
import SubtitlesCard from "@/editor/components/SubtitlesCard"

const stripTags = (s: string) => s.replace(/<[^>]*>/g, "")

const chip = (active: boolean) =>
  `rounded-full border px-3 py-0.5 text-xs transition ${
    active ? "border-blue-400/70 bg-blue-500/25" : "border-white/15 bg-white/5 hover:bg-white/10"
  }`

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
  const [bandoriKind, setBandoriKind] = useState<"event" | "card">("event")

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
  const isBandori = story.game === "bandori"
  const imported = !!story.source || !!story.bandori
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

  const confirmReplace = () =>
    done === 0 || window.confirm("This replaces the current lines and translations. Continue?")

  const doImport = async (advId: number) => {
    if (!confirmReplace()) return
    setBusy(true)
    setError("")
    try {
      const g = await importGameStory(advId)
      const lb = await importLabels(advId)
      // Phone messages and subtitles are optional: if they fail to load, the story still imports.
      const extras = await importExtras(advId).catch((e) => {
        console.warn("[import] phone messages / subtitles failed", e)
        return { chats: [], subtitles: [] }
      })
      patch((s) => ({
        ...s,
        title: s.title.trim() ? s.title : g.title,
        source: g.source,
        language: TARGET_LANGUAGE,
        names: g.names,
        lines: g.lines,
        ...lb,
        chats: extras.chats.length ? extras.chats : undefined,
        subtitles: extras.subtitles.length ? extras.subtitles : undefined,
      }))
      setShowPicker(false)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  const doImportBandori = async (event: EventSummary, chapter: EventChapter) => {
    if (!confirmReplace()) return
    setBusy(true)
    setError("")
    try {
      const g = await importBandoriStory({
        server: "jp",
        eventId: event.id,
        scenarioId: chapter.scenarioId,
        folder: eventFolder(event.id),
      })
      patch((s) => ({
        ...s,
        title:
          s.title.trim() && s.title !== "Untitled story"
            ? s.title
            : pick(chapter.title, "en") || pick(chapter.title, "jp"),
        bandori: g.bandori,
        language: TARGET_LANGUAGE,
        names: {},
        speakerRef: g.speakerRef,
        lines: g.lines,
        labels: g.labels,
        chats: undefined,
        subtitles: undefined,
        episodeTitle: undefined,
      }))
      if (!g.hasReference) setError("Imported Japanese only: no matching English version was found.")
      setShowPicker(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const doImportCard = async (card: CardSummary, episode: CardEpisode) => {
    if (!confirmReplace()) return
    setBusy(true)
    setError("")
    try {
      const source = (server: "jp" | "en") => ({
        server,
        eventId: 0,
        scenarioId: episode.scenarioId,
        folder: `${card.resourceSetName}_rip`,
        card: { id: card.id, resourceSetName: card.resourceSetName, episodeType: episode.episodeType },
      })
      // The Japanese version is the original. A card that exists only on the global server falls back to it.
      let g: Awaited<ReturnType<typeof importBandoriStory>>
      try {
        g = await importBandoriStory(source("jp"))
      } catch {
        g = await importBandoriStory(source("en"))
      }
      patch((s) => ({
        ...s,
        title:
          s.title.trim() && s.title !== "Untitled story"
            ? s.title
            : pick(episode.title, "en") || pick(episode.title, "jp"),
        bandori: g.bandori,
        language: TARGET_LANGUAGE,
        names: {},
        speakerRef: g.speakerRef,
        lines: g.lines,
        labels: g.labels,
        chats: undefined,
        subtitles: undefined,
        episodeTitle: undefined,
      }))
      if (!g.hasReference) setError("Imported Japanese only: no matching English version was found.")
      setShowPicker(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
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
              {showPicker ? "Close list" : isBandori ? "Event or card story" : "Game story"}
            </button>
          </div>
          {story.source && <p className="text-xs opacity-60">From ADV {story.source.advId}</p>}
          {story.bandori && <p className="text-xs opacity-60">From {story.bandori.scenarioId}</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
          {showPicker && !isBandori && <GameStoryPicker busy={busy} onPick={doImport} />}
          {showPicker && isBandori && (
            <>
              <div className="flex gap-1">
                <button type="button" className={chip(bandoriKind === "event")} onClick={() => setBandoriKind("event")}>
                  Event
                </button>
                <button type="button" className={chip(bandoriKind === "card")} onClick={() => setBandoriKind("card")}>
                  Card
                </button>
              </div>
              {bandoriKind === "event" ? (
                <BandoriPicker busy={busy} onPick={doImportBandori} />
              ) : (
                <CardPicker busy={busy} onPick={doImportCard} />
              )}
            </>
          )}
        </div>

        {isBandori ? (
          <BandoriTitleCard story={story} patch={patch} />
        ) : (
          <>
            <LabelsCard story={story} patch={patch} />
            <ChatsCard story={story} patch={patch} />
            <SubtitlesCard story={story} patch={patch} />
          </>
        )}

        <div className="card space-y-2">
          <h2 className="font-semibold">Speaker names</h2>
          {speakers.length === 0 && <p className="text-sm opacity-60">Speakers appear once lines have speakers.</p>}
          {speakers.map((sp) => {
            const en = story.speakerRef?.[sp]
            return (
              <div key={sp} className="grid grid-cols-[84px_1fr] items-center gap-2">
                <span className="text-xs opacity-70" title={sp}>
                  <span className="block truncate">{sp}</span>
                  {en && <span className="block truncate opacity-70">{en}</span>}
                </span>
                <input
                  className="input !p-1.5 text-sm"
                  value={story.names[sp] ?? ""}
                  placeholder={en || sp}
                  onChange={(e) => patch((s) => ({ ...s, names: { ...s.names, [sp]: e.target.value } }))}
                />
              </div>
            )
          })}
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