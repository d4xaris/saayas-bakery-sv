export type Server = "jp" | "en" | "tw" | "cn" | "kr";

// Arrays from Bestdori are ordered JP, EN, TW, CN, KR.
export const SERVER_INDEX: Record<Server, number> = { jp: 0, en: 1, tw: 2, cn: 3, kr: 4 };

export type Localized = (string | null)[];

export interface EventSummary {
  id: number;
  names: Localized;
  startAt: (string | null)[];
}

export interface EventChapter {
  scenarioId: string;
  caption: Localized;
  title: Localized;
  synopsis: Localized;
}

export interface ParsedLine {
  key: string;
  speaker: string;
  speakerId?: number;
  text: string;
  voice?: string;
}

export type BestdoriErrorKind = "network" | "notfound" | "parse";

export class BestdoriError extends Error {
  kind: BestdoriErrorKind;
  constructor(kind: BestdoriErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

/** Pick the text for a server, falling back to JP. */
export function pick(arr: Localized | undefined, server: Server): string {
  if (!arr) return "";
  return arr[SERVER_INDEX[server]] ?? arr[0] ?? "";
}