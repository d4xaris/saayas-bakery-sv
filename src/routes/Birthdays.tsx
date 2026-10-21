import { useState } from "react"
import { Link } from "react-router"
import { BIRTHDAYS, GROUPS, type Birthday } from "@/editor/lib/birthdays"

const MIN_IDX = 2026 * 12 // January 2026
const MAX_IDX = 2029 * 12 + 11 // December 2029
const SHOWN = 3
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const YEARS = [2026, 2027, 2028, 2029]

type Day = { y: number; m: number; d: number }

const clampStart = (i: number) => Math.min(MAX_IDX - (SHOWN - 1), Math.max(MIN_IDX, i))
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
const monthName = (y: number, m: number) => new Date(y, m, 1).toLocaleString("en-US", { month: "long" })
const sameDay = (a: Day | null, b: Day) => !!a && a.y === b.y && a.m === b.m && a.d === b.d

function birthdaysOn(y: number, m: number, d: number): Birthday[] {
  return BIRTHDAYS.filter(
    (b) => b.month === m + 1 && (b.day === d || (b.month === 2 && b.day === 29 && d === 28 && !isLeap(y))),
  )
}

/** One colour, or two halves when both groups have a birthday on the same day. */
function fillFor(list: Birthday[]): string | undefined {
  const ids = new Set(list.map((b) => b.group))
  const colors = (Object.keys(GROUPS) as (keyof typeof GROUPS)[])
    .filter((id) => ids.has(id))
    .map((id) => GROUPS[id].color)
  if (colors.length === 0) return undefined
  if (colors.length === 1) return colors[0]
  return `linear-gradient(135deg, ${colors[0]} 50%, ${colors[1]} 50%)`
}

function MonthGrid({
  idx,
  today,
  selected,
  onSelect,
}: {
  idx: number
  today: Day
  selected: Day | null
  onSelect: (d: Day) => void
}) {
  const y = Math.floor(idx / 12)
  const m = idx % 12
  const isCurrentMonth = y === today.y && m === today.m
  const offset = (new Date(y, m, 1).getDay() + 6) % 7 // Monday first
  const count = new Date(y, m + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: count }, (_, i) => i + 1),
  ]

  return (
    <div
      className="card space-y-2"
      style={
        isCurrentMonth
          ? { background: "rgb(255 255 255 / 0.12)", borderColor: "rgb(255 255 255 / 0.35)" }
          : undefined
      }
    >
      <h3 className="text-center font-semibold">
        {monthName(y, m)} {y}
      </h3>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {WEEKDAYS.map((w, i) => (
          <span key={w} className={i >= 5 ? "text-red-300/70" : "opacity-50"}>
            {w}
          </span>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <span key={`blank-${i}`} />
          const day: Day = { y, m, d }
          const list = birthdaysOn(y, m, d)
          const isToday = sameDay(today, day)
          const cls = `flex h-9 items-center justify-center rounded-md text-sm ${
            isToday ? "border-2 border-red-400 font-bold" : ""
          } ${sameDay(selected, day) ? "ring-2 ring-white" : ""}`
          if (list.length === 0) {
            return (
              <span key={d} className={`${cls} ${isToday ? "bg-red-500/60 text-white" : "bg-white/5"}`}>
                {d}
              </span>
            )
          }
          return (
            <button
              key={d}
              type="button"
              onClick={() => onSelect(day)}
              className={`${cls} cursor-pointer font-semibold text-white`}
              style={{ background: fillFor(list) }}
              title={list.map((b) => b.en).join(", ")}
            >
              {d}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function Birthdays() {
  const now = new Date()
  const today: Day = { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() }
  const [start, setStart] = useState(() => clampStart(today.y * 12 + today.m))
  const [selected, setSelected] = useState<Day | null>(null)

  const months = Array.from({ length: SHOWN }, (_, i) => start + i)
  const first = months[0]
  const last = months[SHOWN - 1]
  const range = `${monthName(Math.floor(first / 12), first % 12)} ${Math.floor(first / 12)} – ${monthName(
    Math.floor(last / 12),
    last % 12,
  )} ${Math.floor(last / 12)}`

  const picked = selected ? birthdaysOn(selected.y, selected.m, selected.d) : []

  return (
    <div className="min-h-screen bg-[#383838] text-neutral-200">
      <div className="mx-auto max-w-5xl space-y-5 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link className="btn" to="/">
            ← Home
          </Link>
          <h1 className="text-2xl font-semibold">Birthdays</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className="btn"
            aria-label="Previous month"
            disabled={start <= MIN_IDX}
            onClick={() => setStart((s) => clampStart(s - 1))}
          >
            ‹
          </button>
          <button
            className="btn"
            aria-label="Next month"
            disabled={start >= MAX_IDX - (SHOWN - 1)}
            onClick={() => setStart((s) => clampStart(s + 1))}
          >
            ›
          </button>
          <span className="px-2 text-sm opacity-80">{range}</span>
          <button className="btn" onClick={() => setStart(clampStart(today.y * 12 + today.m))}>
            Today
          </button>
          <div className="flex gap-1">
            {YEARS.map((y) => (
              <button
                key={y}
                className="btn"
                style={Math.floor(first / 12) === y ? { background: "rgb(255 255 255 / 0.2)" } : undefined}
                onClick={() => setStart(clampStart(y * 12))}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {months.map((idx) => (
            <MonthGrid key={idx} idx={idx} today={today} selected={selected} onSelect={setSelected} />
          ))}
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          {Object.values(GROUPS).map((g) => (
            <span key={g.label} className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: g.color }} />
              {g.label}
            </span>
          ))}
        </div>

        <div className="card space-y-3">
          {selected && picked.length > 0 ? (
            <>
              <h2 className="font-semibold">
                {selected.d} {monthName(selected.y, selected.m)} {selected.y}
              </h2>
              {picked.map((b) => (
                <div key={`${b.en}-${b.group}`} className="flex items-start gap-3">
                  <span
                    className="mt-1.5 inline-block h-3 w-3 shrink-0 rounded-sm"
                    style={{ background: GROUPS[b.group].color }}
                  />
                  <div>
                    <p className="font-medium">{b.en}</p>
                    <p className="opacity-80">{b.uk || "—"}</p>
                    <p className="text-xs opacity-50">
                      {b.band ? `${b.band} · ` : ""}
                      {GROUPS[b.group].label}
                    </p>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <p className="text-sm opacity-60">Click a coloured date to see whose birthday it is.</p>
          )}
        </div>
      </div>
    </div>
  )
}