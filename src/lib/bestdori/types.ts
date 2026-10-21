export type Server = "jp" | "en" | "tw" | "cn" | "kr";

// Arrays from Bestdori are ordered JP, EN, TW, CN, KR.
export const SERVER_INDEX: Record<Server, number> = { jp: 0, en: 1, tw: 2, cn: 3, kr: 4 };

export type Localized = (string | null)[];

export interface EventSummary {
  id: number;
  names: Localized;
  startAt: (string | null)[];
  bundle: string // assetBundleName per server (index 1 = EN); "" if missing
}

export interface EventChapter {
  scenarioId: string;
  caption: Localized;
  title: Localized;
  synopsis: Localized;
}

/** A card as the card picker lists it (a small part of Bestdori's cards/all.5.json). */
export interface CardSummary {
  id: number;
  characterId: number;
  /** Stars, 1 to 5. Cards of 3 to 5 stars have stories (the newest 3-star event cards do not). */
  rarity: number;
  /** permanent, event, limited, dreamfes, kirafes, birthday, special, campaign, others, initial */
  type: string;
  attribute: string;
  /** The folder of the card's art, stories and voices: res004061 for card 1729. */
  resourceSetName: string;
  /** The card's title ("prefix") per server. */
  names: Localized;
  releasedAt: (string | null)[];
}

export interface CharacterInfo {
  names: Localized;
  bandId: number;
  /** unique, common or another. */
  type: string;
}

/** One of a card's stories: "standard" is episode 1 and "memorial" is episode 2. */
export interface CardEpisode {
  scenarioId: string;
  episodeType: string;
  title: Localized;
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