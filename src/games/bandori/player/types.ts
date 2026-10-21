import type * as PIXI from "pixi.js"
import type { Story } from "@/editor/lib/types"
import type { TelopState } from "@/games/bandori/bestdori/viewerSpec"
import type { Clock } from "./clock"
import type { AudioBank } from "./audio"

// 16:9, the same screen shape as Bestdori's story viewer (its layout numbers depend on it).
export const W = 1280
export const H = 720

export type Phase = "loading" | "ready" | "playing" | "ended" | "error"
export interface Dialog { name: string; text: string }
export interface Telop { text: string; state: TelopState; progress: number }

interface EngineUi {
  setPhase(p: Phase): void
  setInfo(s: string): void
  setDialog(d: Dialog | null): void
  setTelop(t: Telop | null): void
  /** line: 0-based index of the current line (-1 before the start); total: number of lines */
  setLine(line: number, total: number): void
}

export interface EngineOptions {
  host: HTMLElement
  getStory: () => Story
  ui: EngineUi
  isAuto: () => boolean
}

export interface Engine {
  start(): void
  advance(): void
  pause(): void
  resume(): void
  isPaused(): boolean
  /** master volume 0..1 for music, effects and voice */
  setVolume(level: number): void
  dispose(): void
}

type BandoriSource = NonNullable<Story["bandori"]>

/** Everything the engine's parts share. */
export interface Ctx {
  token: { dead: boolean }
  b: BandoriSource
  getStory: () => Story
  ui: EngineUi
  isAuto: () => boolean

  app: PIXI.Application
  bg: PIXI.Sprite
  charLayer: PIXI.Container
  frameSprite: PIXI.Sprite
  overlay: PIXI.Graphics

  models: Map<string, any> // costume -> model
  charCostume: Map<number, string> // characterId -> current costume
  defaultMotions: Map<any, string> // model -> its Bestdori "defaultMotion" name
  fades: Map<any, number> // model -> current mesh opacity (Bestdori's setAlpha)
  restX: Map<any, number> // model -> the x it rests at

  clock: Clock
  audio: AudioBank
  /** The function a click calls: ends the current wait (line or location card). */
  advance: { fn: (() => void) | null }
  talk: { no: number; total: number }
}