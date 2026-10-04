import latinUrl from "@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff2?url"
import cyrillicUrl from "@fontsource/noto-sans/files/noto-sans-cyrillic-400-normal.woff2?url"

export const UK_FONT_NAME = "Noto Sans Cyrillic Fallback"
export const UK_TEXTURE_NAME = "font_Noto Sans Cyrillic Fallback_0"
export const UK_TEXTURE_FILE = "fonts/uk_fallback_v2.png" // relative to ui/
export const UK_MANIFEST_PATH = "ui/fonts/uk_fallback_v2.png"
export const UK_ASSET = "assets/uk_fallback_v2.png"

/**
 * Orientation of rect.m_Y in the game's atlases is not verified.
 * false = counted from the bottom of the PNG (Unity convention).
 * If letters come out upside down, blank or garbled, flip this.
 */
const Y_FROM_TOP = false

const POINT = 40 // same as the game's fonts
const PADDING = 4 // atlasPadding
const PAD = PADDING + 1 // gradient scale 5
const W = 2048
const INF = 1e20
/** Glyphs are drawn this many times larger, the distance field is computed there and averaged down. */
const SS = 4

export type UkFont = { png: Uint8Array; width: number; height: number; glyphs: any; characters: any }

const isCyr = (cp: number) => (cp >= 0x400 && cp <= 0x4ff) || cp === 0x2116 || cp === 0x301

function charset(): number[] {
  const s = new Set<number>()
  for (let c = 0x20; c <= 0x7e; c++) s.add(c)
  for (const ch of "АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯабвгґдеєжзиіїйклмнопрстуфхцчшщьюя№«»“”‘’„–—…•°±×·ʼ\u00a0") {
    s.add(ch.codePointAt(0)!)
  }
  return [...s]
}

// Felzenszwalb squared Euclidean distance transform
function edt1d(f: Float64Array, n: number, out: Float64Array, v: Int32Array, z: Float64Array) {
  let k = 0
  v[0] = 0
  z[0] = -INF
  z[1] = INF
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    while (s <= z[k]) {
      k--
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    }
    k++
    v[k] = q
    z[k] = s
    z[k + 1] = INF
  }
  k = 0
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++
    const dq = q - v[k]
    out[q] = dq * dq + f[v[k]]
  }
}

function edt(grid: Float64Array, w: number, h: number) {
  const n = Math.max(w, h)
  const f = new Float64Array(n)
  const d = new Float64Array(n)
  const v = new Int32Array(n)
  const z = new Float64Array(n + 1)
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x]
    edt1d(f, h, d, v, z)
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y]
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x]
    edt1d(f, w, d, v, z)
    for (let x = 0; x < w; x++) grid[y * w + x] = d[x]
  }
}

/**
 * rgba is the glyph drawn SS times larger (cw*SS by ch*SS pixels). Returns the cw*ch alpha channel using the game's
 * mapping: alpha8 = round(255 * clamp01(0.5 + (dIn - dOut) / (2 * (padding + 1)))), distances in atlas pixels.
 */
function sdfAlpha(rgba: Uint8ClampedArray, cw: number, ch: number): Uint8Array {
  const w = cw * SS
  const h = ch * SS
  const n = w * h
  const outer = new Float64Array(n)
  const inner = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const inside = rgba[i * 4 + 3] > 127
    outer[i] = inside ? 0 : INF
    inner[i] = inside ? INF : 0
  }
  edt(outer, w, h)
  edt(inner, w, h)

  const out = new Uint8Array(cw * ch)
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      let sum = 0
      for (let dy = 0; dy < SS; dy++) {
        for (let dx = 0; dx < SS; dx++) {
          const i = (y * SS + dy) * w + x * SS + dx
          const dOut = Math.sqrt(outer[i])
          const dIn = Math.sqrt(inner[i])
          // signed distance to the edge (outside positive), in big pixels; the edge lies half a pixel from the centres
          sum += dOut > 0 ? dOut - 0.5 : -(dIn - 0.5)
        }
      }
      const dist = sum / (SS * SS) / SS // atlas pixels
      out[y * cw + x] = Math.round(255 * Math.min(1, Math.max(0, 0.5 - dist / (2 * PAD))))
    }
  }
  return out
}

type Cell = {
  cp: number
  adv: number
  left: number
  top: number
  rw: number
  rh: number
  cw: number
  ch: number
  alpha: Uint8Array | null
  x: number
  y: number
}

let cached: Promise<UkFont> | null = null
export const buildUkFont = () => (cached ??= build())

async function build(): Promise<UkFont> {
  const latin = new FontFace("UkSansLatin", `url(${latinUrl})`)
  const cyr = new FontFace("UkSansCyr", `url(${cyrillicUrl})`)
  await Promise.all([latin.load(), cyr.load()])
  document.fonts.add(latin)
  document.fonts.add(cyr)

  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!
  const cells: Cell[] = []

  for (const cp of charset()) {
    const ch = String.fromCodePoint(cp)
    const family = isCyr(cp) ? "UkSansCyr" : "UkSansLatin"

    // metrics at the atlas size
    canvas.width = 1
    canvas.height = 1
    ctx.font = `${POINT}px ${family}`
    const m = ctx.measureText(ch)
    const cell: Cell = { cp, adv: m.width, left: 0, top: 0, rw: 0, rh: 0, cw: 0, ch: 0, alpha: null, x: 0, y: 0 }
    const mw = m.actualBoundingBoxLeft + m.actualBoundingBoxRight
    const mh = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent
    if (mw > 0 && mh > 0) {
      cell.left = Math.floor(-m.actualBoundingBoxLeft)
      const right = Math.ceil(m.actualBoundingBoxRight)
      cell.top = Math.ceil(m.actualBoundingBoxAscent)
      const bottom = Math.ceil(m.actualBoundingBoxDescent)
      cell.rw = right - cell.left
      cell.rh = cell.top + bottom
      cell.cw = cell.rw + 2 * PAD
      cell.ch = cell.rh + 2 * PAD

      // the same box drawn SS times larger
      canvas.width = cell.cw * SS // resets the context state
      canvas.height = cell.ch * SS
      ctx.font = `${POINT * SS}px ${family}`
      ctx.fillStyle = "#fff"
      ctx.textAlign = "left"
      ctx.textBaseline = "alphabetic"
      ctx.fillText(ch, (PAD - cell.left) * SS, (PAD + cell.top) * SS)
      cell.alpha = sdfAlpha(ctx.getImageData(0, 0, canvas.width, canvas.height).data, cell.cw, cell.ch)
    }
    cells.push(cell)
  }

  // shelf packing
  let x = 1
  let y = 1
  let rowH = 0
  for (const c of cells) {
    if (!c.alpha) continue
    if (x + c.cw + 1 > W) {
      x = 1
      y += rowH + 1
      rowH = 0
    }
    c.x = x
    c.y = y
    x += c.cw + 1
    rowH = Math.max(rowH, c.ch)
  }
  const H = y + rowH + 1

  // RGB white, the distance in alpha
  const px = new Uint8ClampedArray(W * H * 4)
  for (const c of cells) {
    if (!c.alpha) continue
    for (let j = 0; j < c.ch; j++) {
      for (let i = 0; i < c.cw; i++) {
        const idx = ((c.y + j) * W + c.x + i) * 4
        px[idx] = px[idx + 1] = px[idx + 2] = 255
        px[idx + 3] = c.alpha[j * c.cw + i]
      }
    }
  }
  const out = document.createElement("canvas")
  out.width = W
  out.height = H
  out.getContext("2d")!.putImageData(new ImageData(px as any, W, H), 0, 0)
  const blob = await new Promise<Blob>((res, rej) =>
    out.toBlob((b) => (b ? res(b) : rej(new Error("PNG encode failed"))), "image/png"),
  )
  const png = new Uint8Array(await blob.arrayBuffer())

  const glyphs: Record<string, any> = {}
  const characters: Record<string, any> = {}
  cells.forEach((c, id) => {
    const topRow = c.y + PAD
    glyphs[String(id)] = {
      atlasIndex: 0,
      metrics: {
        m_Height: c.rh,
        m_HorizontalAdvance: c.adv,
        m_HorizontalBearingX: c.left,
        m_HorizontalBearingY: c.top,
        m_Width: c.rw,
      },
      packed: { dx: 0, dy: 0, texture: UK_TEXTURE_NAME },
      rect: c.alpha
        ? { m_Height: c.rh, m_Width: c.rw, m_X: c.x + PAD, m_Y: Y_FROM_TOP ? topRow : H - topRow - c.rh }
        : { m_Height: 0, m_Width: 0, m_X: 0, m_Y: 0 },
      scale: 1,
    }
    characters[String(c.cp)] = { elementType: 1, glyph: id, scale: 1 }
  })

  return { png, width: W, height: H, glyphs, characters }
}

/** Registers the fallback font, its texture, its materials and the fallbacks entries in a parsed ui/fonts.json. */
export function addFallbackFont(fonts: any, uk: UkFont) {
  const baseFont: any = Object.values(fonts.fonts)[0]
  const baseTex: any = Object.values(fonts.textures)[0]

  fonts.fonts[UK_FONT_NAME] = {
    atlasHeight: uk.height,
    atlasPadding: PADDING,
    atlasPopulationMode: 0,
    atlasRenderMode: 8230,
    atlasWidth: uk.width,
    atlases: [UK_TEXTURE_NAME],
    boldSpacing: 0,
    boldStyle: 0.9,
    characters: uk.characters,
    faceInfo: { ...baseFont.faceInfo, m_FamilyName: "Noto Sans", m_PointSize: POINT, m_Scale: 1 },
    fallbacks: [],
    glyphs: uk.glyphs,
    italicStyle: 35,
    material: `${UK_FONT_NAME} Material`,
    normalSpacingOffset: 0,
    normalStyle: 0,
    runtimeCharacters: [],
    runtimeGlyphs: null,
    source: { family: "Noto Sans", license: "http://scripts.sil.org/OFL", generator: "browser canvas + EDT" },
    subset: "Ukrainian, Basic Latin and common punctuation",
    tabSize: 10,
  }

  fonts.textures[UK_TEXTURE_NAME] = {
    ...baseTex,
    name: UK_TEXTURE_NAME,
    width: uk.width,
    height: uk.height,
    mipCount: 1,
    texture: UK_TEXTURE_FILE,
  }

  fonts.materialKeywords ??= {}
  const clones: Record<string, any> = {}
  for (const [key, m] of Object.entries<any>(fonts.materials)) {
    if (key.includes(" + ")) continue
    const name = `${key} + ${UK_FONT_NAME}`
    const c = structuredClone(m)
    c.material = name
    c.baseName = m.baseName || key
    if (c.floats) {
      c.floats._TextureWidth = uk.width
      c.floats._TextureHeight = uk.height
    }
    const main = c.textures?._MainTex
    if (main?.texture) main.texture = { ...main.texture, name: UK_TEXTURE_NAME, width: uk.width, height: uk.height }
    clones[name] = c
    if (fonts.materialKeywords[key]) fonts.materialKeywords[name] = fonts.materialKeywords[key]
  }
  Object.assign(fonts.materials, clones)
  const first: any = Object.values(clones)[0]
  if (first) fonts.materials[`${UK_FONT_NAME} Material`] = { ...structuredClone(first), material: `${UK_FONT_NAME} Material` }

  for (const [name, f] of Object.entries<any>(fonts.fonts)) {
    if (name === UK_FONT_NAME) continue
    f.fallbacks = [...(f.fallbacks ?? []), UK_FONT_NAME]
  }
}