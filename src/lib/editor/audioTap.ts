let tapStream: MediaStream | null = null
let installed = false

/** Must run before the player creates its AudioContext. */
export function installAudioTap() {
  if (installed || typeof window === "undefined") return
  installed = true
  const Native = window.AudioContext
  const Patched = function (this: unknown, ...args: any[]) {
    const ctx = new (Native as any)(...args) as AudioContext
    try {
      const dest = ctx.createMediaStreamDestination()
      const bus = ctx.createGain()
      bus.connect(ctx.destination)
      bus.connect(dest)
      Object.defineProperty(ctx, "destination", { value: bus })
      tapStream = dest.stream
    } catch {
      /* no tap: the video will be silent */
    }
    return ctx
  } as unknown as typeof AudioContext
  Patched.prototype = Native.prototype
  window.AudioContext = Patched
}

export const getTapStream = () => tapStream