import type { storyPlayerVolumes } from "@/shared/lib/player-settings"

export type Volumes = ReturnType<typeof storyPlayerVolumes>

// Audio files downloaded before playing (url -> blob URL). Kept between replays; cleared when it grows too big.
export const audioBlobs = new Map<string, string>()

export interface AudioBank {
  volumes: Volumes
  voices: HTMLAudioElement[]
  sfx: HTMLAudioElement[]
  /** model -> the voice it is speaking */
  mouth: Map<any, HTMLAudioElement>
  /** The preloaded copy of a file if there is one, else the original url. */
  src(url: string): string
  setVol(a: HTMLAudioElement, base: number): void
  playBgm(url: string): void
  /** Music waits while the gate is closed (before the first location card is done). */
  setGate(open: boolean): void
  openGate(): void
  stopVoices(): void
  setMaster(level: number): void
  pauseAll(): void
  resumeAll(): void
  stopAll(): void
}

export function createAudioBank(volumes: Volumes, isPaused: () => boolean): AudioBank {
  let bgm: HTMLAudioElement | null = null
  let master = 1
  const baseVol = new WeakMap<HTMLAudioElement, number>()
  const voices: HTMLAudioElement[] = []
  const sfx: HTMLAudioElement[] = []
  const mouth = new Map<any, HTMLAudioElement>()
  let gateOpen = true
  let queued: string | null = null

  const src = (url: string) => audioBlobs.get(url) ?? url
  const setVol = (a: HTMLAudioElement, base: number) => {
    baseVol.set(a, base)
    a.volume = Math.min(1, Math.max(0, base * master))
  }
  const all = () => [bgm, ...voices, ...sfx].filter(Boolean) as HTMLAudioElement[]

  const startBgm = (url: string) => {
    bgm?.pause()
    bgm = new Audio(src(url))
    bgm.loop = true
    setVol(bgm, volumes.Bgm)
    if (!isPaused()) void bgm.play().catch(() => {})
  }
  const stopVoices = () => {
    voices.splice(0).forEach((a) => a.pause())
    mouth.clear()
  }

  return {
    volumes,
    voices,
    sfx,
    mouth,
    src,
    setVol,
    playBgm: (url) => {
      if (!gateOpen) {
        queued = url
        return
      }
      startBgm(url)
    },
    setGate: (open) => {
      gateOpen = open
    },
    openGate: () => {
      if (gateOpen) return
      gateOpen = true
      if (queued) {
        const url = queued
        queued = null
        startBgm(url)
      }
    },
    stopVoices,
    setMaster: (level) => {
      master = Math.min(1, Math.max(0, level))
      for (const a of all()) setVol(a, baseVol.get(a) ?? 1)
    },
    pauseAll: () => all().forEach((a) => a.pause()),
    resumeAll: () =>
      all().forEach((a) => {
        if (!a.ended) void a.play().catch(() => {})
      }),
    stopAll: () => {
      bgm?.pause()
      sfx.splice(0).forEach((a) => a.pause())
      stopVoices()
    },
  }
}