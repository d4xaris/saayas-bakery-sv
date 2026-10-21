// src/games/bandori/bestdori/viewerSpec.ts
// Numbers, enums and formulas ported from Bestdori's story viewer
// (ToolStoryViewerSingle bundle, component MyStoryPlayerFull).
// Pure functions, no dependencies except the CSSProperties type.

import type { CSSProperties } from "react";

/* ---------- enums (index in the array = value in the scenario JSON) ---------- */

export const SIDE = [
  "none", "left", "leftOver", "leftInside", "center", "right", "rightOver",
  "rightInside", "leftUnder", "leftInsideUnder", "centerUnder", "rightUnder", "rightInsideUnder",
] as const;

export type SideName = (typeof SIDE)[number];

/* ---------- timing ---------- */

export const TEXT_CHARS_PER_SECOND = 15;
export const AUTO_INTERVALS_MS = [0, 500, 1000, 2000, 5000]; // default index 1 = 500 ms
export const APPEAR_MS = 250;
export const MOVE_MS = 250;
export const HIDE_MS = 200;
export const TELOP_FADE_MS = 500;

/* ---------- stage ---------- */




/** Horizontal position of a character in model units (0 = centre of the stage). */
export function sideToX(side: SideName, offsetX = 0): number {
  const a = offsetX / 640;
  switch (side) {
    case "leftOver": return a - 1.2;
    case "rightOver": return a + 1.2;
    case "left": case "leftUnder": case "leftInside": case "leftInsideUnder": return a - 0.34;
    case "right": case "rightUnder": case "rightInside": case "rightInsideUnder": return a + 0.34;
    default: return a; // none, center, centerUnder
  }
}

/* ---------- talk window ---------- */

export function talkStyles(W: number, H: number, textSize = 1) {
  const textW = 0.795 * W;
  const textH = 0.205 * H;
  const textLeft = (W - textW) / 2;
  const textTop = 0.965 * H - textH;
  const nameW = 0.245 * W;
  const nameH = 0.068 * H;
  const nameBorder = 0.04 * nameH;

  const box: CSSProperties = {
    boxSizing: "border-box",
    position: "absolute",
    left: textLeft,
    top: textTop,
    width: textW,
    height: textH,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderRadius: 0.115 * textH,
    boxShadow: `0 ${0.04 * textH}px ${0.04 * textH}px rgba(0, 0, 0, 0.2)`,
    padding: 0.175 * textH,
    color: "rgba(80, 80, 80, 1)",
    fontSize: 0.15 * textH * textSize,
    fontWeight: 600,
  };

  const name: CSSProperties = {
    boxSizing: "border-box",
    position: "absolute",
    left: textLeft,
    top: textTop - 0.68 * nameH,
    width: nameW,
    height: nameH,
    backgroundColor: "rgba(255, 59, 114, 1)",
    borderStyle: "solid",
    borderColor: "rgba(255, 255, 255, 1)",
    borderWidth: nameBorder,
    borderRadius: `${nameH / 2}px 0 0 ${nameH / 2}px`,
    padding: `0 ${0.52 * nameH}px`,
    color: "rgba(255, 255, 255, 1)",
    fontSize: 0.45 * nameH * textSize,
    fontWeight: 600,
    whiteSpace: "nowrap",
    overflow: "hidden",
    lineHeight: `${nameH - 2 * nameBorder}px`,
  };

  return { box, name };
}

/* ---------- telop (location card) ---------- */

export type TelopState = "fadeIn" | "wait" | "fadeOut";

/** progress 0..1 inside fadeIn / fadeOut, ignored in wait. */
export function telopStyles(W: number, H: number, state: TelopState, progress: number, textSize = 1) {
  const ow = 0.655 * W, oh = 0.105 * H, os = 0.075 * oh;
  const iw = 0.6 * W, ih = 0.08 * H, is = 0.06 * ih;

  let alpha = 1, tilt = -1, dx = 0;
  if (state === "fadeIn") {
    alpha = progress;
    tilt = 1 - 2 * progress;
    dx = ((W - ow) / 3) * (1 - progress);
  } else if (state === "fadeOut") {
    alpha = 1 - progress;
    tilt = 2 * progress - 1;
    dx = (-(W - ow) / 3) * progress;
  }

  const outer: CSSProperties = {
    boxSizing: "border-box",
    position: "absolute",
    left: (W - ow) / 2 + dx,
    top: (H - oh) / 2,
    width: ow,
    height: oh,
    backgroundColor: `rgba(255, 59, 114, ${0.9 * alpha})`,
    borderRadius: oh / 2,
    boxShadow: `0 ${os}px ${os}px rgba(0, 0, 0, ${0.2 * alpha})`,
    transform: `rotate(${tilt}deg)`,
  };

  const inner: CSSProperties = {
    boxSizing: "border-box",
    position: "absolute",
    left: (W - iw) / 2 + dx,
    top: (H - ih) / 2 - is,
    width: iw,
    height: ih,
    backgroundColor: `rgba(255, 255, 255, ${alpha})`,
    borderRadius: ih / 2,
    boxShadow: `0 ${is}px rgba(0, 0, 0, ${0.2 * alpha})`,
    color: `rgba(80, 80, 80, ${alpha})`,
    fontSize: (ih / 2) * textSize,
    fontWeight: 600,
    lineHeight: `${ih}px`,
    textAlign: "center",
  };

  return { outer, inner };
}

/* ---------- Live2D (Cubism 2) ---------- */


/** Mouth value 0..1 from playback seconds (or from elapsed time when there is no voice). */
export const mouthOpen = (seconds: number) => Math.abs((seconds % 0.4) - 0.2) / 0.2;







