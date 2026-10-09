/** One clock for everything: it stands still while paused. */
export interface Clock {
  /** ms of playing time */
  now(): number
  isPaused(): boolean
  setPaused(p: boolean): void
  sleep(sec: number): Promise<void>
  tween(sec: number, fn: (t: number) => void): Promise<void>
  /** Per-frame callbacks; return true when finished. */
  addFrame(f: () => boolean): void
  removeFrame(f: () => boolean): void
  pump(): void
}

export function createClock(token: { dead: boolean }): Clock {
  let clock = 0
  let paused = false
  let last = performance.now()
  const waiters: { at: number; fn: () => void }[] = []
  const frames = new Set<() => boolean>()

  const pump = () => {
    const now = performance.now()
    if (!paused) clock += Math.min(100, now - last)
    last = now
    for (const f of [...frames]) if (f()) frames.delete(f)
    const due = waiters.filter((w) => token.dead || w.at <= clock)
    if (due.length) {
      const rest = waiters.filter((w) => !due.includes(w))
      waiters.splice(0, waiters.length, ...rest)
      due.forEach((w) => w.fn())
    }
  }
  const loop = () => {
    if (token.dead) return
    pump()
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)

  const sleep = (sec: number) =>
    new Promise<void>((resolve) => {
      waiters.push({ at: clock + sec * 1000, fn: resolve })
    })

  const tween = (sec: number, fn: (t: number) => void) =>
    new Promise<void>((resolve) => {
      const start = clock
      const ms = Math.max(1, sec * 1000)
      const step = () => {
        if (token.dead) {
          resolve()
          return true
        }
        const t = Math.min(1, (clock - start) / ms)
        fn(t)
        if (t >= 1) {
          resolve()
          return true
        }
        return false
      }
      if (!step()) frames.add(step)
    })

  return {
    now: () => clock,
    isPaused: () => paused,
    setPaused: (p) => {
      paused = p
    },
    sleep,
    tween,
    addFrame: (f) => void frames.add(f),
    removeFrame: (f) => void frames.delete(f),
    pump,
  }
}