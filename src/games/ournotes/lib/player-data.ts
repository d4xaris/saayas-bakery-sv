import { assetConfig } from "@/config/assets";

/** The story player's data: the story site's index entries and the episodes the page knows from the build. */

/** The story languages of ournotes-player (the site's language codes, as the asset server's). */
const STORY_LANGUAGES = ["ja", "en", "zh-Hant", "zh-Hans", "ko"] as const;
export type StoryLanguage = typeof STORY_LANGUAGES[number];

/**
 * The story sites' roots, in precedence order: the international site (TW/HK/MO, every text language), then JP (its own
 * site: JP Live2D model ids overlap the international ones). An episode on more than one plays from the first.
 */
export function getStorySiteRoots(): string[] {
  return [...new Set([assetConfig.storySite, assetConfig.storySiteJp].filter(Boolean))];
}

/** A `stories.json` entry (ournotes.stories/1) as the player page reads it. */
export interface StorySiteEntry {
  id: string;
  advId: number;
  /** The story site the entry comes from (a root of getStorySiteRoots); its manifest and files are under it. */
  root: string;
  /** The manifest path under the site root (`stories/<advId>.json`). */
  manifest: string;
  /** Episode titles by story language. */
  titles: Partial<Record<string, string>>;
  languages: string[];
  /** The default language of the story. */
  language: string;
  /** 0: the story screen; 1: Overlay (home spot and post-live talks in their host screen). */
  playbackMode: number;
  audio: boolean;
  /** Download sizes in bytes: the files every language loads, and each language's own. */
  size?: { common: number; languages: Partial<Record<string, number>> };
}







export function getStoriesIndexUrl(root: string): string {
  return `${root}/stories.json`;
}

/** A manifest path of a site's index, resolved against that site's root. */
export function getStoryManifestUrl(root: string, manifest: string): string {
  return `${root}/${manifest.replace(/^\/+/, "")}`;
}

/**
 * The sites' indexes as one list, in site order: an advId a site before lists is left out of the later ones (the
 * international site has every text language; JP only Japanese).
 */
export function mergeStorySiteEntries(sites: readonly (readonly StorySiteEntry[])[]): StorySiteEntry[] {
  const seen = new Set<number>();
  const merged: StorySiteEntry[] = [];
  for (const entries of sites) {
    for (const entry of entries) {
      if (seen.has(entry.advId)) continue;
      seen.add(entry.advId);
      merged.push(entry);
    }
  }
  return merged;
}







export function formatMegabytes(bytes: number): string {
  return `${(bytes / 1048576).toFixed(bytes >= 100 * 1048576 ? 0 : 1)} MB`;
}



