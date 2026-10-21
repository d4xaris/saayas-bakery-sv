import type { GroupId } from "./birthdays";

export type StoryLine = {
  id: string
  key?: string // String(row.i) from the game script (imported mode)
  textId?: string // AdvTextID, to detect upstream changes later
  speaker: string // original speaker name; keys Story.names
  original: string
  reference?: string // official English, read-only
  translated: string
  voice?: string // Girls Band Party voice id, e.g. "event319-01-001"
}

export type BandoriSource = {
  server: "jp" | "en" | "tw" | "cn" | "kr"
  eventId: number // 0 for a card story
  scenarioId: string // e.g. "event319-01", or "episode1729" / "memorial1729" for a card story
  folder: string // e.g. "event319_rip", or "res004061_rip" for a card story
  /** Set for a card story: the card's resource set holds its scenarios and voices. */
  card?: {
    id: number
    resourceSetName: string // e.g. "res004061"
    episodeType: string // "standard" (episode 1) or "memorial" (episode 2)
  }
}

export type Story = {
  id: string
  title: string
  summary: string
  source?: { advId: number }
  bandori?: BandoriSource // Girls Band Party imports
  language: string
  names: Record<string, string>
  speakerRef?: Record<string, string>
  lines: StoryLine[]
  createdAt: number
  updatedAt: number
  publishedAt?: number
  labels?: StoryLabel[]
  episodeTitle?: { original: string; reference: string; translated: string }
  game: GroupId;
}

export type StoryLabel = {
  key: string       // the command index "i" in episode.json
  textId: string    // AdvTextID, for the text table
  original: string
  reference: string // official English
  translated: string
}