const BASE: string = import.meta.env.VITE_BESTDORI_BASE ?? "/bestdori"

/** Bestdori serves files without the ".bytes" suffix, in "{bundle}_rip" folders. */
const rel = (bundle: string, file: string) => `${bundle}_rip/${file.replace(/\.bytes$/, "")}`

export const assetUrl = (bundle: string, file: string) =>
  `${BASE}/assets/jp/${rel(bundle, file)}`

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