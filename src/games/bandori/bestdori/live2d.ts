const BASE: string = import.meta.env.VITE_BESTDORI_BASE ?? "/bestdori"

/** Bestdori serves files without the ".bytes" suffix, in "{bundle}_rip" folders. */
const rel = (bundle: string, file: string) => `${bundle}_rip/${file.replace(/\.bytes$/, "")}`


export const backgroundUrl = (bundle: string, name: string) =>
  `${BASE}/assets/jp/${bundle}_rip/${name}.png`

type Ref = { bundleName: string; fileName: string }

/** Cubism 2 settings object for pixi-live2d-display. File paths are relative to `url`. */
export async function buildModelSettings(costume: string) {
  const res = await fetch(`${BASE}/assets/jp/live2d/chara/${costume}_rip/buildData.asset`)
  if (!res.ok) throw new Error(`buildData for ${costume}: HTTP ${res.status}`)
  const b = (await res.json()).Base as {
    model: Ref
    physics?: Ref
    textures: Ref[]
    motions?: Ref[]
    expressions?: Ref[]
  }
  const path = (r: Ref) => rel(r.bundleName, r.fileName)

  // One motion group per motion name, so model.motion("nf05") works.
  const motions: Record<string, { file: string }[]> = {}
  for (const m of b.motions ?? []) {
    const name = m.fileName.replace(/\.mtn(\.bytes)?$/, "")
    motions[name] = [{ file: path(m) }]
  }

  return {
    // pixi-live2d-display resolves the paths below against this url
    url: new URL(`${BASE}/assets/jp/model.json`, location.origin).href,
    version: "Live2D Model Setting File",
    model: path(b.model),
    textures: b.textures.map(path),
    ...(b.physics ? { physics: path(b.physics) } : {}),
    motions,
    expressions: (b.expressions ?? []).map((e) => ({
      name: e.fileName.replace(/\.exp\.json$/, ""),
      file: path(e),
    })),
  }
}

/**
 * The motion Bestdori plays when a character appears: buildData.transition points to an .asset file
 * whose Base.defaultMotion is a motion name (the same name as in buildModelSettings' motion groups).
 * Returns undefined when there is none or it cannot be read.
 */
export async function fetchDefaultMotion(costume: string): Promise<string | undefined> {
  try {
    const res = await fetch(`${BASE}/assets/jp/live2d/chara/${costume}_rip/buildData.asset`)
    if (!res.ok) return undefined
    const transition = (await res.json()).Base?.transition as Ref | undefined
    if (!transition) return undefined
    const file = transition.fileName.endsWith(".asset") ? transition.fileName : `${transition.fileName}.asset`
    const res2 = await fetch(`${BASE}/assets/jp/${transition.bundleName}_rip/${file}`)
    if (!res2.ok) return undefined
    const name = (await res2.json()).Base?.defaultMotion
    return typeof name === "string" && name ? name : undefined
  } catch {
    return undefined
  }
}