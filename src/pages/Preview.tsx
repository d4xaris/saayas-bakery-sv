import { useState } from "react"
import { useParams } from "react-router"
import { useStory } from "@/lib/editor/useStory"
import type { Story } from "@/lib/editor/types"
import StoryPlayerPanel from "@/components/editor/StoryPlayerPanel"

export default function Preview() {
  const { id = "" } = useParams()
  const { story, flush } = useStory(id) as {
    story: Story | null | undefined
    flush?: () => void | Promise<void>
  }
  const [run, setRun] = useState(0)

  if (!story) return <p>Loading…</p>

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          className="btn"
          onClick={async () => {
            await flush?.()
            setRun((n) => n + 1)
          }}
        >
          Reload with latest edits
        </button>
      </div>
      <StoryPlayerPanel story={story} runKey={run} />
    </div>
  )
}