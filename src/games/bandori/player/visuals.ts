import * as PIXI from "pixi.js"
import { backgroundUrl } from "@/games/bandori/bestdori/live2d"
import { effectFrameUrl } from "@/games/bandori/bestdori/playerAssets"
import { H, W, type Ctx } from "./types"

export const setBackground = async (ctx: Ctx, bundle: string, name: string) => {
  if (!bundle || !name) return
  try {
    const tex = await PIXI.Texture.fromURL(backgroundUrl(bundle, name))
    if (ctx.token.dead) return
    ctx.bg.texture = tex
    ctx.bg.anchor.set(0.5)
    // Bestdori: 110% of the stage width, centred, cropped by the stage.
    ctx.bg.scale.set((1.1 * W) / tex.width)
    ctx.bg.position.set(W / 2, H / 2)
  } catch (e) {
    console.warn("[bandori-player] background failed", bundle, name, e)
  }
}

export const showFrame = async (ctx: Ctx, sub: string) => {
  const url = effectFrameUrl(sub)
  if (!url) return
  try {
    const tex = await PIXI.Texture.fromURL(url)
    if (ctx.token.dead) return
    const f = ctx.frameSprite
    f.texture = tex
    f.width = W
    f.height = H
    f.alpha = 0
    f.visible = true
    await ctx.clock.tween(0.3, (t) => (f.alpha = t))
  } catch (e) {
    console.warn("[bandori-player] effect frame failed", sub, e)
  }
}

export const hideFrame = async (ctx: Ctx) => {
  const f = ctx.frameSprite
  if (!f.visible) return
  await ctx.clock.tween(0.3, (t) => (f.alpha = 1 - t))
  f.visible = false
}