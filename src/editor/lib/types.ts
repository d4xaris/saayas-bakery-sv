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
  /** Phone messages (Our Notes ChatTalk / ChatTyping commands). */
  chats?: StoryChat[]
  /**
   * Translated nicknames and chat names for the phone messages.
   * Key "s:" + sender name (original) or "w:" + chat window name (original).
   */
  chatNames?: Record<string, string>
  /** On-screen subtitles (Our Notes Subtitles commands that carry text). */
  subtitles?: StorySubtitle[]
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

/** One phone message, in the order it appears in the episode. */
export type StoryChat = {
  key: string // the command index "i" in episode.json
  textId: string // AdvTextID
  kind: "message" | "typing" // ChatTalk | ChatTyping
  /** typing only: a later message in the same window starts with this text, so it needs no translation of its own */
  covered?: boolean
  windowId: string // id of the ChatWindow command this belongs to
  windowName: string
  windowNameReference: string
  sender: string
  senderReference: string
  original: string
  reference: string // official English
  translated: string
}

export type StorySubtitle = {
  key: string // the command index "i" in episode.json
  textId: string // AdvTextID
  speaker: string // TargetName from the command (may be empty)
  original: string
  reference: string // official English
  translated: string
}