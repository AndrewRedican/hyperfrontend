'use client'

import type { ReactNode } from 'react'
import type { EngineResult } from '../../lib/decision-engine'
import type {
  BandProvenance,
  CompositionPosition,
  DeliveryTopology,
  RailStyle,
  SeamMark,
  TopologyPlaceholder,
} from '../../lib/delivery-topology'
import type { PartyLane, PartyTreatment } from '../../lib/delivery-topology-table'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { deriveDeliveryTopology } from '../../lib/delivery-topology'

/** Props for {@link IndependenceSeam}. */
export interface IndependenceSeamProps {
  /** The evaluated assessment the topology is derived from. */
  result: EngineResult
  /** Route back to the questionnaire, which every unanswered element links into. */
  assessmentRoute: string
}

/** Props for a band section. */
interface BandProps {
  /** Which band this is, drawn in the left rail and spoken in the heading. */
  number: number
  /** The band heading. */
  title: string
  /** How strongly the answer behind the band binds. */
  rail: RailStyle
  /** The questions behind the band, rendered as the provenance rail. */
  provenance: BandProvenance[]
  /** Route the provenance chips link into. */
  assessmentRoute: string
  /** The band content. */
  children: ReactNode
}

/** Props for an unanswered element. */
interface PlaceholderProps {
  /** The element that no answer has established. */
  placeholder: TopologyPlaceholder
  /** Route the control links into. */
  assessmentRoute: string
  /** Extra layout classes for the control. */
  className?: string
}

/** Props for one party lane. */
interface PartyCardProps {
  /** The party. */
  lane: PartyLane
  /** What that party hands over, absent until the ceiling question is answered. */
  artifact?: string
  /** Whether the handover carries the locked glyph. */
  locked?: boolean
}

/** Props for the seam. */
interface SeamViewProps {
  /** The seam state and its caption. */
  seam: SeamMark
  /** The contract chip that sits in the gap. */
  contract: string
  /** Route the undecided state links into. */
  assessmentRoute: string
}

/** Props for one composition row. */
interface PositionRowProps {
  /** The row. */
  position: CompositionPosition
}

const HATCH_STYLE = { backgroundImage: 'repeating-linear-gradient(45deg, currentColor 0 2px, transparent 2px 7px)' }

const LANE_CLASS: Record<PartyTreatment, string> = {
  'your-team': 'border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-950/40',
  'another-team': 'border-slate-400 bg-slate-100 dark:border-slate-500 dark:bg-slate-800',
  'cannot-direct': 'border-slate-400 dark:border-slate-500',
  'not-established': 'border-dotted border-slate-300 dark:border-slate-600',
}

const RAIL_WORDS: Record<RailStyle, string> = {
  hard: 'Drawn from a hard requirement you stated.',
  'strong-preference': 'Drawn from a preference you ranked, not a requirement.',
  'weak-preference': 'Drawn from a tie-break you reported.',
  unanswered: 'Not drawn from any answer yet.',
}

const GHOST_CAPTION = 'However many others there are: you have not told us, and it does not change the verdict.'
const DEPENDENCY_LOCKED = 'Framework copies on one screen only arise once two teams share a screen.'
const LEGEND =
  '* Solid fill is your team, hatched fill is a party you cannot direct, and a dotted outline is something no answer has established yet. Every dotted element is a link to the question that would fill it.'

/**
 * Renders an element no answer has established: a real control leading to the
 * question that would fill it, or a stated reason when that question is gated
 * shut and cannot be answered yet. It is a link rather than a button because
 * the question it moves to lives on the assessment route, not on this page.
 * @param props - See {@link PlaceholderProps}.
 * @param props.placeholder
 * @param props.assessmentRoute
 * @param props.className
 * @returns The dotted control, or the dotted note when the question is not being asked.
 */
function Placeholder({ placeholder, assessmentRoute, className }: PlaceholderProps) {
  const shell = `rounded-lg border border-dotted px-3 py-2 text-xs ${className ?? ''}`
  if (placeholder.locked) {
    return (
      <p className={`${shell} border-amber-400 text-slate-600 dark:border-amber-500/60 dark:text-slate-300`}>
        {placeholder.prompt}
        <span className="mt-1 block text-slate-500 dark:text-slate-400">{placeholder.lockedReason}</span>
      </p>
    )
  }
  return (
    <Link
      href={`${assessmentRoute}?question=${encodeURIComponent(placeholder.questionId)}`}
      aria-label={placeholder.accessibleName}
      className={`${shell} block border-slate-300 text-slate-600 hover:border-slate-500 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-400 dark:hover:text-white`}
    >
      {placeholder.prompt}
      <span className="mt-1 block font-medium text-primary-700 dark:text-primary-300">Answer question {placeholder.questionNumber}</span>
    </Link>
  )
}

/**
 * Renders one party, with its ownership treatment on a second channel over a
 * label that always states the same thing in words.
 * @param props - See {@link PartyCardProps}.
 * @param props.lane
 * @param props.artifact
 * @param props.locked
 * @returns The lane card.
 */
function PartyCard({ lane, artifact, locked }: PartyCardProps) {
  return (
    <div className={`relative overflow-hidden rounded-lg border p-3 ${LANE_CLASS[lane.treatment]}`}>
      {lane.treatment === 'cannot-direct' ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 text-slate-500 opacity-20 dark:text-slate-300"
          style={HATCH_STYLE}
        />
      ) : null}
      <span className="relative block text-sm font-semibold text-slate-900 dark:text-white">{lane.label}</span>
      {artifact ? (
        <span className="relative mt-1 block text-xs text-slate-700 dark:text-slate-200">
          {locked ? <span className="mr-1 font-semibold text-slate-500 dark:text-slate-400">[locked]</span> : null}
          hands over {artifact}
        </span>
      ) : null}
    </div>
  )
}

/**
 * Renders the seam: the one mark that carries the verdict, in the one of four
 * states the answers produced. It breaks the figure padding at every width
 * because it is the anchor of the composition and has to read without text.
 * @param props - See {@link SeamViewProps}.
 * @param props.seam
 * @param props.contract
 * @param props.assessmentRoute
 * @returns The seam, its caption, and the contract that crosses it.
 */
function SeamView({ seam, contract, assessmentRoute }: SeamViewProps) {
  const gapped = seam.state === 'gapped-hard' || seam.state === 'gapped-by-preference'
  return (
    <div className="-mx-4 my-4 md:-mx-6">
      {seam.state === 'welded' ? (
        <div className="relative h-7 overflow-hidden bg-slate-700 dark:bg-slate-300">
          <span aria-hidden="true" className="absolute inset-0 text-white opacity-30 dark:text-slate-900" style={HATCH_STYLE} />
        </div>
      ) : null}
      {gapped ? (
        <div className="relative">
          <div className="h-0.5 bg-slate-600 dark:bg-slate-400" />
          <div className="flex h-12 items-center justify-center px-4">
            {seam.state === 'gapped-by-preference' ? (
              <span
                aria-hidden="true"
                className="absolute inset-x-8 top-1/2 border-t-2 border-dashed border-slate-400 dark:border-slate-500"
              />
            ) : null}
            <span className="relative rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
              {contract}
            </span>
          </div>
          <div className="h-0.5 bg-slate-600 dark:bg-slate-400" />
        </div>
      ) : null}
      {seam.state === 'undecided' ? (
        <div className="border-t-2 border-dotted border-slate-300 px-4 py-3 dark:border-slate-600">
          {seam.placeholder ? <Placeholder placeholder={seam.placeholder} assessmentRoute={assessmentRoute} /> : null}
        </div>
      ) : null}
      <p className="px-4 pt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300 md:px-6">{seam.caption}</p>
    </div>
  )
}

/**
 * Renders one composition row: where the parts could be put together, whether
 * anything the reader's answers left standing still composes there, and the
 * answer that closed it when nothing does.
 * @param props - See {@link PositionRowProps}.
 * @param props.position
 * @returns The row.
 */
function PositionRow({ position }: PositionRowProps) {
  return (
    <li
      className={`rounded-lg border p-3 ${position.struck ? 'border-slate-300 dark:border-slate-700' : 'border-emerald-600 dark:border-emerald-400'}`}
    >
      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            position.struck
              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
          }`}
        >
          {position.struck ? 'ruled out' : 'open'}
        </span>
        {position.struck ? (
          <s className="text-slate-500 decoration-slate-400 dark:text-slate-400 dark:decoration-slate-500">{position.poleLabel}</s>
        ) : (
          <span className="text-emerald-700 dark:text-emerald-300">{position.poleLabel}</span>
        )}
      </p>
      {position.detail ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">what crosses here: {position.detail}</p> : null}
      {position.reasons.map((reason) => (
        <p key={reason} className="mt-1 text-xs text-slate-600 dark:text-slate-300">
          Ruled out by: {reason}
        </p>
      ))}
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {position.chips.map((chip) => (
          <li
            key={chip.id}
            className={`inline-flex items-center rounded-md border px-2 py-1 text-xs ${
              chip.struck
                ? 'border-slate-200 text-slate-500 line-through decoration-slate-400 dark:border-slate-800 dark:text-slate-400 dark:decoration-slate-500'
                : 'border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200'
            } ${chip.hyperfrontend ? 'ring-1 ring-primary-500 dark:ring-primary-400' : ''}`}
          >
            {chip.struck ? <span className="sr-only">Ruled out: </span> : null}
            {chip.label}
            {chip.members > 1 ? <span className="ml-1 text-slate-500 dark:text-slate-400">({chip.members})</span> : null}
            {chip.hyperfrontend ? <span className="ml-1 text-primary-700 dark:text-primary-300">where HyperFrontend sits</span> : null}
          </li>
        ))}
      </ul>
      {position.chips.map((chip) =>
        chip.note ? (
          <p key={`${chip.id}-note`} className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {chip.note}
          </p>
        ) : null
      )}
    </li>
  )
}

/**
 * Renders one band: the number and delivery arrow in a left rail, the content,
 * and a provenance rail naming the questions the band was drawn from.
 * @param props - See {@link BandProps}.
 * @param props.number
 * @param props.title
 * @param props.rail
 * @param props.provenance
 * @param props.assessmentRoute
 * @param props.children
 * @returns The band section.
 */
function Band({ number, title, rail, provenance, assessmentRoute, children }: BandProps) {
  const [open, setOpen] = useState(false)
  // why: an answered band needs no chip saying so, since the band is drawn from that answer; only a question still open is worth a control
  const unanswered = provenance.filter((chip) => !chip.answerLabel)
  const panelId = `topology-band-${number}`

  return (
    <section aria-label={`Band ${number}: ${title}`} className="border-t border-slate-200 dark:border-slate-800 print:break-inside-avoid">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/60 md:px-6"
      >
        <span className="w-4 shrink-0 text-sm font-bold text-slate-400 dark:text-slate-500">{number}</span>
        <h4 className="min-w-0 flex-1 text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-white">{title}</h4>
        <BandChevron className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <div id={panelId} hidden={!open} className="px-4 pb-5 md:px-6">
        <span className="sr-only">{RAIL_WORDS[rail]}</span>
        {children}
        {unanswered.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {unanswered.map((chip) => (
              <Link
                key={chip.questionId}
                href={`${assessmentRoute}?question=${encodeURIComponent(chip.questionId)}`}
                aria-label={`Question ${chip.questionNumber} is not answered. Answer it.`}
                className="rounded-md border border-dotted border-slate-300 px-2 py-1 text-[11px] text-slate-500 hover:border-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 dark:border-slate-600 dark:text-slate-400 dark:hover:border-slate-400"
              >
                Q{chip.questionNumber}: not asked yet
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}

/** Props for the band chevron. */
interface BandChevronProps {
  /** Sizing and rotation classes. */
  className?: string
}

function BandChevron({ className }: BandChevronProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  )
}

/**
 * Renders band 4's page rectangles, which keep a literal aspect at every width
 * because the difference between one screen with two owners on it and one page
 * per team is the whole job of the mark.
 * @param topology - The derived topology.
 * @returns The page shape.
 */
function pageShapeOf(topology: DeliveryTopology): ReactNode {
  const { divider, shape } = topology.surface
  const region = 'flex flex-1 items-center justify-center rounded-md p-2 text-center text-[11px]'
  const frame = 'aspect-[16/10] w-full max-w-sm rounded-lg border border-slate-300 p-2 dark:border-slate-600'
  if (shape === 'page-per-team') {
    return (
      <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
        <div className={`${frame} flex bg-primary-50 dark:bg-primary-950/40`}>
          <span className={region}>your team&apos;s page</span>
        </div>
        <span aria-hidden="true" className="rotate-90 text-slate-400 dark:text-slate-500 sm:rotate-0">
          &lt;-&gt;
        </span>
        <div className={`${frame} relative flex overflow-hidden`}>
          <span aria-hidden="true" className="absolute inset-0 text-slate-500 opacity-20 dark:text-slate-300" style={HATCH_STYLE} />
          <span className={`${region} relative`}>their page</span>
        </div>
      </div>
    )
  }
  return (
    <div className={`${frame} mx-auto flex gap-2`}>
      <span className={`${region} bg-primary-50 dark:bg-primary-950/40`}>your team</span>
      <span
        aria-hidden="true"
        className={`w-0 border-l ${shape === 'mixed-screen' ? 'border-solid border-slate-500 dark:border-slate-400' : 'border-dotted border-slate-300 dark:border-slate-600'} ${
          divider?.glyph === 'double-wall' ? 'border-l-4 border-double' : divider?.glyph === 'wall' ? 'border-l-2' : ''
        }`}
      />
      <span className={`${region} ${shape === 'undetermined' ? 'text-slate-500 dark:text-slate-400' : ''}`}>
        {shape === 'undetermined' ? 'not established' : 'another owner'}
      </span>
    </div>
  )
}

/**
 * The reader's own delivery topology, in four bands read top to bottom: who
 * ships each piece, what each party hands over, where the parts are joined, and
 * what the user sees.
 *
 * Every mark traces to a named answer id through the delivery-topology table, so
 * the component holds no reasoning of its own: what it cannot find in the
 * derived model it draws as a dotted control leading to the question that would
 * establish it, never as a plausible-looking default.
 * @param props - See {@link IndependenceSeamProps}.
 * @param props.result
 * @param props.assessmentRoute
 * @returns The figure.
 * @example
 * ```tsx
 * <IndependenceSeam result={evaluate(answers)} assessmentRoute="/docs/is-hyperfrontend-right-for-you" />
 * ```
 */
export function IndependenceSeam({ result, assessmentRoute }: IndependenceSeamProps) {
  const topology = useMemo(() => deriveDeliveryTopology(result), [result])
  const { handover, join, ownership, surface } = topology

  return (
    <figure className="mt-6 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <figcaption className="p-4 md:p-6">
        <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">{topology.thesis}</p>
        <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{LEGEND}</p>
      </figcaption>

      <p aria-live="polite" className="sr-only">
        {topology.announcement}
      </p>

      <Band
        number={1}
        title="Who builds and ships each piece"
        rail={ownership.rail}
        provenance={ownership.provenance}
        assessmentRoute={assessmentRoute}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {ownership.lanes.map((lane) => (
            <PartyCard key={lane.id} lane={lane} />
          ))}
          {ownership.placeholder ? <Placeholder placeholder={ownership.placeholder} assessmentRoute={assessmentRoute} /> : null}
        </div>
        {ownership.controlNote ? (
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
            <span aria-hidden="true" className="mr-1 font-mono">
              {ownership.controlGlyph === 'both-ways' ? '-(/)-' : '-(/)>'}
            </span>
            {ownership.controlNote}
          </p>
        ) : null}
        {ownership.ghostStrip ? (
          <p className="mt-2 rounded-lg border border-dotted border-slate-300 px-3 py-2 text-xs text-slate-500 dark:border-slate-600 dark:text-slate-400">
            {GHOST_CAPTION}
          </p>
        ) : null}
      </Band>

      <Band
        number={2}
        title="What each party hands over"
        rail={handover.rail}
        provenance={handover.provenance}
        assessmentRoute={assessmentRoute}
      >
        {handover.artifact ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {ownership.lanes.map((lane) => (
              <PartyCard key={lane.id} lane={lane} artifact={handover.artifact} locked={handover.locked} />
            ))}
          </div>
        ) : handover.placeholder ? (
          <Placeholder placeholder={handover.placeholder} assessmentRoute={assessmentRoute} />
        ) : null}
      </Band>

      <Band number={3} title="Where the parts are joined" rail={join.rail} provenance={join.provenance} assessmentRoute={assessmentRoute}>
        <SeamView seam={join.seam} contract={join.contract.text} assessmentRoute={assessmentRoute} />
        <ul className="space-y-2">
          {join.positions.map((position) => (
            <PositionRow key={position.id} position={position} />
          ))}
        </ul>
        {join.admission ? <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">admission: {join.admission.text}</p> : null}
      </Band>

      <Band number={4} title="What the user sees" rail={surface.rail} provenance={surface.provenance} assessmentRoute={assessmentRoute}>
        <div
          className={
            surface.seat.state === 'reader-hosts' ? '' : 'rounded-lg border border-dashed border-slate-400 p-3 dark:border-slate-500'
          }
        >
          {surface.seat.state === 'reader-hosts' ? null : (
            <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">
              {surface.seat.state === 'reader-participates' ? 'someone else owns this page' : 'who owns this page varies per host'}:{' '}
              {surface.seat.note}
            </p>
          )}
          {pageShapeOf(topology)}
        </div>
        <p className="mt-6 text-xs text-slate-600 dark:text-slate-300">{surface.shapeText}</p>
        {surface.divider ? <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{surface.divider.label}</p> : null}
        {surface.regionLink ? (
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">across it: {surface.regionLink.text}</p>
        ) : null}
        {surface.placeholder ? (
          <div className="mt-2">
            <Placeholder placeholder={surface.placeholder} assessmentRoute={assessmentRoute} />
          </div>
        ) : null}
        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {surface.dependency.locked ? (
            <p>{DEPENDENCY_LOCKED}</p>
          ) : surface.dependency.notes.length > 0 ? (
            <ul className="space-y-1">
              {surface.dependency.notes.map((note) => (
                <li key={note}>framework copies: {note}</li>
              ))}
            </ul>
          ) : surface.dependency.placeholder ? (
            <Placeholder placeholder={surface.dependency.placeholder} assessmentRoute={assessmentRoute} />
          ) : null}
        </div>
      </Band>
    </figure>
  )
}
