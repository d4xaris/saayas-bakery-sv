import type { ParsedLine } from "./types";

/**
 * Turns a raw scenario file into dialogue lines.
 * Walks `snippets` in order and takes actionType 1 entries as talk lines
 * (referenceIndex -> talkData). Checked on event 319: 36 talkData entries and
 * 36 actionType 1 snippets. Falls back to talkData order if the counts differ.
 */
export function parseScenario(raw: any, scenarioId: string): ParsedLine[] {
  const base = raw?.Base ?? raw;
  const talk: any[] = Array.isArray(base?.talkData) ? base.talkData : [];
  const snippets: any[] = Array.isArray(base?.snippets) ? base.snippets : [];

  const fromSnippets = snippets
    .filter((s) => s?.actionType === 1)
    .map((s) => talk[s.referenceIndex])
    .filter(Boolean);

  const ordered: any[] = fromSnippets.length === talk.length ? fromSnippets : talk;

  return ordered.map((t, i) => {
    const speakerId = t?.talkCharacters?.[0]?.characterId;
    return {
      key: `${scenarioId}:${i}`,
      speaker: String(t?.windowDisplayName ?? ""),
      speakerId: typeof speakerId === "number" ? speakerId : speakerId ? Number(speakerId) : undefined,
      text: String(t?.body ?? ""),
      voice: t?.voices?.[0]?.voiceId || undefined,
    };
  });
}

export interface ParsedLabel {
  key: string; // `${scenarioId}:fx${index}` (index in specialEffectData)
  index: number;
  text: string;
}

/**
 * Location / time cards: specialEffectData entries with effectType 8.
 * (effectType 8 = text card is a HYPOTHESIS from event 319-01.)
 */
export function parseLabels(raw: any, scenarioId: string): ParsedLabel[] {
  const base = raw?.Base ?? raw;
  const fx: any[] = Array.isArray(base?.specialEffectData) ? base.specialEffectData : [];
  const out: ParsedLabel[] = [];
  fx.forEach((e, index) => {
    if (e?.effectType === 8 && typeof e.stringVal === "string" && e.stringVal.trim()) {
      out.push({ key: `${scenarioId}:fx${index}`, index, text: e.stringVal });
    }
  });
  return out;
}