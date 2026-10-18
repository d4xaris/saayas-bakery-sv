import { useEffect, useMemo, useState } from "react"
import { listGameStories, type GameStoryEntry } from "@/lib/editor/importGame"
import { chapterBannerUrl } from "@/lib/editor/images"

type Props = {
  busy?: boolean
  onPick: (advId: number) => void
}

const KIND_LABELS: Record<string, string> = {
  event: "Event story",
  chapter: "Band story",
  liveResult: "After live",
  friendship: "Bond",
  spotTalk: "Area talk",
  spot: "Area",
  other: "Other",
  none: "Other",
}
const kindLabel = (k: string) => KIND_LABELS[k] ?? k

/** English chapter banner. Renders nothing if the id is unknown or the image fails to load. */
function Banner(props: { chapterId: number | null; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (props.chapterId == null || failed) return null
  return (
    <img
      src={chapterBannerUrl(props.chapterId)}
      loading="lazy"
      alt=""
      className={props.className}
      onError={() => setFailed(true)}
    />
  )
}

export default function GameStoryPicker({ busy, onPick }: Props) {
  const [all, setAll] = useState<GameStoryEntry[]>([])
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [kind, setKind] = useState("all")
  const [open, setOpen] = useState<Set<string>>(new Set())

  useEffect(() => {
    listGameStories()
      .then((list) => {
        setAll(list)
        // The list starts with the newest event: open it, so it is the first thing you see.
        const newest = list.find((s) => s.kind === "event")
        if (newest) setOpen(new Set([newest.chapter]))
      })
      .catch((e) => setError(String(e)))
  }, [])

  const kinds = useMemo(() => {
    const counts = new Map<string, number>()
    all.forEach((s) => counts.set(s.kind, (counts.get(s.kind) ?? 0) + 1))
    return [...counts.entries()]
  }, [all])

  const q = query.trim().toLowerCase()

  const groups = useMemo(() => {
    const map = new Map<string, GameStoryEntry[]>()
    for (const s of all) {
      if (kind !== "all" && s.kind !== kind) continue
      if (q && !`${s.title} ${s.chapter} ${s.advId}`.toLowerCase().includes(q)) continue
      const name = s.chapter || "Without a group"
      const list = map.get(name)
      if (list) list.push(s)
      else map.set(name, [s])
    }
    return [...map.entries()]
  }, [all, kind, q])

  const toggle = (name: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })

  if (error) return <p className="text-sm text-red-400">Could not load story list: {error}</p>
  if (!all.length) return <p className="text-sm opacity-60">Loading story list…</p>

  return (
    <div className="space-y-2">
      <input
        className="input"
        placeholder="Search title, event or ID"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="flex flex-wrap gap-1">
        {([["all", all.length], ...kinds] as [string, number][]).map(([k, n]) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded-full border px-2 py-0.5 text-xs transition ${
              kind === k ? "border-blue-400/70 bg-blue-500/25" : "border-white/15 bg-white/5 hover:bg-white/10"
            }`}
          >
            {k === "all" ? "All" : kindLabel(k)} <span className="opacity-60">{n}</span>
          </button>
        ))}
      </div>

      <div className="max-h-[55vh] space-y-1 overflow-y-auto pr-1">
        {groups.map(([name, list]) => {
          const expanded = q.length > 0 || open.has(name)
          const chapterId = list[0]?.chapterId ?? null
          return (
            <div key={name} className="rounded border border-white/10">
              <button
                type="button"
                onClick={() => toggle(name)}
                className="w-full text-left hover:bg-white/5"
              >
                <Banner chapterId={chapterId} className="w-full rounded-t" />
                <span className="flex items-center justify-between gap-2 px-2 py-1.5 text-sm">
                  <span className="truncate font-medium">{name}</span>
                  <span className="shrink-0 text-xs opacity-60">
                    {list.length} {expanded ? "▾" : "▸"}
                  </span>
                </span>
              </button>
              {expanded && (
                <ul className="divide-y divide-white/5 border-t border-white/10">
                  {list.map((s) => (
                    <li key={s.advId} className="flex items-center justify-between gap-2 px-2 py-1.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm leading-snug">{s.title}</p>
                        <p className="text-xs opacity-50">
                          {kindLabel(s.kind)} · {s.advId}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn shrink-0 !px-2 !py-1 text-xs"
                        disabled={busy}
                        onClick={() => onPick(s.advId)}
                      >
                        {busy ? "…" : "Import"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
        {groups.length === 0 && <p className="text-sm opacity-60">Nothing found.</p>}
      </div>
    </div>
  )
}