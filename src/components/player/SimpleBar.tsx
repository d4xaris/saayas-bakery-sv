import { useEffect, useState } from "react"
import type { StoryPlayer } from "ournotes-player/story"

export default function SimpleBar({
  player,
  onFullscreen,
}: {
  player: StoryPlayer
  onFullscreen: (() => void) | null
}) {
  const [auto, setAuto] = useState(true)
  const [, tick] = useState(0)

  // The player has no single "changed" event for everything shown here, so re-read it a few times a second.
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 250)
    return () => window.clearInterval(id)
  }, [])

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