import { get, set, del, entries } from "idb-keyval";
import { GROUPS, type GroupId } from "./birthdays";
import type { Story } from "./types";

const PREFIX = "story:";
const key = (id: string) => PREFIX + id;

const isGame = (value: unknown): value is GroupId =>
  typeof value === "string" && value in GROUPS;

/** Stories saved before the game field existed count as Our Notes. */
function withDefaults(story: Story): Story {
  return { ...story, game: isGame(story.game) ? story.game : "ournotes" };
}

export function createStory(game: GroupId = "ournotes"): Story {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    game,
    title: "Untitled story",
    summary: "",
    language: "en",
    names: {},
    lines: [],
    createdAt: now,
    updatedAt: now,
  };
}

export async function saveStory(story: Story): Promise<void> {
  await set(key(story.id), { ...story, updatedAt: Date.now() });
}

export async function loadStory(id: string): Promise<Story | undefined> {
  const story = await get<Story>(key(id));
  return story ? withDefaults(story) : undefined;
}

export async function deleteStory(id: string): Promise<void> {
  await del(key(id));
}

export async function listStories(): Promise<Story[]> {
  const all = await entries<string, Story>();
  return all
    .filter(([k]) => typeof k === "string" && k.startsWith(PREFIX))
    .map(([, v]) => withDefaults(v))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function exportStory(story: Story) {
  const blob = new Blob([JSON.stringify(story, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${story.title.replace(/[^\w-]+/g, "_") || "story"}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importStoryFile(file: File): Promise<Story> {
  const data = JSON.parse(await file.text()) as Story;
  if (!data || !Array.isArray(data.lines)) throw new Error("Not a story file");
  // New id so an import never overwrites an existing story.
  const story = withDefaults({ ...data, id: crypto.randomUUID(), updatedAt: Date.now() });
  await saveStory(story);
  return story;
}