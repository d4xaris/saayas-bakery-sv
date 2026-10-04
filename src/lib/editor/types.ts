export type StoryLine = {
  id: string;
  speaker: string;
  original: string;
  translated: string;
};

export type Story = {
  id: string;
  title: string;
  summary: string;
  source?: { advId: number };
  language: string; // "en" now, "ja" later
  names: Record<string, string>;
  lines: StoryLine[];
  createdAt: number;
  updatedAt: number;
};