import { assetConfig } from "@/config/assets";
import { createPlayerFileFetch } from "@/games/ournotes/cache/player-files";
import { loadCubismCore } from "@/games/ournotes/live2d/client";

/** Network side of the story player: the published story index, one story's presence and the page-side scripts. */

/**
 * The story player's fetch function: a story's files (its models' too) come from the browser's player file cache once
 * downloaded, so replaying an episode or switching its language downloads nothing again.
 */
export const storyPlayerFetch = createPlayerFileFetch("story");





/** What the page could load besides Cubism Core: missing optional scripts only take their part out of the story. */
export interface StoryRuntimes {
  motionSync: boolean;
  spine: boolean;
}

let optional: Promise<StoryRuntimes> | null = null;

/**
 * Live2D Cubism Core (required: without it a story does not load), then the optional MotionSync Core and Spine runtime
 * when the deployment names them (`assetConfig`). All are classic scripts defining globals, each its maker's software.
 */
export async function loadStoryRuntimes(): Promise<StoryRuntimes> {
  await loadCubismCore(assetConfig.cubismCore);
  optional ??= Promise.all([
    loadGlobalScript("Live2DCubismMotionSyncCore", assetConfig.motionSyncCore),
    loadGlobalScript("spine", assetConfig.spineRuntime),
  ]).then(([motionSync, spine]) => ({ motionSync, spine }));
  return optional;
}

/** Loads `url` once as a classic script; resolves to whether it defined `global` (false without a url or on failure). */
function loadGlobalScript(global: string, url: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (global in window) {
      resolve(true);
      return;
    }
    if (!url) {
      resolve(false);
      return;
    }
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.addEventListener("load", () => resolve(global in window));
    script.addEventListener("error", () => {
      script.remove();
      console.warn(`[story-player] ${global} could not be loaded from ${url}`);
      resolve(false);
    });
    document.head.append(script);
  });
}



