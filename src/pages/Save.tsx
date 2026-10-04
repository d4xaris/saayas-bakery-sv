import { Link, useNavigate, useParams } from "react-router";
import { exportStory } from "@/lib/editor/store";
import { useStory } from "@/lib/editor/useStory";

export default function Save() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { story, status, update, flush } = useStory(id);
  if (status !== "ready" || !story) return <div>Loading…</div>;

  async function publish() {
    update({ publishedAt: Date.now() });
    await flush();
    navigate(`/story/${id}/view`);
  }

  return (
    <div className="mx-auto max-w-md space-y-3">
      <p className="text-sm text-neutral-400">Changes are saved automatically in this browser.</p>
      <button className="btn w-full" onClick={() => exportStory(story)}>Export JSON</button>
      <button className="btn w-full" onClick={publish}>
        {story.publishedAt ? "Update published version" : "Publish"}
      </button>
      {story.publishedAt && (
        <Link className="btn block text-center" to={`/story/${id}/view`}>View published story</Link>
      )}
      <Link className="btn block text-center" to="/">Back to Home</Link>
    </div>
  );
}