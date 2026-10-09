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
import { GROUPS, type GroupId } from "@/lib/editor/birthdays";
import ConfirmDialog from "@/components/editor/ConfirmDialog";
import NewStoryDialog from "@/components/editor/NewStoryDialog";

export default function Home() {
  const [stories, setStories] = useState<Story[]>([]);
  const [toDelete, setToDelete] = useState<Story | null>(null);
  const [picking, setPicking] = useState(false);
  const navigate = useNavigate();

  const refresh = () => listStories().then(setStories);
  useEffect(() => {
    refresh();
  }, []);

  async function onNew(game: GroupId) {
    const s = createStory(game);
    await saveStory(s);
    navigate(`/story/${s.id}/info`);
  }

  return (
    <div className="min-h-screen bg-[#383838] text-neutral-200">
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <h1 className="text-2xl font-semibold">Story Editor</h1>

        <div className="flex flex-wrap gap-3">
          <button className="btn" onClick={() => setPicking(true)}>
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
          <Link className="btn" to="/birthdays">
            Birthdays
          </Link>
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
                <div className="min-w-0 flex-1">
                  <div>
                    {s.title || "Untitled story"}
                    {s.publishedAt && (
                      <span className="ml-2 text-xs text-green-400">completed</span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs opacity-60">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-sm"
                      style={{ background: GROUPS[s.game].color }}
                    />
                    {GROUPS[s.game].label}
                  </div>
                </div>
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

      {picking && (
        <NewStoryDialog
          onPick={(game) => {
            setPicking(false);
            onNew(game);
          }}
          onCancel={() => setPicking(false)}
        />
      )}

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