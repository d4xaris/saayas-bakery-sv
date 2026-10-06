import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import type { Dialog, Telop } from "./engine"
import { TEXT_CHARS_PER_SECOND, talkStyles, telopStyles } from "@/lib/bestdori/viewerSpec"

// Bestdori's numbers depend on the stage width W and height H (16:9).
// We call its helpers with W = 100 and H = 56.25 and print every length in cqw,
// so the layout scales with the stage width (the stage div is a container-type: inline-size box).
const UW = 100
const UH = (100 * 9) / 16
const UNITLESS = new Set(["fontWeight", "opacity", "zIndex", "flex", "lineHeight"])

function cq(style: CSSProperties): CSSProperties {
  const out: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(style)) {
    if (typeof v === "number") out[k] = UNITLESS.has(k) ? v : `${v}cqw`
    else if (typeof v === "string") out[k] = v.replace(/(-?\d*\.?\d+)px/g, "$1cqw")
  }
  return out as CSSProperties
}

/** Created by TextBox for every line and handed to the player, which uses it on clicks. */
export interface Typer {
  /** true while the line is still typing */
  active: boolean
  /** show the whole line at once */
  finish: () => void
}

export function LocationCard({ telop }: { telop: Telop }) {
  const { outer, inner } = telopStyles(UW, UH, telop.state, telop.progress)
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div style={cq(outer)} />
      <div style={cq(inner)}>{telop.text}</div>
    </div>
  )
}

export function TextBox({
  dialog,
  onTyping,
  paused,
}: {
  dialog: Dialog
  onTyping: (t: Typer) => void
  paused: boolean
}) {
  const chars = useMemo(() => Array.from(dialog.text), [dialog])
  const [prog, setProg] = useState<{ d: Dialog; n: number }>({ d: dialog, n: 0 })
  const pausedRef = useRef(paused)

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  useEffect(() => {
    let raf = 0
    let elapsed = 0 // ms of typing time; does not grow while paused
    let last = performance.now()
    const typer: Typer = {
      active: chars.length > 0,
      finish: () => {
        cancelAnimationFrame(raf)
        typer.active = false
        setProg({ d: dialog, n: chars.length })
      },
    }
    onTyping(typer)
    const tick = () => {
      const now = performance.now()
      if (!pausedRef.current) elapsed += now - last
      last = now
      const n = Math.min(chars.length, Math.floor((elapsed / 1000) * TEXT_CHARS_PER_SECOND))
      setProg({ d: dialog, n })
      if (n >= chars.length) typer.active = false
      else raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      typer.active = false
    }
  }, [chars, dialog, onTyping])

  const shown = prog.d === dialog ? prog.n : 0
  const { box, name } = talkStyles(UW, UH)
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div style={{ ...cq(box), lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{chars.slice(0, shown).join("")}</div>
      <div style={cq(name)}>{dialog.name}</div>
    </div>
  )
}