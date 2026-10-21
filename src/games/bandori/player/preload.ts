import * as PIXI from "pixi.js"
import { backgroundUrl } from "@/games/bandori/bestdori/live2d"
import { bgmUrl, seUrl, voiceUrl } from "@/games/bandori/bestdori/playerAssets"
import type { Scenario } from "@/games/bandori/bestdori/timeline"
import { audioBlobs } from "./audio"
import { pool } from "./helpers"
import type { Ctx } from "./types"

/** How many files / animation jobs are downloaded at the same time while loading (be nice to Bestdori). */
const PRELOAD_PARALLEL = 4

type Needs = { motions: Set<string>; expressions: Set<string> }

/** Which motions and expressions each costume will be asked for. */
const collectAnimations = (scenario: Scenario) => {
  const charCostumes = new Map<number, Set<string>>()
  for (const s of scenario.steps) {
    if (s.kind !== "layout" || !s.ref.costumeType) continue
    const id = Number(s.ref.characterId)
    if (!charCostumes.has(id)) charCostumes.set(id, new Set())
    charCostumes.get(id)!.add(String(s.ref.costumeType))
  }
  const need = new Map<string, Needs>()
  const add = (characterId: unknown, costume: unknown, motion: unknown, expression: unknown) => {
    const targets = costume ? [String(costume)] : [...(charCostumes.get(Number(characterId)) ?? [])]
    for (const c of targets) {
      let n = need.get(c)
      if (!n) {
        n = { motions: new Set(), expressions: new Set() }
        need.set(c, n)
      }
      if (motion) n.motions.add(String(motion))
      if (expression) n.expressions.add(String(expression))
    }
  }
  for (const s of scenario.steps) {
    if (s.kind === "layout") add(s.ref.characterId, s.ref.costumeType, s.ref.motionName, s.ref.expressionName)
    else if (s.kind === "talk") {
      for (const m of s.ref.motions ?? []) add(m.characterId, null, m.motionName, m.expressionName)
    }
  }
  return need
}

/** Every sound file the story uses. */
const collectAudioUrls = (ctx: Ctx, scenario: Scenario) => {
  const urls = new Set<string>()
  const add = (u?: string | null) => {
    if (u) urls.add(u)
  }
  if (scenario.firstBgm) add(bgmUrl(scenario.firstBgm))
  for (const s of scenario.steps) {
    if (s.kind === "sound") {
      const e = s.ref
      if (e.bgm) add(bgmUrl(String(e.bgm)))
      if (e.se && e.seBundleName) add(seUrl(String(e.seBundleName), String(e.se)))
    } else if (s.kind === "talk") {
      for (const v of s.ref.voices ?? []) {
        const id = String(v.voiceId ?? "")
        if (!id || id === "#NAME?") continue
        add(voiceUrl(ctx.b.scenarioId, id, ctx.b.card?.resourceSetName))
      }
    }
  }
  return [...urls]
}

/** Every background / still the story switches to. */
const collectBackgrounds = (scenario: Scenario) => {
  const out = new Map<string, [string, string]>()
  for (const s of scenario.steps) {
    if (s.kind !== "effect") continue
    const t = Number(s.ref.effectType)
    if (t !== 7 && t !== 11 && t !== 17) continue
    const bundle = String(s.ref.stringVal ?? "")
    const name = String(s.ref.stringValSub ?? "")
    if (bundle && name) out.set(`${bundle}/${name}`, [bundle, name])
  }
  return [...out.values()]
}

/**
 * Loads the motion and expression files of a model before it is needed.
 * Uses pixi-live2d-display internals (motionManager.loadMotion, expressionManager.getExpressionIndex /
 * loadExpression); their names were seen in cubism2.es.js. Each one is still checked before it is called.
 */
const preloadAnimations = async (ctx: Ctx, m: any, names: Needs, missing: string[], costume: string) => {
  const mm = m.internalModel?.motionManager
  const em = mm?.expressionManager
  for (const name of names.motions) {
    if (ctx.token.dead) return
    try {
      if (mm?.definitions && !mm.definitions[name]) {
        missing.push(`${costume}: motion ${name}`)
        continue
      }
      if (typeof mm?.loadMotion === "function") {
        const r = await mm.loadMotion(name, 0)
        if (!r) missing.push(`${costume}: motion ${name}`)
      }
    } catch {
      missing.push(`${costume}: motion ${name}`)
    }
  }
  for (const name of names.expressions) {
    if (ctx.token.dead) return
    try {
      if (typeof em?.getExpressionIndex === "function") {
        const idx = em.getExpressionIndex(name)
        if (typeof idx === "number" && idx < 0) {
          missing.push(`${costume}: expression ${name}`)
          continue
        }
        if (typeof em.loadExpression === "function") await em.loadExpression(idx)
      }
    } catch {
      missing.push(`${costume}: expression ${name}`)
    }
  }
}

/** Preloads everything the story will use, so nothing loads while it plays. */
export async function preloadAll(ctx: Ctx, scenario: Scenario) {
  if (audioBlobs.size > 300) {
    audioBlobs.forEach((u) => URL.revokeObjectURL(u))
    audioBlobs.clear()
  }
  const missing: string[] = []
  const failedFiles: string[] = []
  const jobs: Array<() => Promise<void>> = []

  const animNeeds = collectAnimations(scenario)
  for (const [costume, m] of ctx.models) {
    const dm = ctx.defaultMotions.get(m)
    if (!dm) continue
    let need = animNeeds.get(costume)
    if (!need) {
      need = { motions: new Set(), expressions: new Set() }
      animNeeds.set(costume, need)
    }
    need.motions.add(dm)
  }
  for (const [costume, names] of animNeeds) {
    const m = ctx.models.get(costume)
    if (m) jobs.push(() => preloadAnimations(ctx, m, names, missing, costume))
  }
  for (const url of collectAudioUrls(ctx, scenario)) {
    if (audioBlobs.has(url)) continue
    jobs.push(async () => {
      try {
        const r = await fetch(url)
        const type = r.headers.get("content-type") ?? ""
        // Bestdori answers 200 with text/html for files it does not have.
        if (!r.ok || type.includes("text/html")) {
          failedFiles.push(url)
          return
        }
        const blob = await r.blob()
        if (!ctx.token.dead) audioBlobs.set(url, URL.createObjectURL(blob))
      } catch {
        failedFiles.push(url)
      }
    })
  }
  for (const [bundle, name] of collectBackgrounds(scenario)) {
    jobs.push(async () => {
      try {
        await PIXI.Texture.fromURL(backgroundUrl(bundle, name))
      } catch {
        failedFiles.push(`${bundle}/${name}`)
      }
    })
  }

  let done = 0
  const total = jobs.length
  ctx.ui.setInfo(`Loading assets 0/${total}…`)
  await pool(
    jobs.map((job) => async () => {
      if (ctx.token.dead) return
      await job()
      done++
      ctx.ui.setInfo(`Loading assets ${done}/${total}…`)
    }),
    PRELOAD_PARALLEL,
  )
  if (missing.length) console.warn("[bandori-player] not in the model settings / failed to load:", missing)
  if (failedFiles.length) console.warn("[bandori-player] files that did not load:", failedFiles)
  return { missing, failedFiles }
}