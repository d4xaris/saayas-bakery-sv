import type { Story } from "@/editor/lib/types"

const stripTags = (s: string) => s.replace(/<[^>]*>/g, "")

export default function ChatsCard({
  story,
  patch,
}: {
  story: Story
  patch: (fn: (s: Story) => Story) => void
}) {
  // A typing preview that is the start of a later message needs no translation of its own.
  const chats = (story.chats ?? []).filter((c) => c.kind === "message" || !c.covered)
  if (chats.length === 0) return null

  const chatNames = story.chatNames ?? {}
  const nameOf = (key: string, fallback: string) => chatNames[key]?.trim() || fallback

  const done = chats.filter((c) => c.translated.trim()).length
  const setChat = (key: string, translated: string) =>
    patch((s) => ({
      ...s,
      chats: (s.chats ?? []).map((c) => (c.key === key ? { ...c, translated } : c)),
    }))
  const setName = (key: string, value: string) =>
    patch((s) => ({ ...s, chatNames: { ...(s.chatNames ?? {}), [key]: value } }))

  // Unique chat names and nicknames, in order of appearance.
  const windows = new Map<string, string>()
  const senders = new Map<string, string>()
  for (const c of chats) {
    if (c.windowName && !windows.has(c.windowName)) windows.set(c.windowName, c.windowNameReference)
    if (c.sender && !senders.has(c.sender)) senders.set(c.sender, c.senderReference)
  }

  const nameRow = (key: string, original: string, reference: string) => (
    <div key={key} className="grid grid-cols-[84px_1fr] items-center gap-2">
      <span className="text-xs opacity-70" title={original}>
        <span className="block truncate">{original}</span>
        {reference && <span className="block truncate opacity-70">{reference}</span>}
      </span>
      <input
        className="input !p-1.5 text-sm"
        value={chatNames[key] ?? ""}
        placeholder={reference || original}
        onChange={(e) => setName(key, e.target.value)}
      />
    </div>
  )

  return (
    <div className="card space-y-3">
      <h2 className="font-semibold">
        Phone messages ({done}/{chats.length})
      </h2>

      {(windows.size > 0 || senders.size > 0) && (
        <div className="space-y-2 border-b border-white/10 pb-3">
          <p className="text-xs font-semibold opacity-70">Chat names</p>
          {[...windows].map(([name, ref]) => nameRow(`w:${name}`, name, ref))}
          {[...senders].map(([name, ref]) => nameRow(`s:${name}`, name, ref))}
        </div>
      )}

      {chats.map((c, i) => {
        const newWindow = i === 0 || chats[i - 1].windowId !== c.windowId
        const windowTitle = nameOf(`w:${c.windowName}`, c.windowNameReference || c.windowName)
        const senderTitle = nameOf(`s:${c.sender}`, c.senderReference || c.sender)
        return (
          <div key={c.key} className="space-y-1">
            {newWindow && windowTitle && <p className="pt-1 text-xs font-semibold opacity-70">{windowTitle}</p>}
            <div className="space-y-0.5 text-sm leading-snug">
              <p className="text-xs opacity-50">
                {c.kind === "typing" ? "typing · " : ""}
                {senderTitle}
              </p>
              <p className="whitespace-pre-wrap">{stripTags(c.original)}</p>
              {c.reference && <p className="whitespace-pre-wrap opacity-60">{stripTags(c.reference)}</p>}
            </div>
            <textarea
              className="input"
              rows={2}
              placeholder="Translation"
              value={c.translated}
              onChange={(e) => setChat(c.key, e.target.value)}
            />
          </div>
        )
      })}
    </div>
  )
}