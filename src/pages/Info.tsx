import { Link, useParams } from "react-router";
import { useStory } from "@/lib/editor/useStory";

export default function Info() {
  const { id } = useParams();
  const { story, status, update } = useStory(id);

  if (status === "loading") return <div className="p-6">Loading…</div>;
  if (status === "missing" || !story) return <div className="p-6">Story not found. <Link to="/">Home</Link></div>;

  return (
    <div className="p-6 space-y-4 max-w-xl">
      <Link to="/">← Home</Link>
      <label className="block">
        Title
        <input className="block w-full border p-2" value={story.title}
          onChange={(e) => update({ title: e.target.value })} />
      </label>
      <label className="block">
        Description
        <textarea className="block w-full border p-2" rows={5} value={story.summary}
          onChange={(e) => update({ summary: e.target.value })} />
      </label>
      <Link to={`/story/${story.id}/edit`}>Next: Edit →</Link>
    </div>
  );
}