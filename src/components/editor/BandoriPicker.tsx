import { useEffect, useMemo, useState } from "react"
import { fetchEventChapters, fetchEvents } from "@/lib/bestdori/api"
import { eventBannerUrl } from "@/lib/bestdori/images"
import { pick, type EventChapter, type EventSummary } from "@/lib/bestdori/types"

// Index 1 is the EN server. A null start date means the event is not on global.
const onGlobal = (e: EventSummary) => {
  const start = e.startAt[1]
  if (start == null) return false
  const t = Number(start)
  return !(Number.isFinite(t) && t > Date.now()) // hide events not started yet
}

/** EN event banner. Renders nothing if there is no EN bundle name or the image fails to load. */
function Banner(props: { event: EventSummary; className?: string }) {
  const [failed, setFailed] = useState(false)
    const url = eventBannerUrl(props.event.bundle ?? "")
  if (!url || failed) return null
  return (
    <img
      src={url}
      loading="lazy"
      alt=""
      className={props.className}
      onError={() => setFailed(true)}
    />
  )
}

export default function BandoriPicker(props: {
  busy: boolean
  onPick: (event: EventSummary, chapter: EventChapter) => void
}) {
  const [events, setEvents] = useState<EventSummary[] | null>(null)
  const [query, setQuery] = useState("")
  const [event, setEvent] = useState<EventSummary | null>(null)
  const [chapters, setChapters] = useState<EventChapter[] | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    fetchEvents()
      .then(setEvents)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  const choose = (ev: EventSummary) => {
    setEvent(ev)
    setChapters(null)
    setError("")
    fetchEventChapters(ev.id)
      .then(setChapters)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }

  const name = (e: EventSummary) =>
    pick(e.names, "en") || pick(e.names, "jp") || `Event ${e.id}`

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = (events ?? []).filter(onGlobal)
    if (!q) return list
    return list.filter(
      (e) => String(e.id) === q || e.names.some((n) => n?.toLowerCase().includes(q)),
    )
  }, [events, query])

  if (event) {
    return (
      <div className="space-y-2">
        <button className="btn w-full" onClick={() => { setEvent(null); setChapters(null); setError("") }}>
          ← Events
        </button>
        <Banner event={event} className="w-full rounded" />
        <p className="text-sm font-semibold">{name(event)}</p>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {!chapters && !error && <p className="text-sm opacity-60">Loading…</p>}
        {chapters?.length === 0 && <p className="text-sm opacity-60">No chapters.</p>}
        {chapters?.map((c) => (
          <div key={c.scenarioId} className="space-y-1 rounded border border-neutral-600 p-2">
            <p className="text-xs opacity-60">{pick(c.caption, "en")}</p>
            <p className="text-sm">{pick(c.title, "en")}</p>
            <button className="btn w-full" disabled={props.busy} onClick={() => props.onPick(event, c)}>
              {props.busy ? "Importing…" : "Import"}
            </button>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <input className="input" placeholder="Search name or number" value={query}
        onChange={(e) => setQuery(e.target.value)} />
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!events && !error && <p className="text-sm opacity-60">Loading events…</p>}
      {events && <p className="text-xs opacity-60">{shown.length} events</p>}
      <div className="h-[60vh] space-y-2 overflow-y-auto overscroll-contain">
        {shown.map((e) => (
          <button
            key={e.id}
            className="btn w-full space-y-1 text-left"
            onClick={() => choose(e)}
          >
            <Banner event={e} className="w-full rounded" />
            <span className="block">
              <span className="opacity-60">{e.id}</span> {name(e)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}