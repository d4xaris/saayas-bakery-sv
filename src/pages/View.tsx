import { Link, useParams } from "react-router"
import { useStory } from "@/lib/editor/useStory"
import { exportStoryDocx } from "@/lib/editor/exportDocx"
import { exportStoryTxt } from "@/lib/editor/exportTxt"
import StoryPlayerPanel from "@/components/editor/StoryPlayerPanel"

export default function View() {
  const { id } = useParams()
  const { story, status } = useStory(id)
  if (status !== "ready" || !story) return <div className="p-6">Loading…</div>

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex items-center gap-3">
        <Link className="btn" to="/">← Home</Link>
        <Link className="btn" to={`/story/${id}/edit`}>Edit</Link>
      </div>
      <h1 className="text-2xl font-semibold">{story.title || "Untitled"}</h1>

      <StoryPlayerPanel story={story} exportable />

      <div className="flex flex-wrap gap-2">
        <button className="btn" onClick={() => exportStoryDocx(story)}>Download DOCX</button>
        <button className="btn" onClick={() => exportStoryTxt(story)}>Download TXT</button>
      </div>
    </div>
  )
}