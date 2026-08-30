'use client'

import type { Ref } from 'react'
import type { Family } from '../../data/decision-framework'
import type { Elimination, EngineResult } from '../../lib/decision-engine'
import type { Band, LandscapeCard } from './banded-landscape-model'
import { useId, useRef, useState } from 'react'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { decisionFramework } from '../../data/decision-framework'
import { HYPERFRONTEND_FAMILY_ID } from '../../lib/decision-engine'
import {
  CANNOT_SHOW,
  CLIFF_GAP,
  COLUMN_BANDS,
  DEPTH_POLES,
  LANDSCAPE_COLUMNS,
  ORDINARY_GAP,
  ROW_BANDS,
  SHARED_RUNTIME_SENTENCE,
  SMALLEST_RENDERABLE_DIFFERENCE,
  implementationCountFor,
  memberNoteFor,
} from './banded-landscape-model'

/** Props for {@link BandedLandscape}. */
export interface BandedLandscapeProps {
  /** The evaluated assessment, which decides every state on the grid and nothing about its shape. */
  result: EngineResult
  /** Called when a family is activated, so the page can reveal its detail. */
  onSelect?: (familyId: string) => void
}

/** What the reader's answers did to one family. */
interface FamilyVerdict {
  /** Every answer that independently rules the family out, in dataset order. */
  causes: Elimination[]
  /** How many answered questions point at the family without ruling anything out. */
  favors: number
}

/** What the reader's answers did to one card, which is what its border and its words report. */
interface CardVerdict {
  /** Whether the card is untouched, part struck, or closed outright. */
  state: 'live' | 'partly' | 'closed'
  /** Families on the card the answers ruled out. */
  eliminated: Family[]
  /** The fewest answers that independently rule out any one of the struck families. */
  fewestCauses: number
  /** The answer behind the card, quoted when exactly one answer is responsible for it. */
  soleCause?: string
  /** How many of the reader's answers point at the card. */
  favors: number
}

/** Props for a band header, which both axes draw the same way. */
interface BandHeaderProps {
  /** The band whose label, sentence and literal range the header prints. */
  band: Band
  /** Element id the header carries, so every cell in the band can point at it. */
  id: string
  /** Axis letter the literal range is printed against. */
  axis: string
  /** How many families in the band still fit the answers. */
  live: number
  /** Grid placement and flow classes for this header. */
  className: string
}

/** Props for one member chip inside a card. */
interface MemberChipProps {
  /** The family the chip names, by its short name and never by its plain name. */
  family: Family
  /** The answer that ruled the family out, absent while it still fits. */
  ruledOutBy?: string
  /** Called when the chip is activated, so the page can reveal the family's detail. */
  onSelect?: (familyId: string) => void
}

/** Props for one card. */
interface CardProps {
  /** The card to draw. */
  card: LandscapeCard
  /** What the answers did to it. */
  verdict: CardVerdict
  /** Answer label keyed by family id, for the struck chips. */
  reasons: Map<string, string>
  /** Whether the card's disclosure is open. */
  open: boolean
  /** Whether the name filter matched a family on this card. */
  matched: boolean
  /** Element id prefix, so two assessments on one page never share ids. */
  uid: string
  /** Flex ordering used only by the single-column alternative ordering. */
  order: string
  /** Toggles the disclosure. */
  onToggle: (cardId: string) => void
  /** Reports hover and focus, so the true-value rulers can light this card's ticks. */
  onPoint: (cardId: string | null) => void
  /** Called when a family is activated. */
  onSelect?: (familyId: string) => void
  /** Holds the open card's expander, so Escape can return focus to it. */
  buttonRef?: Ref<HTMLButtonElement>
}

const GRID_TRACKS =
  '[@container_(min-width:600px)]:grid [@container_(min-width:600px)]:[grid-template-columns:132px_minmax(0,1fr)_12px_minmax(0,1fr)_minmax(0,1fr)] [@container_(min-width:600px)]:[column-gap:0px] [@container_(min-width:600px)]:[row-gap:16px] [@container_(min-width:600px)]:items-start'
// why: sticky positions against the page scroller rather than the figure, so at narrow widths the band headers floated over the cards below them; block flow cannot overlap
const STICKY_BAND =
  '[@container_(max-width:599px)]:mt-6 [@container_(max-width:599px)]:border-t [@container_(max-width:599px)]:border-slate-200 dark:[@container_(max-width:599px)]:border-slate-800 [@container_(max-width:599px)]:pt-3'
const COLUMN_PLACEMENT: Record<string, string> = {
  'x-a': 'mx-2 [grid-column:2]',
  'x-b': 'mx-2 [grid-column:4]',
  'x-c': 'mx-2 [grid-column:5]',
}
const ROW_PLACEMENT: Record<string, string> = {
  'y-r1': '[grid-row:3]',
  'y-r2': '[grid-row:4]',
  'y-r3': '[grid-row:5]',
}
const ORDER_CARDS = [
  '[@container_(max-width:599px)]:[order:2]',
  '[@container_(max-width:599px)]:[order:4]',
  '[@container_(max-width:599px)]:[order:6]',
]
const ORDER_HEADINGS = [
  '[@container_(max-width:599px)]:[order:1]',
  '[@container_(max-width:599px)]:[order:3]',
  '[@container_(max-width:599px)]:[order:5]',
]
const ANSWER_GROUPS = ['Still standing', 'One constraint away', 'Ruled out several times over']
const RULER_TIER = 'hidden [@container_(min-width:720px)]:block'
const CELL_FLOW = '[@container_(min-width:600px)]:flex-col [@container_(min-width:600px)]:gap-2 [@container_(min-width:600px)]:space-y-0'
const CHIPS_OPEN = 'mt-2 flex flex-col gap-1'
const CHIPS_CLUSTER = 'mt-2 hidden flex-col gap-1 [@container_(min-width:900px)]:flex print:flex'
const CHIPS_SOLO = 'mt-2 hidden flex-col gap-1 print:flex'
const COST_TIER = 'mt-2 hidden text-[11px] leading-snug text-slate-500 [@container_(min-width:1156px)]:block dark:text-slate-400'
const CARD_BASE = 'break-inside-avoid rounded-lg border-l-4 p-3 transition-opacity motion-reduce:transition-none'
const CARD_LIVE = 'border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40'
const CARD_CLOSED = 'border border-dashed border-slate-300 bg-transparent opacity-80 dark:border-slate-700'
const BADGE = 'inline-block rounded px-1.5 py-0.5 text-[11px] font-medium'
const SMALL_BUTTON =
  'rounded border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-600 hover:border-primary-400 dark:border-slate-700 dark:text-slate-300 dark:hover:border-primary-500'

/**
 * Resolves how the answers left each family, so a card behind one answer can be told apart
 * from a card ruled out several independent ways.
 * @param result - The evaluated assessment.
 * @returns One verdict per family, keyed by family id.
 */
function verdictsOf(result: EngineResult): Map<string, FamilyVerdict> {
  const verdicts = createMap<string, FamilyVerdict>()
  for (const family of decisionFramework.families) {
    verdicts.set(family.id, {
      causes: result.alsoEliminatedBy.get(family.id) ?? [],
      favors: (result.favoredBy.get(family.id) ?? []).length,
    })
  }
  return verdicts
}

/**
 * Grades one card from its members' verdicts.
 *
 * Overdetermination is the point. A family held out by a single answer is a live
 * alternative the reader might revisit; a family ruled out five independent ways is not, and
 * the fewest causes across the struck members is the number that separates them.
 * @param card - The card to grade.
 * @param verdicts - Per-family verdicts.
 * @param labels - Answer label keyed by answer id.
 * @returns The card's state and the numbers its grafted lines print.
 */
function cardVerdictOf(card: LandscapeCard, verdicts: Map<string, FamilyVerdict>, labels: Map<string, string>): CardVerdict {
  const eliminated = card.members.filter((family) => (verdicts.get(family.id)?.causes.length ?? 0) > 0)
  const favors = card.members.reduce((total, family) => total + (verdicts.get(family.id)?.favors ?? 0), 0)
  let fewestCauses = 0
  for (const family of eliminated) {
    const count = verdicts.get(family.id)?.causes.length ?? 0
    if (fewestCauses === 0 || count < fewestCauses) fewestCauses = count
  }
  const nearest = eliminated.find((family) => (verdicts.get(family.id)?.causes.length ?? 0) === fewestCauses)
  const cause = nearest ? verdicts.get(nearest.id)?.causes[0] : undefined
  const state = eliminated.length === 0 ? 'live' : eliminated.length === card.members.length ? 'closed' : 'partly'
  return { state, eliminated, fewestCauses, soleCause: fewestCauses === 1 && cause ? labels.get(cause.answerId) : undefined, favors }
}

/**
 * Picks the tone for one true-value tick, lit while the card holding its family is hovered
 * or focused.
 * @param familyId - The family the tick marks.
 * @param pointed - The card currently hovered or focused, if any.
 * @returns The tick's size and colour classes.
 */
function tickTone(familyId: string, pointed: string | null): string {
  const lit = LANDSCAPE_COLUMNS.flatMap((column) => column.cells)
    .flatMap((cell) => cell.cards)
    .some((card) => card.id === pointed && card.members.some((family) => family.id === familyId))
  return lit ? 'bg-primary-500 dark:bg-primary-400' : 'bg-slate-300 dark:bg-slate-700'
}

/**
 * Draws one band header: its short label, its pole sentence, the literal range the data put
 * in it, and how much of it still fits.
 * @param props - See {@link BandHeaderProps}.
 * @param props.band
 * @param props.id
 * @param props.axis
 * @param props.live
 * @param props.className
 * @returns The header.
 */
function BandHeader({ band, id, axis, live, className }: BandHeaderProps) {
  return (
    <div className={className}>
      <h3 id={id} className="text-[13px] font-semibold uppercase tracking-wide text-slate-900 dark:text-white">
        {band.label}
      </h3>
      <p className="mt-1 text-[11px] leading-snug text-slate-600 dark:text-slate-300">{band.sentence}</p>
      {band.warning ? (
        <p className="mt-1 text-[11px] font-semibold leading-snug text-amber-700 dark:text-amber-300">{band.warning}</p>
      ) : null}
      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
        {band.low === band.high ? `${axis} ${band.low}` : `${axis} ${band.low} to ${band.high}`}. {live} of {band.familyIds.length} still
        fit.
      </p>
    </div>
  )
}

/**
 * Draws one family inside a card, struck and reasoned when an answer ruled it out.
 * @param props - See {@link MemberChipProps}.
 * @param props.family
 * @param props.ruledOutBy
 * @param props.onSelect
 * @returns The chip.
 */
function MemberChip({ family, ruledOutBy, onSelect }: MemberChipProps) {
  const note = memberNoteFor(family.id)
  const shell = 'block w-full rounded border border-slate-200 px-1.5 py-1 text-left text-[12px] leading-snug dark:border-slate-800'
  const body = (
    <>
      <span className={ruledOutBy ? 'text-slate-500 dark:text-slate-400' : 'text-slate-700 dark:text-slate-200'}>
        {ruledOutBy ? (
          <s className="line-through decoration-slate-400 dark:decoration-slate-500">
            <span className="sr-only">Ruled out: </span>
            {family.name}
          </s>
        ) : (
          family.name
        )}
      </span>
      {implementationCountFor([family.id]) === 0 ? (
        <span className="ml-1 text-slate-500 dark:text-slate-400">not a product category</span>
      ) : null}
      {note ? <span className="ml-1 text-slate-500 dark:text-slate-400">({note})</span> : null}
      {ruledOutBy ? <span className="mt-0.5 block text-slate-500 dark:text-slate-400">ruled out by: {ruledOutBy}</span> : null}
    </>
  )
  if (!onSelect) return <span className={shell}>{body}</span>
  return (
    <button type="button" className={`${shell} hover:border-primary-400 dark:hover:border-primary-500`} onClick={() => onSelect(family.id)}>
      {body}
    </button>
  )
}

/**
 * Draws one card: a cluster the evidence does not separate, or a single family.
 * @param props - See {@link CardProps}.
 * @param props.card
 * @param props.verdict
 * @param props.reasons
 * @param props.open
 * @param props.matched
 * @param props.uid
 * @param props.order
 * @param props.onToggle
 * @param props.onPoint
 * @param props.onSelect
 * @param props.buttonRef
 * @returns The card.
 */
function Card({ card, verdict, reasons, open, matched, uid, order, onToggle, onPoint, onSelect, buttonRef }: CardProps) {
  const detailsId = `${uid}-${card.id}-details`
  const microfrontend = card.members[0].kind === 'microfrontend'
  const hyperfrontend = card.members.some((family) => family.id === HYPERFRONTEND_FAMILY_ID)
  const kind = microfrontend ? 'border-l-emerald-600 dark:border-l-emerald-400' : 'border-l-slate-400 dark:border-l-slate-500'
  const accent = verdict.state === 'closed' ? 'border-l-slate-300 dark:border-l-slate-700' : kind
  const ring = hyperfrontend ? 'ring-2 ring-primary-500 dark:ring-primary-400' : ''
  const flash = matched ? 'outline outline-2 outline-offset-2 outline-amber-500 dark:outline-amber-400' : ''
  const chips = open ? CHIPS_OPEN : card.members.length > 1 ? CHIPS_CLUSTER : CHIPS_SOLO
  const fit = verdict.state === 'closed' ? 'ruled out' : verdict.state === 'partly' ? 'partly ruled out' : 'still fits'
  const plural = card.members.length === 1 ? 'approach' : 'approaches'
  const name = `${card.title}, ${card.members.length} ${plural}, ${card.depth.words.toLowerCase()}, ${card.implementationCount} implementations, ${fit}.`
  return (
    <article
      aria-label={name}
      className={`${CARD_BASE} ${accent} ${verdict.state === 'closed' ? CARD_CLOSED : CARD_LIVE} ${ring} ${flash} ${order}`}
      onMouseEnter={() => onPoint(card.id)}
      onMouseLeave={() => onPoint(null)}
      onFocus={() => onPoint(card.id)}
      onBlur={() => onPoint(null)}
    >
      {card.reach ? (
        <p className="mb-1.5 text-[11px] leading-snug text-amber-700 dark:text-amber-300">
          <span className="mr-1.5 inline-block h-1.5 w-4 rounded-full bg-amber-500 align-middle dark:bg-amber-400" />
          {card.reach}
        </p>
      ) : null}
      <h4 className="text-[13px] font-semibold leading-snug text-slate-900 dark:text-white">{card.title}</h4>
      {verdict.state === 'closed' ? (
        <p className="mt-1 text-[11px] leading-snug text-slate-600 dark:text-slate-300">
          {verdict.soleCause
            ? `Closed by 1 of your answers: "${verdict.soleCause}"`
            : `Closed ${verdict.fewestCauses} separate ways by your answers.`}
        </p>
      ) : null}
      <div className={verdict.state === 'closed' && !open ? '[@container_(max-width:599px)]:hidden' : ''}>
        <p className="mt-1 text-[11px] leading-snug text-slate-600 dark:text-slate-300">
          <span className="font-mono text-[14px] text-slate-700 dark:text-slate-200">{card.depth.glyph}</span> {card.depth.words}
        </p>
        <p className="mt-1.5 flex flex-wrap gap-1">
          <span className={`${BADGE} bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200`}>
            {card.implementationCount > 0 ? `${card.implementationCount} implementations` : 'not a product category'}
          </span>
          <span
            className={
              microfrontend
                ? `${BADGE} bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300`
                : `${BADGE} bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300`
            }
          >
            {microfrontend ? 'microfrontend' : 'not a microfrontend architecture'}
          </span>
          {hyperfrontend ? (
            <span className={`${BADGE} bg-primary-100 text-primary-800 dark:bg-primary-950/60 dark:text-primary-300`}>
              where HyperFrontend sits
            </span>
          ) : null}
          <span
            className={
              verdict.state === 'live'
                ? `${BADGE} bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300`
                : `${BADGE} bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300`
            }
          >
            {verdict.state === 'live' ? 'live' : verdict.state === 'partly' ? 'partly ruled out' : 'closed by your answers'}
          </span>
        </p>
        {card.statedFact ? <p className="mt-1.5 text-[11px] leading-snug text-slate-600 dark:text-slate-300">{card.statedFact}</p> : null}
        {verdict.favors > 0 ? (
          <p className="mt-1.5 text-[11px] leading-snug text-emerald-700 dark:text-emerald-300">
            <span className="font-mono">{'^'}</span> {verdict.favors} of your answers point here.
          </p>
        ) : null}
        {verdict.state === 'partly' ? (
          <p className="mt-1.5 text-[11px] leading-snug text-slate-600 dark:text-slate-300">
            {verdict.eliminated.length} of these {card.members.length} are ruled out. The rest still fit.
          </p>
        ) : null}
        {verdict.favors > 0 && verdict.eliminated.length > 0 ? (
          <p className="mt-1.5 text-[11px] leading-snug text-amber-800 dark:text-amber-300">
            {verdict.favors} of your answers pointed here; {verdict.fewestCauses} other{verdict.fewestCauses === 1 ? '' : 's'} ruled it out.
          </p>
        ) : null}
        <div className={chips}>
          {card.members.map((family) => (
            <MemberChip key={family.id} family={family} ruledOutBy={reasons.get(family.id)} onSelect={onSelect} />
          ))}
        </div>
        {card.sharedConsequence ? (
          <p className="mt-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">{card.sharedConsequence}</p>
        ) : null}
        {verdict.state === 'closed'
          ? null
          : card.members.map((family) => (
              <p key={family.id} className={COST_TIER}>
                {family.name} costs you: {family.costs[0].toLowerCase()}
              </p>
            ))}
        <button
          ref={buttonRef}
          type="button"
          aria-expanded={open}
          aria-controls={detailsId}
          aria-label={`Details: ${card.title}`}
          onClick={() => onToggle(card.id)}
          className={`mt-2 ${SMALL_BUTTON} print:hidden`}
        >
          Details
        </button>
        <div id={detailsId} className={open ? 'mt-2 block' : 'mt-2 hidden print:block'}>
          {card.spread ? <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">{card.spread}</p> : null}
          {card.members.map((family) => (
            <div key={family.id} className="mt-2 border-t border-slate-100 pt-2 dark:border-slate-800">
              <p className="text-[11px] leading-snug text-slate-600 dark:text-slate-300">{family.plainName}</p>
              <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">{family.definition}</p>
              <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                What crosses the boundary: {family.boundary}
              </p>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                X {family.position.x}, Y {family.position.y}, depth {family.position.depth}
              </p>
            </div>
          ))}
        </div>
      </div>
    </article>
  )
}

/**
 * The banded landscape: twelve approaches in a nine-cell grid, and what the reader's answers
 * closed.
 *
 * Column is an integration-time band and row is a runtime-realm band, cut only where the
 * dataset leaves a gap wider than the smallest difference these axes may claim. Nothing is
 * placed by a coordinate: every label is a block-level element in normal flow inside a grid
 * cell, and two block elements in normal flow cannot share a block position, so no two
 * labels can collide at any container width, for any name length, for any number of
 * families. There is no collision-detection pass and no label repulsion, because there is
 * nothing to detect.
 *
 * The card title is always `family.name`, which runs 16 to 33 characters. `plainName` runs
 * 64 to 178 and belongs inside an opened disclosure and nowhere else: rendering it as a
 * label is the proximate cause of the illegibility this replaces, and a future edit that
 * promotes it back to a title reintroduces the same bug in a new layout.
 * @param props - See {@link BandedLandscapeProps}.
 * @param props.result
 * @param props.onSelect
 * @returns The landscape.
 * @example
 * ```tsx
 * <BandedLandscape result={evaluate(answers)} onSelect={setExpanded} />
 * ```
 */
export function BandedLandscape({ result, onSelect }: BandedLandscapeProps) {
  const uid = useId()
  const [openCard, setOpenCard] = useState<string | null>(null)
  const [pointed, setPointed] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [byAnswers, setByAnswers] = useState(false)
  const [inertOpen, setInertOpen] = useState(false)
  const openButton = useRef<HTMLButtonElement | null>(null)
  const { axes, families, metadata } = decisionFramework

  const verdicts = verdictsOf(result)
  const labels = createMap(result.answered.map(({ answer }) => [answer.id, answer.label]))
  const reasons = createMap(result.eliminated.map((entry) => [entry.family.id, labels.get(entry.by.answerId) ?? entry.by.answerId]))
  const needle = filter.trim().toLowerCase()
  const liveIn = (band: Band) => band.familyIds.filter((id) => !reasons.has(id)).length
  const cells = LANDSCAPE_COLUMNS.flatMap((column) => column.cells)
  const openCells = cells.filter((cell) => cell.cards.some((card) => card.members.some((family) => !reasons.has(family.id))))
  const closed = [...ROW_BANDS, ...COLUMN_BANDS].filter((band) => band.familyIds.every((id) => reasons.has(id)))
  const groupOf = (verdict: CardVerdict): number =>
    verdict.state === 'live' ? 0 : verdict.state === 'partly' || verdict.fewestCauses === 1 ? 1 : 2
  const usedGroups = createSet(cells.flatMap((cell) => cell.cards).map((card) => groupOf(cardVerdictOf(card, verdicts, labels))))

  const framing =
    result.outcome === 'open'
      ? `${families.length} approaches, surveyed in ${metadata.researchSnapshot}. Nothing is ruled out yet, because you have not told us anything.`
      : `${result.surviving.length} of ${families.length} approaches still fit your answers.`
  const announcement =
    result.answered.length === 0
      ? ''
      : `${closed.map((band) => `${band.label} is now closed.`).join(' ')} ${result.eliminated.length} approaches ruled out. ${result.surviving.length} still fit, in ${openCells.length} of ${COLUMN_BANDS.length * ROW_BANDS.length} combinations.`.trim()

  return (
    <figure className="not-prose mt-6 [container-type:inline-size]">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900 dark:text-white">{framing}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Columns: {axes.x.label.toLowerCase()}. Rows: {axes.y.label.toLowerCase()}, most shared at the top.
          </p>
        </div>
        <label className="text-xs text-slate-500 print:hidden dark:text-slate-400">
          <span className="mr-2">Find an approach</span>
          <input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="w-40 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </label>
      </div>

      <div
        className={`${byAnswers ? 'flex flex-col gap-3' : 'block'} ${GRID_TRACKS}`}
        onKeyDown={(event) => {
          if (event.key !== 'Escape' || !openCard) return
          setOpenCard(null)
          openButton.current?.focus()
        }}
      >
        <div
          className={`${RULER_TIER} relative mx-2 mb-1 h-3 border-b border-slate-200 [grid-column:2/-1] [grid-row:1] dark:border-slate-800`}
        >
          {families.map((family) => (
            <span
              key={family.id}
              style={{ left: `${family.position.x}%` }}
              className={`absolute bottom-0 h-2 w-px ${tickTone(family.id, pointed)}`}
            />
          ))}
        </div>
        <div className={`${RULER_TIER} relative mr-2 w-px self-stretch justify-self-end [grid-column:1] [grid-row:3/span_3]`}>
          {families.map((family) => (
            <span
              key={family.id}
              style={{ top: `${family.position.y}%` }}
              className={`absolute right-0 h-px w-2 ${tickTone(family.id, pointed)}`}
            />
          ))}
        </div>
        {ROW_BANDS.map((band) => (
          <BandHeader
            key={band.id}
            band={band}
            id={`${uid}-${band.id}`}
            axis="Y"
            live={liveIn(band)}
            className={`mr-2 hidden pr-3 [grid-column:1] [@container_(min-width:600px)]:block ${ROW_PLACEMENT[band.id]}`}
          />
        ))}

        {LANDSCAPE_COLUMNS.map((column) => (
          <div key={column.band.id} className={byAnswers ? 'contents' : 'block [@container_(min-width:600px)]:contents'}>
            <BandHeader
              band={column.band}
              id={`${uid}-${column.band.id}`}
              axis="X"
              live={liveIn(column.band)}
              className={`${byAnswers ? 'hidden [@container_(min-width:600px)]:block' : `block ${STICKY_BAND}`} mb-2 py-2 [grid-row:2] ${COLUMN_PLACEMENT[column.band.id]}`}
            />
            {column.cells.map((cell) => (
              <section
                key={cell.id}
                aria-labelledby={`${uid}-${cell.columnId} ${uid}-${cell.rowId}`}
                className={`${cell.cards.length === 0 ? 'hidden [@container_(min-width:600px)]:flex' : byAnswers ? 'contents [@container_(min-width:600px)]:flex' : 'block space-y-2 [@container_(min-width:600px)]:flex'} ${CELL_FLOW} ${COLUMN_PLACEMENT[cell.columnId]} ${ROW_PLACEMENT[cell.rowId]}`}
              >
                {cell.cards.length > 0 && !byAnswers ? (
                  <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 [@container_(min-width:600px)]:hidden dark:text-slate-400">
                    {ROW_BANDS.find((band) => band.id === cell.rowId)?.label}
                  </h4>
                ) : null}
                {cell.cards.map((card) => {
                  const verdict = cardVerdictOf(card, verdicts, labels)
                  const matched = needle.length > 0 && card.members.some((family) => family.name.toLowerCase().includes(needle))
                  return (
                    <Card
                      key={card.id}
                      card={card}
                      verdict={verdict}
                      reasons={reasons}
                      open={openCard === card.id || matched}
                      matched={matched}
                      uid={uid}
                      order={ORDER_CARDS[groupOf(verdict)]}
                      onToggle={(id) => setOpenCard(openCard === id ? null : id)}
                      onPoint={setPointed}
                      onSelect={onSelect}
                      buttonRef={openCard === card.id ? openButton : undefined}
                    />
                  )
                })}
                {cell.emptySentence ? (
                  <p className="p-3 text-center text-[11px] leading-snug text-slate-500 dark:text-slate-400">{cell.emptySentence}</p>
                ) : null}
              </section>
            ))}
            <p
              className={`${byAnswers ? 'hidden' : 'block'} mx-2 mt-2 text-[11px] leading-snug text-slate-500 [@container_(min-width:600px)]:hidden dark:text-slate-400`}
            >
              {column.emptyLine}
            </p>
            {column.band.id === COLUMN_BANDS[0].id ? (
              <div
                className={`${byAnswers ? 'hidden [@container_(min-width:600px)]:block' : 'block'} my-3 border-y-4 border-double border-slate-400 py-2 [grid-column:3] [grid-row:2/span_4] [@container_(min-width:600px)]:my-0 [@container_(min-width:600px)]:ml-1 [@container_(min-width:600px)]:h-full [@container_(min-width:600px)]:border-y-0 [@container_(min-width:600px)]:border-l-4 [@container_(min-width:600px)]:py-0 dark:border-slate-500`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 [@container_(min-width:600px)]:hidden dark:text-slate-300">
                  The cliff: no gradual path. Crossing here flips contract drift from structurally impossible to permanent, in one step.
                </p>
              </div>
            ) : null}
          </div>
        ))}

        {ANSWER_GROUPS.map((group, index) =>
          usedGroups.has(index) ? (
            <h3
              key={group}
              className={`${byAnswers ? 'block' : 'hidden'} mx-2 text-[13px] font-semibold uppercase tracking-wide text-slate-900 [@container_(min-width:600px)]:hidden dark:text-white ${ORDER_HEADINGS[index]}`}
            >
              {group}
            </h3>
          ) : null
        )}
      </div>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <figcaption className="mt-5 space-y-3 text-xs text-slate-600 dark:text-slate-300">
        <p className="border-l-4 border-double border-slate-400 pl-3 dark:border-slate-500">
          <span className="font-semibold">The cliff.</span> No gradual path. Crossing between the first two columns flips contract drift
          from structurally impossible to permanent, in one step: {CLIFF_GAP} points of axis with nothing in it. The next gap is{' '}
          {ORDINARY_GAP} and is drawn as an ordinary gutter. The drawn widths preserve that ordering and claim no ratio.
        </p>
        <p>
          {DEPTH_POLES.map((pole) => (
            <span key={pole.glyph} className="mr-4 inline-block">
              <span className="font-mono text-[14px] text-slate-700 dark:text-slate-200">{pole.glyph}</span> {pole.words.toLowerCase()}
            </span>
          ))}
          <span>Cards sort by this track inside a cell.</span>
        </p>
        <p className={RULER_TIER}>
          The tick strips carry every approach&apos;s true coordinate. Bands are cut only where the data leaves a gap wider than{' '}
          {SMALLEST_RENDERABLE_DIFFERENCE} points, which is the smallest difference these axes may claim.
        </p>
        <p className="font-medium text-slate-700 dark:text-slate-200">{SHARED_RUNTIME_SENTENCE}</p>
        {result.answered.length > 0 ? (
          <div className="flex flex-wrap items-start gap-2 print:hidden">
            <button
              type="button"
              aria-expanded={inertOpen}
              aria-controls={`${uid}-inert`}
              onClick={() => setInertOpen(!inertOpen)}
              className={SMALL_BUTTON}
            >
              {result.inertAnswers.length} of your answers changed nothing
            </button>
            <button
              type="button"
              onClick={() => setByAnswers(!byAnswers)}
              className={`${SMALL_BUTTON} [@container_(min-width:600px)]:hidden`}
            >
              {byAnswers ? 'Order by band' : 'Order by what your answers did'}
            </button>
            <ul id={`${uid}-inert`} className={inertOpen ? 'w-full space-y-1' : 'hidden'}>
              {result.inertAnswers.map(({ answer }) => (
                <li key={answer.id} className="text-[11px] text-slate-500 dark:text-slate-400">
                  {answer.label}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">What this cannot show</p>
          <ul className="mt-2 space-y-1">
            {CANNOT_SHOW.map((limit) => (
              <li key={limit} className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                {limit}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            Surveyed {metadata.researchSnapshot}, last reviewed {metadata.lastReviewed}.
          </p>
        </div>
      </figcaption>
    </figure>
  )
}
