export type StoryLine = {
  id: string
  key?: string // String(row.i) from the game script (imported mode)
  textId?: string // AdvTextID, to detect upstream changes later
  speaker: string // original speaker name; keys Story.names
  original: string
  reference?: string // official English, read-only
  translated: string
}

export type Story = {
  id: string
  title: string
  summary: string
  source?: { advId: number }
  language: string
  names: Record<string, string>
  lines: StoryLine[]
  createdAt: number
  updatedAt: number
  publishedAt?: number
}