import type { AppLocale } from "@/config/locales";

const ROUTES: Record<string, string> = {
  "story-player": "/play",
};

// Single-locale app: no locale prefix on paths.
export function localizePath(path: string, _locale?: AppLocale): string {
  return path;
}

export function getRoutePathById(id: string, _locale?: AppLocale): string {
  return ROUTES[id] ?? "/";
}

