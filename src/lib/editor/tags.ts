const TAG_RE = /<\/?[a-zA-Z][^>]*>/g;

function normalize(tag: string): string {
  return tag.replace(/\s+/g, "").toLowerCase();
}

/** Opening tags only (closing tags are optional in the game data). */
export function openingTags(text: string): string[] {
  return (text.match(TAG_RE) ?? [])
    .filter((t) => !t.startsWith("</"))
    .map(normalize);
}

export type TagCheck = {
  ok: boolean;
  missing: string[];
  extra: string[];
};

function count(list: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of list) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

/** Compares the tag multiset of the translation against the reference. */
export function checkTags(reference: string, translated: string): TagCheck {
  if (!translated.trim()) return { ok: true, missing: [], extra: [] };
  const want = count(openingTags(reference));
  const have = count(openingTags(translated));
  const missing: string[] = [];
  const extra: string[] = [];
  for (const [t, n] of want) {
    const diff = n - (have.get(t) ?? 0);
    for (let i = 0; i < diff; i++) missing.push(t);
  }
  for (const [t, n] of have) {
    const diff = n - (want.get(t) ?? 0);
    for (let i = 0; i < diff; i++) extra.push(t);
  }
  return { ok: missing.length === 0 && extra.length === 0, missing, extra };
}

export function describeTagCheck(c: TagCheck): string {
  const parts: string[] = [];
  if (c.missing.length) parts.push(`бракує: ${c.missing.join(" ")}`);
  if (c.extra.length) parts.push(`зайве: ${c.extra.join(" ")}`);
  return parts.join("; ");
}

/** True if the reference contains any formatting tags worth copying. */
export function hasTags(text: string): boolean {
  return (text.match(TAG_RE) ?? []).length > 0;
}
