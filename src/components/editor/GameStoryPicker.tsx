import { useEffect, useMemo, useState } from "react"
import { listGameStories, type GameStoryEntry } from "@/lib/editor/importGame"

type Props = {
  busy?: boolean
  onPick: (advId: number) => void
}

export default function GameStoryPicker({ busy, onPick }: Props) {
  const [all, setAll] = useState<GameStoryEntry[]>([])
  const [error, setError] = useState("")
  const [q, setQ] = useState("")
  const [kind, setKind] = useState("all")

  useEffect(() => {
    listGameStories().then(setAll).catch((e) => setError(String(e)))
  }, [])

  const kinds = useMemo(() => ["all", ...new Set(all.map((s) => s.kind))], [all])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return all
      .filter((s) => kind === "all" || s.kind === kind)
      .filter(
        (s) =>
          !needle ||
          s.title.toLowerCase().includes(needle) ||
          s.chapter.toLowerCase().includes(needle) ||
          String(s.advId).includes(needle),
      )
      .slice(0, 100)
  }, [all, q, kind])

  if (error) return <p className="text-red-400">Could not load story list: {error}</p>
  if (!all.length) return <p>Loading story list…</p>

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Search title, chapter or ID"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
          {kinds.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>
      <ul className="max-h-80 space-y-1 overflow-y-auto">
        {shown.map((s) => (
          <li key={s.advId} className="flex items-center justify-between gap-2">
            <span>
              <strong>{s.title}</strong>{" "}
              <span className="opacity-60">
                {s.chapter} · {s.advId}
              </span>
            </span>
            <button className="btn" disabled={busy} onClick={() => onPick(s.advId)}>
              Import
            </button>
          </li>
        ))}
      </ul>
      {all.length > 100 && <p className="text-sm opacity-60">Showing up to 100 results. Search to narrow.</p>}
    </div>
  )
}