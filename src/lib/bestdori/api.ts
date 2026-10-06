import { get, set } from "idb-keyval";
import {
  BestdoriError,
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
    // Bestdori sometimes answers with the plain word "error"
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
  return cached("events:all", 6 * HOUR, async () => {
    const raw = await fetchJson(`${BASE}/api/events/all.5.json`);
    return Object.entries(raw as Record<string, any>)
      .map(([id, e]) => ({
        id: Number(id),
        names: (e.eventName ?? []) as Localized,
        startAt: (e.startAt ?? []) as (string | null)[],
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