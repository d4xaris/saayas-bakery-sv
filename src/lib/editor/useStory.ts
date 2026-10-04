import { useCallback, useEffect, useRef, useState } from "react";
import { loadStory, saveStory } from "./store";
import type { Story } from "./types";

export function useStory(id: string | undefined) {
  const [story, setStory] = useState<Story | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef<Story | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    if (!id) { setStatus("missing"); return; }
    loadStory(id).then((s) => {
      if (cancelled) return;
      if (s) { latest.current = s; setStory(s); setStatus("ready"); }
      else setStatus("missing");
    });
    return () => { cancelled = true; };
  }, [id]);

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    if (latest.current) await saveStory(latest.current);
  }, []);

  // Save pending edits when leaving the page.
  useEffect(() => () => { void flush(); }, [flush]);

  const update = useCallback((patch: Partial<Story> | ((s: Story) => Story)) => {
    const prev = latest.current;
    if (!prev) return;
    const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
    latest.current = next;
    setStory(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void saveStory(next), 400);
  }, []);

  return { story, status, update, flush };
}