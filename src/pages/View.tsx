import { Link, useParams } from "react-router";
import { useStory } from "@/lib/editor/useStory";

export default function View() {
  const { id } = useParams();
  const { story, status } = useStory(id);
  if (status !== "ready" || !story) return <div className="p-6">Loading…</div>;
  return (
    <div className="min-h-screen bg-[#383838] text-neutral-200">
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <div className="flex gap-3"><Link to="/">← Home</Link><Link to={`/story/${id}/edit`}>Edit</Link></div>
        <h1 className="text-2xl font-semibold">{story.title}</h1>
        {story.summary && <p className="text-neutral-400">{story.summary}</p>}
        <div className="space-y-3">
          {story.lines.map((l) => (
            <div key={l.id}>
              <div className="text-sm text-blue-300">{story.names[l.speaker] || l.speaker}</div>
              <div>{l.translated || l.original}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}