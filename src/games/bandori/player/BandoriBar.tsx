import { useEffect, useState } from "react"

const KEY = "editor:volume"

function loadVolume(): { level: number; muted: boolean } {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const v = JSON.parse(raw)
      return { level: Math.min(1, Math.max(0, Number(v.level))), muted: Boolean(v.muted) }
    }
  } catch {
    /* ignore */
  }
  return { level: 1, muted: false }
}

/** The same bar as SimpleBar (Our Notes), driven by the Girls Band Party engine. */
export default function BandoriBar({
  started,
  paused,
  ended,
  auto,
  line,
  lineCount,
  onToggle,
  onRestart,
  onAuto,
  onVolume,
  onFullscreen,
}: {
  started: boolean
  paused: boolean
  ended: boolean
  auto: boolean
  line: number
  lineCount: number
  onToggle: () => void
  onRestart: () => void
  onAuto: (on: boolean) => void
  onVolume: (level: number) => void
  onFullscreen: (() => void) | null
}) {
  const [volume, setVolume] = useState(loadVolume)

  useEffect(() => {
    onVolume(volume.muted ? 0 : volume.level)
    try {
      localStorage.setItem(KEY, JSON.stringify(volume))
    } catch {
      /* ignore */
    }
  }, [onVolume, volume])

  const label = !started ? "Start" : ended ? "Replay" : paused ? "Play" : "Pause"
  const shown = volume.muted ? 0 : volume.level

  return (
    <div className="card flex flex-wrap items-center gap-3">
      <button className="btn btn-primary min-w-24" onClick={onToggle}>
        {label}
      </button>
      <button className="btn" onClick={onRestart}>
        Restart
      </button>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={auto} onChange={(e) => onAuto(e.target.checked)} />
        Autoplay
      </label>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn min-w-16"
          title={volume.muted ? "Unmute" : "Mute"}
          onClick={() => setVolume((v) => ({ ...v, muted: !v.muted }))}
        >
          {volume.muted || volume.level === 0 ? "Muted" : "Sound"}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={shown}
          aria-label="Volume"
          onChange={(e) => setVolume({ level: Number(e.target.value), muted: false })}
          className="w-28 cursor-pointer"
        />
        <span className="w-10 text-right font-mono text-xs opacity-60">{Math.round(shown * 100)}%</span>
      </div>

      <span className="flex-1" />
      {lineCount > 0 && (
        <span className="font-mono text-xs opacity-60">
          {Math.max(0, line) + 1} / {lineCount}
        </span>
      )}
      {onFullscreen && (
        <button className="btn" onClick={onFullscreen}>
          Fullscreen
        </button>
      )}
    </div>
  )
}