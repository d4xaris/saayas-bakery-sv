import { Link, useNavigate, useParams } from "react-router"
import { exportStory } from "@/lib/editor/store"
import { exportStoryDocx } from "@/lib/editor/exportDocx"
import { exportStoryTxt } from "@/lib/editor/exportTxt"
import { useStory } from "@/lib/editor/useStory"

export default function Save() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { story, status, update, flush } = useStory(id)
  if (status !== "ready" || !story) return <div>Loading…</div>

  async function publish() {
    update((s) => ({ ...s, publishedAt: Date.now() }))
    await flush()
    navigate(`/story/${id}/view`)
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="card space-y-3">
        <h2 className="font-semibold">Save and share</h2>
        <p className="text-sm opacity-60">Changes are saved automatically in this browser.</p>
        <button className="btn w-full" onClick={() => exportStory(story)}>Export JSON</button>
        <button className="btn btn-primary w-full" onClick={publish}>
          {story.publishedAt ? "Update published version" : "Publish"}
        </button>
      </div>

      {story.publishedAt && (
        <div className="card space-y-3">
          <h2 className="font-semibold">Published</h2>
          <button className="btn w-full" onClick={() => exportStoryDocx(story)}>Export DOCX</button>
          <button className="btn w-full" onClick={() => exportStoryTxt(story)}>Export TXT</button>
          <Link className="btn block text-center" to={`/story/${id}/view`}>View published story</Link>
        </div>
      )}
    </div>
  )
}