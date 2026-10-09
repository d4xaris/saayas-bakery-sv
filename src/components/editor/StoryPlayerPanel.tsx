import { useEffect, useMemo, useRef, useState } from "react"
import { SITE } from "@/lib/editor/importGame"
import { PLAYER_LANG } from "@/lib/editor/config"
import { getEpisodeAsset, makePatchedFetch } from "@/lib/editor/previewFetch"
import type { Story } from "@/lib/editor/types"
import StoryStage from "@/components/player/StoryStage"
import BandoriPlayer from "@/components/player/bandori/BandoriPlayer"

export default function StoryPlayerPanel({ story, runKey = 0 }: { story: Story; runKey?: number }) {
  if (story.bandori) return <BandoriPlayer key={runKey} story={story} />
  return <OurNotesPanel story={story} runKey={runKey} />
}

function OurNotesPanel({ story, runKey }: { story: Story; runKey: number }) {
  const storyRef = useRef<Story | null>(null)
  storyRef.current = story

  const advId = story.source?.advId
  const [asset, setAsset] = useState<string | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!advId) return
    getEpisodeAsset(advId).then(setAsset).catch((e) => setError(String(e)))
  }, [advId])

  const patchedFetch = useMemo(
    () => (asset ? makePatchedFetch(() => storyRef.current, asset) : undefined),
    [asset],
  )

  if (!advId) return <p className="opacity-60">Playback needs a game story. Use “Import” on the Edit tab.</p>
  if (error) return <p className="text-red-400">{error}</p>
  if (!patchedFetch) return <p className="opacity-60">Preparing…</p>

  return (
    <StoryStage
      key={runKey}
      locale="en-US"
      manifest={`${SITE}/stories/${advId}.json`}
      language={PLAYER_LANG as any}
      title={story.title}
      simple={false}
      nextEpisode={null}
      onNextEpisode={() => {}}
      fetchOverride={patchedFetch}
      simpleBar
    />
  )
}