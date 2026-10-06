import { useCallback, useEffect, useRef, useState } from "react"
import type { Story } from "@/lib/editor/types"
import {
  exitElementFullscreen,
  FULLSCREEN_CHANGE_EVENTS,
  getFullscreenElement,
  isElementFullscreenAvailable,
  lockLandscape,
  requestElementFullscreen,
} from "@/lib/browser/fullscreen"
import { createBandoriEngine, type Dialog, type Engine, type Phase, type Telop } from "./engine"
import { LocationCard, TextBox, type Typer } from "./BandoriScreen"

export default function BandoriPlayer({ story }: { story: Story }) {
  const storyRef = useRef(story)
  const frameRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<Engine | null>(null)
  const autoRef = useRef(false)
  const typerRef = useRef<Typer | null>(null)
  const advanceRef = useRef<() => void>(() => {})

  const [phase, setPhase] = useState<Phase>("loading")
  const [info, setInfo] = useState("Loading…")
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [telop, setTelop] = useState<Telop | null>(null)
  const [auto, setAuto] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const [canFullscreen, setCanFullscreen] = useState(false)

  const bandori = story.bandori

  // Refs are updated in effects, not during render. These two effects must stay first.
  useEffect(() => {
    storyRef.current = story
  })
  useEffect(() => {
    // First click finishes the typing, the next one goes on.
    advanceRef.current = () => {
      const typer = typerRef.current
      if (typer?.active) typer.finish()
      else engineRef.current?.advance()
    }
  }, [])

  const onTyping = useCallback((t: Typer) => {
    typerRef.current = t
  }, [])

  useEffect(() => {
    const host = hostRef.current
    if (!host || !storyRef.current.bandori) return
    setPhase("loading")
    setInfo("Loading…")
    setDialog(null)
    setTelop(null)
    const engine = createBandoriEngine({
      host,
      getStory: () => storyRef.current,
      ui: { setPhase, setInfo, setDialog, setTelop },
      getSpeed: () => 10,
      isAuto: () => autoRef.current,
    })
    engineRef.current = engine
    return () => {
      engine.dispose()
      engineRef.current = null
    }
  }, [bandori?.server, bandori?.folder, bandori?.scenarioId, attempt])

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const el = ev.target as HTMLElement | null
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      if (ev.key === " " || ev.key === "Enter") {
        ev.preventDefault()
        advanceRef.current()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    setCanFullscreen(isElementFullscreenAvailable())
    const onChange = () => {
      const on = getFullscreenElement() === frameRef.current
      if (on) lockLandscape()
      setFullscreen(on)
    }
    for (const type of FULLSCREEN_CHANGE_EVENTS) document.addEventListener(type, onChange)
    return () => {
      for (const type of FULLSCREEN_CHANGE_EVENTS) document.removeEventListener(type, onChange)
    }
  }, [])

  if (!bandori) return null

  const toggleFullscreen = () => {
    const el = frameRef.current
    if (!el) return
    if (getFullscreenElement()) exitElementFullscreen()
    else void requestElementFullscreen(el).catch(() => undefined)
  }

  return (
    <div className="space-y-2">
      <div
        ref={frameRef}
        role="region"
        className={`flex items-center justify-center overflow-hidden bg-black ${
          fullscreen ? "h-screen w-screen" : "rounded-2xl border-[1.5px] border-[var(--mn-border)] shadow-[var(--mn-shadow-stamp)]"
        }`}
      >
        {/* 16:9 like Bestdori's story viewer; its layout numbers are fractions of this shape */}
        <div
          className="relative select-none"
          style={{
            width: fullscreen ? "min(100vw, calc(100vh * 16 / 9))" : "100%",
            aspectRatio: "16 / 9",
            containerType: "inline-size",
          }}
          onClick={() => advanceRef.current()}
        >
          <div ref={hostRef} className="absolute inset-0" />
          {telop && <LocationCard telop={telop} />}
          {dialog && <TextBox dialog={dialog} onTyping={onTyping} />}

          {(phase === "loading" || phase === "error") && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/85 px-6 text-center text-sm text-white/80">
              <span className={phase === "error" ? "break-all text-red-400" : ""}>{info}</span>
            </div>
          )}
          {phase === "ready" && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-black/40">
              <button
                className="btn"
                onClick={(e) => {
                  e.stopPropagation()
                  engineRef.current?.start()
                }}
              >
                Play
              </button>
              {info && <span className="text-xs text-neutral-300">{info}</span>}
            </div>
          )}
          {phase === "ended" && (
            <div className="absolute right-3 top-3 rounded bg-black/50 px-2 py-1 text-xs text-neutral-200">End</div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          className="btn"
          onClick={() => {
            const next = !auto
            setAuto(next)
            autoRef.current = next
          }}
        >
          Auto: {auto ? "on" : "off"}
        </button>
        <button className="btn" onClick={() => setAttempt((n) => n + 1)}>
          Replay
        </button>
        {canFullscreen && (
          <button className="btn" onClick={toggleFullscreen}>
            Fullscreen
          </button>
        )}
      </div>
    </div>
  )
}