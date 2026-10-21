import { storageKeys } from "@/config/storage";
import { safeGetLocalStorage } from "@/shared/lib/safe-storage";

let nativeFetchRef: typeof globalThis.fetch | null = null;

/** The browser's own fetch, bound once and reused. */
export function getNativeFetch(): typeof globalThis.fetch {
  if (nativeFetchRef) return nativeFetchRef;
  nativeFetchRef = globalThis.fetch.bind(globalThis);
  return nativeFetchRef;
}

/** The developer switch (`storageKeys.assetCacheBypass` set to "true") that sends every request to the network. */
export function isAssetCacheBypassed(): boolean {
  return safeGetLocalStorage(storageKeys.assetCacheBypass) === "true";
}
