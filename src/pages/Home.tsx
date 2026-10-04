import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { createStory, deleteStory, exportStory, importStoryFile, listStories, saveStory } from "@/lib/editor/store";
import type { Story } from "@/lib/editor/types";

export default function Home() {
  const [stories, setStories] = useState<Story[]>([]);
  const navigate = useNavigate();
  const refresh = () => listStories().then(setStories);
  useEffect(() => { refresh(); }, []);

  async function onNew() {
    const s = createStory();
    await saveStory(s);
    navigate(`/story/${s.id}/info`);
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex gap-3">
        <button onClick={onNew}>New story</button>
        <label className="cursor-pointer">
          Import
          <input type="file" accept=".json" hidden onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) { await importStoryFile(f); refresh(); }
            e.target.value = "";
          }} />
        </label>
      </div>
      <ul className="space-y-2">
        {stories.map((s) => (
          <li key={s.id} className="flex gap-3 items-center">
            <Link to={`/story/${s.id}/edit`}>{s.title}</Link>
            <button onClick={() => exportStory(s)}>Export</button>
            <button onClick={async () => { await deleteStory(s.id); refresh(); }}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}