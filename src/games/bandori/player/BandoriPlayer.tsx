import { useCallback, useEffect, useRef, useState } from "react"
import type { Story } from "@/editor/lib/types"
import {
  exitElementFullscreen,
  FULLSCREEN_CHANGE_EVENTS,
  getFullscreenElement,
  isElementFullscreenAvailable,
  lockLandscape,
  requestElementFullscreen,
} from "@/shared/lib/fullscreen"
import { createBandoriEngine, type Dialog, type Engine, type Phase, type Telop } from "./engine"
import { LocationCard, TextBox, type Typer } from "./BandoriScreen"
import BandoriBar from "./BandoriBar"

export default function BandoriPlayer({ story }: { story: Story }) {
  const storyRef = useRef(story)
  const frameRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<Engine | null>(null)
  const autoRef = useRef(true)
  const volumeRef = useRef(1)
  const wantStartRef = useRef(false)
  const typerRef = useRef<Typer | null>(null)
  const advanceRef = useRef<() => void>(() => {})

  const [phase, setPhase] = useState<Phase>("loading")
  const [info, setInfo] = useState("Loading…")
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [telop, setTelop] = useState<Telop | null>(null)
  const [auto, setAuto] = useState(true)
  const [paused, setPaused] = useState(false)
  const [line, setLine] = useState(-1)
  const [lineCount, setLineCount] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const [canFullscreen, setCanFullscreen] = useState(false)

  const bandori = story.bandori

  // Refs are updated in effects, not during render. These two effects must stay first.
  useEffect(() => {
    storyRef.current = story
  })
  useEffect(() => {
    // Tap or key: start, else first finish the typing, then go on. Does nothing while paused.
    advanceRef.current = () => {
      const engine = engineRef.current
      if (!engine || engine.isPaused()) return
      engine.start()
      const typer = typerRef.current
      if (typer?.active) typer.finish()
      else engine.advance()
    }
  }, [])

  const onTyping = useCallback((t: Typer) => {
    typerRef.current = t
  }, [])

  const onVolume = useCallback((level: number) => {
    volumeRef.current = level
    engineRef.current?.setVolume(level)
  }, [])

  useEffect(() => {
    const host = hostRef.current
    if (!host || !storyRef.current.bandori) return
    setPhase("loading")
    setInfo("Loading…")
    setDialog(null)
    setTelop(null)
    setPaused(false)
    setLine(-1)
    setLineCount(0)
    const engine = createBandoriEngine({
      host,
      getStory: () => storyRef.current,
      ui: {
        setPhase,
        setInfo,
        setDialog,
        setTelop,
        setLine: (l, total) => {
          setLine(l)
          setLineCount(total)
        },
      },
      isAuto: () => autoRef.current,
    })
    engineRef.current = engine
    engine.setVolume(volumeRef.current)
    return () => {
      engine.dispose()
      engineRef.current = null
    }
  }, [bandori?.server, bandori?.folder, bandori?.scenarioId, attempt])

  // Restart: the scene is reloaded, then started at once.
  useEffect(() => {
    if (phase === "ready" && wantStartRef.current) {
      wantStartRef.current = false
      engineRef.current?.start()
    }
  }, [phase])

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

  const started = phase === "playing" || phase === "ended"
  const ended = phase === "ended"

  const restart = () => {
    wantStartRef.current = true
    setAttempt((n) => n + 1)
  }

  const toggle = () => {
    const engine = engineRef.current
    if (!engine) return
    if (ended) return restart()
    if (!started) return engine.start()
    if (engine.isPaused()) {
      engine.resume()
      setPaused(false)
    } else {
      engine.pause()
      setPaused(true)
    }
  }

  const onAuto = (on: boolean) => {
    setAuto(on)
    autoRef.current = on
  }

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
            cursor: "pointer",
          }}
          onClick={() => advanceRef.current()}
        >
          <div ref={hostRef} className="absolute inset-0" />
          {telop && <LocationCard telop={telop} />}
          {dialog && <TextBox dialog={dialog} onTyping={onTyping} paused={paused} />}

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
          {ended && (
            <div className="absolute right-3 top-3 rounded bg-black/50 px-2 py-1 text-xs text-neutral-200">End</div>
          )}
        </div>
      </div>

      <BandoriBar
        started={started}
        paused={paused}
        ended={ended}
        auto={auto}
        line={line}
        lineCount={lineCount}
        onToggle={toggle}
        onRestart={restart}
        onAuto={onAuto}
        onVolume={onVolume}
        onFullscreen={canFullscreen ? toggleFullscreen : null}
      />
    </div>
  )
}