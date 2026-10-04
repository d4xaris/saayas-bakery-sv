import type { StoryPlayer } from "ournotes-player/story"
import { getTapStream } from "./audioTap"

function pickType(): { mime: string; ext: "mp4" | "webm" } {
  const options: [string, "mp4" | "webm"][] = [
    ["video/mp4;codecs=avc1,mp4a.40.2", "mp4"],
    ["video/mp4", "mp4"],
    ["video/webm;codecs=vp9,opus", "webm"],
    ["video/webm", "webm"],
  ]
  for (const [mime, ext] of options) if (MediaRecorder.isTypeSupported(mime)) return { mime, ext }
  throw new Error("This browser cannot record video.")
}

export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}

export async function exportVideo(
  player: StoryPlayer,
  fileName: string,
  opts: { signal?: AbortSignal; onStatus?: (s: string) => void } = {},
): Promise<{ ext: string; silent: boolean; bytes: number }> {
  const say = (s: string) => {
    console.log("[export]", s)
    opts.onStatus?.(s)
  }

  const { mime, ext } = pickType()
  say(`Format: ${mime}`)
  const audio = getTapStream()
  say(audio ? "Audio tap attached" : "No audio tap: the video will be silent")
  say(`Canvas: ${player.canvas.width}x${player.canvas.height}`)

  const stream = player.canvas.captureStream(30)
  audio?.getAudioTracks().forEach((t) => stream.addTrack(t))

  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 })
  const chunks: BlobPart[] = []
  let bytes = 0
  rec.ondataavailable = (e) => {
    if (e.data.size) {
      chunks.push(e.data)
      bytes += e.data.size
    }
  }
  const stopped = new Promise<void>((r) => (rec.onstop = () => r()))

  await player.seekToLine(0)
  player.setSpeed(10 as any)
  player.setAuto(true)

  const ended = new Promise<void>((resolve) => {
    player.addEventListener("ended", () => resolve(), { once: true } as any)
    opts.signal?.addEventListener("abort", () => resolve(), { once: true })
  })

  rec.start(1000)
  player.play()
  const t0 = Date.now()
  const timer = setInterval(() => {
    say(`Recording… ${Math.round((Date.now() - t0) / 1000)} s, line ${player.line + 1}/${player.lineCount}, ${(bytes / 1e6).toFixed(1)} MB`)
  }, 1000)

  await ended
  clearInterval(timer)
  say("Story ended or stopped, finishing the file…")
  await new Promise((r) => setTimeout(r, 800))
  rec.stop()
  await stopped
  player.setAuto(false)

  if (bytes === 0) throw new Error("Nothing was recorded (0 bytes).")
  downloadBlob(new Blob(chunks, { type: mime }), `${fileName.replace(/[\\/:*?"<>|]/g, "_")}.${ext}`)
  say(`Saved ${ext.toUpperCase()} (${(bytes / 1e6).toFixed(1)} MB)`)
  return { ext, silent: !audio, bytes }
}