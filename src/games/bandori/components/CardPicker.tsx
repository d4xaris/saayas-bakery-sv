import { useEffect, useMemo, useState } from "react"
import { fetchCard, fetchCards, fetchCharacters } from "@/games/bandori/bestdori/api"
import { cardThumbUrl, characterIconUrl, starIconUrl } from "@/games/bandori/bestdori/images"
import { pick, type CardEpisode, type CardSummary, type CharacterInfo } from "@/games/bandori/bestdori/types"

const STARS = [3, 4, 5] // cards of 1 and 2 stars have no stories
const PAGE = 60

// Only these episode types are text stories. Others (e.g. "animation" on Kirafes cards) have no scenario.
const EPISODE_LABEL: Record<string, string> = { standard: "Episode 1", memorial: "Episode 2" }

// Birthday and Kirafes cards are animated and have one picture only.
const SINGLE_ART_TYPES = new Set(["birthday", "kirafes"])
const hasSingleArt = (c: CardSummary) => SINGLE_ART_TYPES.has(c.type)

// Kirafes cards have no first episode: only Episode 2 is shown for them.
const SKIP_FIRST_EPISODE_TYPES = new Set(["kirafes"])

// Index 1 is the EN server. A null release date means the card is not on global (same rule as the event picker).
const onGlobal = (c: CardSummary) => {
  const start = c.releasedAt[1]
  if (start == null) return false
  const t = Number(start)
  return !(Number.isFinite(t) && t > Date.now())
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

/**
 * Card thumbnail. Tries several file names in order, then shows a placeholder.
 * trained === true: only the trained art. Otherwise: normal first, then trained
 * (animated cards may only have one of the two files).
 */
function Thumb(props: { card: CardSummary; trained?: boolean; className?: string }) {
  const { card, trained } = props
  const [step, setStep] = useState(0)
  const variants = trained ? [true] : [false, true]
  const urls: string[] = []
  for (const v of variants) {
    for (const server of ["jp", "en"] as const) {
      urls.push(cardThumbUrl(card.id, card.resourceSetName, { server, trained: v }))
    }
  }
  if (step >= urls.length) {
    return (
      <div
        className={`flex items-center justify-center bg-white/5 text-xs opacity-60 ${props.className ?? ""}`}
      >
        {card.id}
      </div>
    )
  }
  return (
    <img
      src={urls[step]}
      loading="lazy"
      alt=""
      className={props.className}
      onError={() => setStep((s) => s + 1)}
    />
  )
}

/** Character round icon with a text fallback. */
function CharIcon(props: { id: number; name: string; size: number }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <span
        className="flex items-center justify-center rounded-full bg-white/10 text-xs"
        style={{ width: props.size, height: props.size }}
      >
        {props.name.slice(0, 2)}
      </span>
    )
  }
  return (
    <img
      src={characterIconUrl(props.id)}
      alt={props.name}
      loading="lazy"
      className="rounded-full"
      style={{ width: props.size, height: props.size }}
      onError={() => setFailed(true)}
    />
  )
}

/** n star images, or plain ★ characters if the image does not load. */
function Stars(props: { n: number; size?: number }) {
  const [failed, setFailed] = useState(false)
  const size = props.size ?? 16
  if (failed) return <span>{"★".repeat(props.n)}</span>
  return (
    <span className="inline-flex">
      {Array.from({ length: props.n }, (_, i) => (
        <img
          key={i}
          src={starIconUrl()}
          alt="★"
          style={{ width: size, height: size }}
          onError={() => setFailed(true)}
        />
      ))}
    </span>
  )
}

export default function CardPicker(props: {
  busy: boolean
  onPick: (card: CardSummary, episode: CardEpisode) => void
}) {
  const [cards, setCards] = useState<CardSummary[] | null>(null)
  const [people, setPeople] = useState<Record<number, CharacterInfo>>({})
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [stars, setStars] = useState<Set<number>>(new Set(STARS))
  const [who, setWho] = useState<number | null>(null)
  const [showWho, setShowWho] = useState(false)
  const [grid, setGrid] = useState(true)
  const [limit, setLimit] = useState(PAGE)
  const [card, setCard] = useState<CardSummary | null>(null)
  const [episodes, setEpisodes] = useState<CardEpisode[] | null>(null)

  useEffect(() => {
    // Character names are only for display and filtering: the cards still work without them.
    Promise.all([fetchCards(), fetchCharacters().catch(() => ({}) as Record<number, CharacterInfo>)])
      .then(([c, p]) => {
        setCards(c)
        setPeople(p)
      })
      .catch((e: unknown) => setError(message(e)))
  }, [])

  useEffect(() => setLimit(PAGE), [query, stars, who])

  const charName = (id: number) => pick(people[id]?.names, "en") || `Character ${id}`
  const cardName = (c: CardSummary) => pick(c.names, "en") || `Card ${c.id}`

  const toggleStar = (n: number) =>
    setStars((prev) => {
      const next = new Set(prev)
      if (next.has(n)) {
        if (next.size === 1) return prev // keep at least one
        next.delete(n)
      } else next.add(n)
      return next
    })

  // Only characters that have a card here, grouped by band.
  const characters = useMemo(() => {
    const ids = new Set<number>()
    for (const c of cards ?? []) if (STARS.includes(c.rarity) && onGlobal(c)) ids.add(c.characterId)
    const byBand = new Map<number, number[]>()
    for (const id of ids) {
      const info = people[id]
      if (!info) continue
      const list = byBand.get(info.bandId)
      if (list) list.push(id)
      else byBand.set(info.bandId, [id])
    }
    return [...byBand.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([band, list]) => [band, list.sort((a, b) => a - b)] as [number, number[]])
  }, [cards, people])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (cards ?? []).filter((c) => {
      if (!stars.has(c.rarity) || !onGlobal(c)) return false
      if (who !== null && c.characterId !== who) return false
      if (!q) return true
      return (
        String(c.id) === q ||
        `${charName(c.characterId)} ${c.names.join(" ")}`.toLowerCase().includes(q)
      )
    })
    // charName reads `people`, which is why it is a dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, people, query, stars, who])

  const choose = (c: CardSummary) => {
    setCard(c)
    setEpisodes(null)
    setError("")
    fetchCard(c.id)
      .then(setEpisodes)
      .catch((e: unknown) => setError(message(e)))
  }

  if (card) {
    const single = hasSingleArt(card)
    // Only text episodes; Kirafes cards also lose Episode 1.
    const visible = episodes?.filter(
      (ep) =>
        ep.episodeType in EPISODE_LABEL &&
        !(SKIP_FIRST_EPISODE_TYPES.has(card.type) && ep.episodeType === "standard"),
    )
    return (
      <div className="space-y-2">
        <button
          className="btn w-full"
          onClick={() => {
            setCard(null)
            setEpisodes(null)
            setError("")
          }}
        >
          ← Cards
        </button>
        {single ? (
          <figure className="mx-auto w-1/2 space-y-1">
            <Thumb card={card} className="aspect-square w-full rounded object-cover" />
            <figcaption className="text-center text-xs opacity-60">Animated</figcaption>
          </figure>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {[false, true].map((trained) => (
              <figure key={String(trained)} className="space-y-1">
                <Thumb
                  card={card}
                  trained={trained}
                  className="aspect-square w-full rounded object-cover"
                />
                <figcaption className="text-center text-xs opacity-60">
                  {trained ? "Trained" : "Normal"}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
        <div className="space-y-1">
          <p className="text-sm font-semibold">
            {charName(card.characterId)} — {cardName(card)}
          </p>
          <p className="flex items-center gap-1 text-xs opacity-60">
            <Stars n={card.rarity} size={14} /> · {card.type} · {card.id}
          </p>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {!visible && !error && <p className="text-sm opacity-60">Loading…</p>}
        {visible?.length === 0 && <p className="text-sm opacity-60">This card has no story.</p>}
        {visible?.map((ep) => (
          <div key={ep.scenarioId} className="space-y-1 rounded border border-neutral-600 p-2">
            <p className="text-xs opacity-60">{EPISODE_LABEL[ep.episodeType]}</p>
            <p className="text-sm">{pick(ep.title, "en") || ep.scenarioId}</p>
            <button className="btn w-full" disabled={props.busy} onClick={() => props.onPick(card, ep)}>
              {props.busy ? "Importing…" : "Import"}
            </button>
          </div>
        ))}
      </div>
    )
  }

  const chip = (active: boolean) =>
    `rounded-full border px-2 py-0.5 text-xs transition ${
      active ? "border-blue-400/70 bg-blue-500/25" : "border-white/15 bg-white/5 hover:bg-white/10"
    }`

  return (
    <div className="space-y-2">
      <input
        className="input"
        placeholder="Search name, card title or number"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="flex flex-wrap items-center gap-1">
        {STARS.map((n) => (
          <button
            key={n}
            type="button"
            className={`${chip(stars.has(n))} flex items-center`}
            onClick={() => toggleStar(n)}
          >
            <Stars n={n} size={12} />
          </button>
        ))}
        <button type="button" className={chip(who !== null || showWho)} onClick={() => setShowWho((v) => !v)}>
          {who !== null ? charName(who) : "Characters"} {showWho ? "▾" : "▸"}
        </button>
        {who !== null && (
          <button type="button" className={chip(false)} onClick={() => setWho(null)}>
            ✕
          </button>
        )}
        <button
          type="button"
          className={`${chip(false)} ml-auto`}
          onClick={() => setGrid((v) => !v)}
        >
          {grid ? "List" : "Grid"}
        </button>
      </div>

      {showWho && (
        <div className="max-h-56 space-y-2 overflow-y-auto rounded border border-white/10 p-2">
          {characters.map(([band, ids]) => (
            <div key={band} className="flex flex-wrap gap-1.5">
              {ids.map((id) => (
                <button
                  key={id}
                  type="button"
                  title={charName(id)}
                  className={`rounded-full p-0.5 transition ${
                    who === id
                      ? "ring-2 ring-blue-400"
                      : "ring-1 ring-white/15 opacity-80 hover:opacity-100"
                  }`}
                  onClick={() => {
                    setWho(who === id ? null : id)
                    setShowWho(false)
                  }}
                >
                  <CharIcon id={id} name={charName(id)} size={36} />
                </button>
              ))}
            </div>
          ))}
          {characters.length === 0 && <p className="text-xs opacity-60">No character list.</p>}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
      {!cards && !error && <p className="text-sm opacity-60">Loading cards…</p>}
      {cards && <p className="text-xs opacity-60">{shown.length} cards</p>}

      <div className="h-[60vh] overflow-y-auto overscroll-contain">
        {grid ? (
          <div className="grid grid-cols-3 gap-2">
            {shown.slice(0, limit).map((c) => (
              <button
                key={c.id}
                type="button"
                title={`${charName(c.characterId)} — ${cardName(c)}`}
                className="space-y-1 rounded border border-white/10 bg-white/5 p-1 text-left hover:bg-white/10"
                onClick={() => choose(c)}
              >
                <Thumb card={c} className="aspect-square w-full rounded object-cover" />
                <p className="truncate text-xs">{charName(c.characterId)}</p>
                <p className="truncate text-[10px] opacity-60">
                  {c.id} · {c.rarity}★
                </p>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {shown.slice(0, limit).map((c) => (
              <button
                key={c.id}
                className="btn flex w-full items-center gap-2 text-left"
                onClick={() => choose(c)}
              >
                <Thumb card={c} className="h-10 w-10 shrink-0 rounded object-cover" />
                <span className="min-w-0 truncate">
                  <span className="opacity-60">{c.id}</span> {charName(c.characterId)} — {cardName(c)}{" "}
                  <span className="opacity-60">{c.rarity}★</span>
                </span>
              </button>
            ))}
          </div>
        )}
        {shown.length > limit && (
          <button className="btn mt-2 w-full" onClick={() => setLimit((n) => n + PAGE)}>
            Show more ({shown.length - limit})
          </button>
        )}
      </div>
    </div>
  )
}