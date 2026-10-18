import { get, set } from "idb-keyval";
import {
  BestdoriError,
  type CardEpisode,
  type CardSummary,
  type CharacterInfo,
  type EventChapter,
  type EventSummary,
  type Localized,
} from "./types";

// Change this (e.g. to "/bestdori") only if the CORS test fails and you add a proxy.
const BASE: string = import.meta.env.VITE_BESTDORI_BASE ?? "https://bestdori.com";
const PREFIX = "bd:";
const MIN_GAP_MS = 400;

const HOUR = 3600_000;
const DAY = 24 * HOUR;

// ---- simple sequential rate limiter ----
let chain: Promise<unknown> = Promise.resolve();
let lastAt = 0;
function schedule<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = Math.max(0, lastAt + MIN_GAP_MS - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastAt = Date.now();
    return fn();
  });
  chain = run.catch(() => undefined);
  return run;
}

async function fetchJson(url: string): Promise<any> {
  let res: Response;
  try {
    res = await schedule(() => fetch(url));
  } catch {
    throw new BestdoriError(
      "network",
      "Could not reach Bestdori. Check your connection (or CORS if you are on localhost).",
    );
  }
  if (res.status === 404) throw new BestdoriError("notfound", "Not found (not released yet?).");
  if (!res.ok) throw new BestdoriError("network", `Bestdori answered HTTP ${res.status}.`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    // Bestdori sometimes answers with the plain word "error", or with its HTML page (status 200) for a missing file
    throw new BestdoriError("notfound", "Bestdori has no data for this request.");
  }
}

interface CacheEntry<T> {
  t: number;
  data: T;
}

async function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const k = PREFIX + key;
  try {
    const hit = (await get(k)) as CacheEntry<T> | undefined;
    if (hit && Date.now() - hit.t < ttl) return hit.data;
  } catch {
    /* cache is optional */
  }
  const data = await load();
  try {
    await set(k, { t: Date.now(), data } satisfies CacheEntry<T>);
  } catch {
    /* ignore quota errors */
  }
  return data;
}

// ---- events ----
export function fetchEvents(): Promise<EventSummary[]> {
  return cached("events:all:v3", 6 * HOUR, async () => {
    const raw = await fetchJson(`${BASE}/api/events/all.5.json`);
    return Object.entries(raw as Record<string, any>)
      .map(([id, e]) => ({
        id: Number(id),
        names: (e.eventName ?? []) as Localized,
        startAt: (e.startAt ?? []) as (string | null)[],
        bundle: typeof e.assetBundleName === "string" ? e.assetBundleName : "",
      }))
      .sort((a, b) => b.id - a.id);
  });
}

export function fetchEventChapters(eventId: number): Promise<EventChapter[]> {
  return cached(`event:${eventId}`, 6 * HOUR, async () => {
    const raw = await fetchJson(`${BASE}/api/events/${eventId}.json`);
    const stories = raw?.stories;
    if (!Array.isArray(stories)) {
      throw new BestdoriError("parse", "This event has no story list.");
    }
    return stories.map((s: any) => ({
      scenarioId: String(s.scenarioId),
      caption: s.caption ?? [],
      title: s.title ?? [],
      synopsis: s.synopsis ?? [],
    }));
  });
}

// Event story folders are always event{id}_rip (checked for events 290 and 319).
export const eventFolder = (eventId: number) => `event${eventId}_rip`;

// ---- scenario ----
export function fetchScenario(server: string, folder: string, scenarioId: string): Promise<any> {
  return cached(`scenario:${server}:${folder}:${scenarioId}`, 30 * DAY, () =>
    fetchJson(`${BASE}/assets/${server}/scenario/eventstory/${folder}/Scenario${scenarioId}.asset`),
  );
}

// ---- cards ----
// The list is large (about 2500 cards with stats), so only the fields the picker needs are kept in the cache.
export function fetchCards(): Promise<CardSummary[]> {
  return cached("cards:all", 6 * HOUR, async () => {
    const raw = await fetchJson(`${BASE}/api/cards/all.5.json`);
    return Object.entries(raw as Record<string, any>)
      .map(([id, c]): CardSummary => ({
        id: Number(id),
        characterId: Number(c.characterId),
        rarity: Number(c.rarity),
        type: String(c.type ?? ""),
        attribute: String(c.attribute ?? ""),
        resourceSetName: String(c.resourceSetName ?? ""),
        names: (c.prefix ?? []) as Localized,
        releasedAt: (c.releasedAt ?? []) as (string | null)[],
      }))
      .sort((a, b) => b.id - a.id);
  });
}

export function fetchCharacters(): Promise<Record<number, CharacterInfo>> {
  return cached("characters:all", 7 * DAY, async () => {
    const raw = await fetchJson(`${BASE}/api/characters/all.2.json`);
    const out: Record<number, CharacterInfo> = {};
    for (const [id, c] of Object.entries(raw as Record<string, any>)) {
      out[Number(id)] = {
        names: (c.characterName ?? []) as Localized,
        bandId: Number(c.bandId ?? 0),
        type: String(c.characterType ?? ""),
      };
    }
    return out;
  });
}

/** The card's episodes: usually two (standard, then memorial). Empty for cards that have no story. */
export function fetchCard(cardId: number): Promise<CardEpisode[]> {
  return cached(`card:${cardId}`, 6 * HOUR, async () => {
    const raw = await fetchJson(`${BASE}/api/cards/${cardId}.json`);
    const entries = raw?.episodes?.entries;
    if (!Array.isArray(entries)) return [];
    return entries.map((e: any): CardEpisode => ({
      scenarioId: String(e.scenarioId),
      episodeType: String(e.episodeType ?? ""),
      title: (e.title ?? []) as Localized,
    }));
  });
}

/** A card story's scenario. Card stories live under the card's resource set, not under an event folder. */
export function fetchCardScenario(server: string, resourceSetName: string, scenarioId: string): Promise<any> {
  return cached(`cardscenario:${server}:${resourceSetName}:${scenarioId}`, 30 * DAY, () =>
    fetchJson(`${BASE}/assets/${server}/characters/resourceset/${resourceSetName}_rip/Scenario${scenarioId}.asset`),
  );
}