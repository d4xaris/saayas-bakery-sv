import { useEffect, useState } from "react"
import type { StoryPlayer } from "ournotes-player/story"

type Category = Parameters<StoryPlayer["setVolume"]>[0]
const CATEGORIES = ["Bgm", "Se", "Voice", "Movie"] as Category[]
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

export default function SimpleBar({
  player,
  onFullscreen,
}: {
  player: StoryPlayer
  onFullscreen: (() => void) | null
}) {
  const [auto, setAuto] = useState(true)
  const [volume, setVolume] = useState(loadVolume)
  const [, tick] = useState(0)

  // The player has no single "changed" event for everything shown here, so re-read it a few times a second.
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 250)
    return () => window.clearInterval(id)
  }, [])

  // One master volume for music, effects, voice and movie sound. Applied on load and on every change.
  useEffect(() => {
    const level = volume.muted ? 0 : volume.level
    for (const c of CATEGORIES) player.setVolume(c, level)
    try {
      localStorage.setItem(KEY, JSON.stringify(volume))
    } catch {
      /* ignore */
    }
  }, [player, volume])

  const started = Boolean(player.session?.started)
  const paused = player.paused
  const ended = player.ended

  const start = () => {
    player.setAuto(auto)
    player.play()
  }

  const toggle = () => {
    if (!started || ended) return start()
    if (paused) player.play()
    else player.pause()
  }

  const restart = async () => {
    await player.seekToLine(0)
    player.setAuto(auto)
    player.play()
  }

  // Tap on the picture: start, or the next line.
  useEffect(() => {
    const canvas = player.canvas
    const onTap = (e: PointerEvent) => {
      if (e.button !== 0) return
      if (!player.session?.started) {
        player.setAuto(auto)
        player.play()
      } else if (!player.ended) player.next()
    }
    canvas.style.cursor = "pointer"
    canvas.addEventListener("pointerdown", onTap)
    return () => canvas.removeEventListener("pointerdown", onTap)
  }, [player, auto])

  const label = !started ? "Start" : ended ? "Replay" : paused ? "Play" : "Pause"
  const shown = volume.muted ? 0 : volume.level

  return (
    <div className="card flex flex-wrap items-center gap-3">
      <button className="btn btn-primary min-w-24" onClick={toggle}>
        {label}
      </button>
      <button className="btn" onClick={restart}>
        Restart
      </button>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={auto}
          onChange={(e) => {
            setAuto(e.target.checked)
            player.setAuto(e.target.checked)
          }}
        />
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
      {player.lineCount > 0 && (
        <span className="font-mono text-xs opacity-60">
          {Math.max(0, player.line) + 1} / {player.lineCount}
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
