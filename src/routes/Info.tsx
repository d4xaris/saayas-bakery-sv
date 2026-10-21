import { Link, useParams } from "react-router"
import { useStory } from "@/editor/lib/useStory"

export default function Info() {
  const { id } = useParams()
  const { story, status, update } = useStory(id)
  if (status !== "ready" || !story) return <div>Loading…</div>

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <label className="block space-y-1">
        <span className="text-sm opacity-70">Title</span>
        <input
          className="input"
          value={story.title}
          onChange={(e) => update((s) => ({ ...s, title: e.target.value }))}
        />
      </label>
      <Link className="btn inline-block" to="/">← Home</Link>
    </div>
  )
}