const BASE: string = import.meta.env.VITE_BESTDORI_BASE ?? "/bestdori"

/** sound/scenario/bgm/{lowercase}_rip/{Original_Name}.mp3 (verified). */
export const bgmUrl = (name: string) => `${BASE}/assets/jp/sound/scenario/bgm/${name.toLowerCase()}_rip/${name}.mp3`

/** sound/se/{seBundleName}_rip/{se}.mp3 (verified on event125/SE_BIKE_STOP: audio/mpeg; lowercase file name misses). */
export const seUrl = (bundle: string, name: string) => `${BASE}/assets/jp/sound/se/${bundle}_rip/${name}.mp3`

/**
 * Event: sound/voice/scenario/eventstory{event}_{chapter-1}_rip/{voiceId}.mp3 (verified for event 319 chapter 1).
 * Card (resourceSetName given): sound/voice/scenario/resourceset/{resourceSetName}_rip/{voiceId}.mp3 (UNVERIFIED, from viewerSpec.cardPaths).
 */
export function voiceUrl(scenarioId: string, voiceId: string, resourceSetName?: string): string | null {
  if (!voiceId) return null
  if (resourceSetName) {
    return `${BASE}/assets/jp/sound/voice/scenario/resourceset/${resourceSetName}_rip/${voiceId}.mp3`
  }
  const m = /^event(\d+)-(\d+)$/.exec(scenarioId)
  if (!m) return null
  return `${BASE}/assets/jp/sound/voice/scenario/eventstory${m[1]}_${Number(m[2]) - 1}_rip/${voiceId}.mp3`
}

/** UNVERIFIED: side 0..8 across the screen, 4 = centre. Tune after comparing with Bestdori's viewer. */
export const sideX = (side: number) => Math.min(1.1, Math.max(-0.1, side / 8))

/** Effect frame from specialEffectData stringValSub, e.g. "scenario/effects/reminiscence_frame02" -> frame.png (verified: image/png). Other effect folders are not mapped. */
export function effectFrameUrl(sub: string): string | null {
  if (!/reminiscence_frame02$/.test(sub)) return null
  return `${BASE}/assets/jp/${sub}_rip/frame.png`
}