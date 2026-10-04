import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  createStory,
  deleteStory,
  exportStory,
  importStoryFile,
  listStories,
  saveStory,
} from "@/lib/editor/store";
import type { Story } from "@/lib/editor/types";
import ConfirmDialog from "@/components/editor/ConfirmDialog";

export default function Home() {
  const [stories, setStories] = useState<Story[]>([]);
  const [toDelete, setToDelete] = useState<Story | null>(null);
  const navigate = useNavigate();

  const refresh = () => listStories().then(setStories);
  useEffect(() => {
    refresh();
  }, []);

  async function onNew() {
    const s = createStory();
    await saveStory(s);
    navigate(`/story/${s.id}/info`);
  }

  return (
    <div className="min-h-screen bg-[#383838] text-neutral-200">
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <h1 className="text-2xl font-semibold">Story editor</h1>

        <div className="flex gap-3">
          <button className="btn" onClick={onNew}>
            New story
          </button>
          <label className="btn">
            Import
            <input
              type="file"
              accept=".json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  try {
                    await importStoryFile(f);
                    refresh();
                  } catch {
                    alert("That file is not a valid story.");
                  }
                }
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {stories.length === 0 ? (
          <p className="text-neutral-400">No stories yet. Create one or import a file.</p>
        ) : (
          <ul className="space-y-2">
            {stories.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center gap-3 rounded border border-white/10 p-3"
              >
                <span className="flex-1">
                  {s.title || "Untitled story"}
                  {s.publishedAt && (
                    <span className="ml-2 text-xs text-green-400">completed</span>
                  )}
                </span>
                <Link className="btn" to={`/story/${s.id}/edit`}>
                  Edit
                </Link>
                {s.publishedAt && (
                  <Link className="btn" to={`/story/${s.id}/view`}>
                    View
                  </Link>
                )}
                <button className="btn" onClick={() => exportStory(s)}>
                  Export
                </button>
                <button className="btn btn-danger" onClick={() => setToDelete(s)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {toDelete && (
        <ConfirmDialog
          title="Delete story?"
          message={`"${toDelete.title || "Untitled story"}" will be removed from this browser. Export it first if you want a backup.`}
          onConfirm={async () => {
            await deleteStory(toDelete.id);
            setToDelete(null);
            refresh();
          }}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}