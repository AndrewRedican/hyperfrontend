'use client'

import type { FloorRequirement } from '../../data/decision-framework'
import type { EngineResult } from '../../lib/decision-engine'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createDate } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { decisionFramework } from '../../data/decision-framework'
import { evaluate, HYPERFRONTEND_FAMILY_ID, loadAssessment, pruneAnswers, saveAssessment } from '../../lib/decision-engine'
import { buildDecisionRecord } from '../../lib/decision-record'
import { ResearchDisclosure } from '../research-disclosure'
import { BandedLandscape } from './banded-landscape'
import { EliminationCascade } from './elimination-cascade'
import { IndependenceSeam } from './independence-seam'
import { LogoMark } from './logo-mark'
import { RecordActions } from './record-actions'
import { RecordVerdict } from './record-verdict'

/** Props for {@link ResultView}. */
export interface ResultViewProps {
  /** Route back to the questionnaire. */
  assessmentRoute: string
}

const AVAILABILITY_LABELS: Record<string, string> = {
  available: 'Available',
  'available-immature': 'Available, early',
  'announced-planned': 'Announced, not available',
  'future-roadmap': 'On a roadmap',
  deprecated: 'Deprecated',
  inactive: 'Not maintained',
  unavailable: 'Unavailable',
}

/**
 * The result of an assessment, rendered as a technical decision record.
 *
 * It reads the assessment the questionnaire persisted locally; with nothing
 * saved it offers the way back rather than inventing a result. Everything on
 * the page is derived from the reader's answers and the dated dataset, so it can
 * be printed, pasted into a document, and argued with line by line.
 * @param props - See {@link ResultViewProps}.
 * @param props.assessmentRoute
 * @returns The record, or an empty state.
 * @example
 * ```tsx
 * <ResultView assessmentRoute="/docs/is-hyperfrontend-right-for-you" />
 * ```
 */
export function ResultView({ assessmentRoute }: ResultViewProps) {
  const [answers, setAnswers] = useState<Record<string, string> | null>(null)
  const [label, setLabel] = useState('')
  const [generatedOn, setGeneratedOn] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    const stored = loadAssessment()
    if (stored) {
      setAnswers(pruneAnswers(stored.answers))
      setLabel(stored.label ?? '')
    } else {
      setAnswers({})
    }
    setGeneratedOn(createDate().toISOString().slice(0, 10))
  }, [])

  const result: EngineResult | null = useMemo(() => (answers ? evaluate(answers) : null), [answers])

  const nameRecord = useCallback(
    (next: string) => {
      setLabel(next)
      if (answers) saveAssessment(next, answers)
    },
    [answers]
  )

  if (answers === null) {
    return (
      <div className="mt-8 h-96 animate-pulse rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40" />
    )
  }

  if (!result || result.answered.length === 0) {
    return (
      <div className="mt-10 rounded-2xl border border-slate-200 p-10 text-center dark:border-slate-800">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">No assessment saved yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
          Results are generated from answers held in your browser, and there are none here. That happens on a new device, in a private
          window, or after clearing the assessment.
        </p>
        <Link
          href={assessmentRoute}
          className="mt-6 inline-block rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
        >
          Start the assessment
        </Link>
      </div>
    )
  }

  const { hyperfrontendFloor, implementations, metadata } = decisionFramework
  const hfRuledOutAnswer = result.hyperfrontend.ruledOutBy
    ? decisionFramework.questions
        .find((question) => question.id === result.hyperfrontend.ruledOutBy?.questionId)
        ?.answers.find((answer) => answer.id === result.hyperfrontend.ruledOutBy?.answerId)
    : undefined
  const conflicting = hyperfrontendFloor.filter((requirement) => result.hyperfrontend.conflicts.includes(requirement.id))
  const floorBySide = {
    participant: hyperfrontendFloor.filter((requirement) => requirement.side === 'participant'),
    host: hyperfrontendFloor.filter((requirement) => requirement.side === 'host'),
    blocker: hyperfrontendFloor.filter((requirement) => requirement.side === 'blocker'),
  }

  return (
    <div className="decision-record mt-8">
      <RecordActions buildRecord={(name) => buildDecisionRecord({ label: name, generatedOn, result })} label={label} onLabel={nameRecord} />

      <header className="border-b border-slate-200 pb-5 dark:border-slate-800">
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">Decision record</h1>
        <dl className="mt-4 grid grid-cols-1 gap-y-2 text-xs sm:grid-cols-3 sm:gap-x-6">
          <MetaPair label="Generated" value={generatedOn} />
          <MetaPair label="Decision framework" value={`v${metadata.frameworkVersion}`} />
          <MetaPair label="Research verified" value={metadata.researchSnapshot} />
        </dl>
      </header>

      {/* why: the verdict leads, because everything after it is the working that produced it */}
      <section className="mt-6">
        <RecordVerdict result={result} />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Your delivery topology</h2>
        <IndependenceSeam result={result} assessmentRoute={assessmentRoute} />
      </section>

      {/* visualization */}
      <section className="mt-10">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">The approaches, and where yours sits</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Every researched approach, banded by the two properties that actually separate them. The bands are cut only where the data leaves
          a gap, and struck entries were ruled out by your requirements.
        </p>
        <BandedLandscape result={result} onSelect={setExpanded} />
      </section>

      {/* hyperfrontend fit */}
      <section className="mt-10">
        {result.hyperfrontend.viable ? (
          <>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Why it fits</h2>
            {result.hyperfrontend.matchedAnswers.length > 0 ? (
              <ul className="mt-4 space-y-2.5">
                {result.hyperfrontend.matchedAnswers.map(({ question, answer }) => (
                  <li
                    key={answer.id}
                    className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20"
                  >
                    <TickIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-900 dark:text-white">{answer.label}</span>
                      <span className="mt-1 block text-xs leading-relaxed text-slate-600 dark:text-slate-400">{answer.consequence}</span>
                      <span className="mt-1 block text-[11px] text-slate-400 dark:text-slate-500">{question.prompt}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                Nothing you told us rules it out, though nothing points squarely at it either. It is viable rather than indicated, and the
                approaches below are worth comparing on their costs.
              </p>
            )}

            <details className="group mt-5 rounded-xl border border-slate-200 dark:border-slate-800">
              <summary className="flex cursor-pointer items-center justify-between gap-3 p-4 text-sm font-medium text-slate-900 dark:text-white">
                What it needs from you
                <ChevronIcon className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t border-slate-100 p-4 dark:border-slate-800">
                <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  It asks less than most approaches, but the floor is not zero. These are the concrete requirements.
                </p>
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  <FloorGroup title="From the feature you want to embed" requirements={floorBySide.participant} />
                  <FloorGroup title="From the page it goes into" requirements={floorBySide.host} />
                </div>
              </div>
            </details>

            {floorBySide.blocker.length > 0 ? (
              <details className="group mt-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <summary className="flex cursor-pointer items-center justify-between gap-3 p-4 text-sm font-medium text-slate-900 dark:text-white">
                  What it cannot do
                  <ChevronIcon className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t border-slate-100 p-4 dark:border-slate-800">
                  <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    Limits of the boundary itself. No amount of configuration removes these, so check none of them is a hard requirement for
                    you.
                  </p>
                  <ul className="mt-3 space-y-2">
                    {floorBySide.blocker.map((requirement) => (
                      <li key={requirement.id} className="text-sm text-slate-700 dark:text-slate-300">
                        {requirement.summary}
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            ) : null}
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">What would make it viable</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              {hfRuledOutAnswer
                ? `Your answer "${hfRuledOutAnswer.label}" rules out the whole separate-document approach, not one product.`
                : 'Your requirements rule out the separate-document approach.'}
            </p>
            {conflicting.length > 0 ? (
              <ul className="mt-4 space-y-3">
                {conflicting.map((requirement) => (
                  <li key={requirement.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{requirement.summary}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{requirement.detail}</p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                      <span className="font-semibold">Would have to change:</span> {requirement.whatWouldHaveToChange}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                The elimination comes from the composition boundary itself rather than from anything adjustable, so there is no change that
                would make it viable here.
              </p>
            )}
          </>
        )}
      </section>

      {/* viable spaces */}
      <section className="mt-10">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Approaches that fit ({result.surviving.length} of {decisionFramework.families.length})
        </h2>
        <div className="mt-4 space-y-3">
          {result.surviving.map((family) => {
            const impls = implementations.filter((impl) => impl.families.includes(family.id))
            const isOpen = expanded === family.id
            return (
              <div key={family.id} className="rounded-xl border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : family.id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 p-4 text-left"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold text-slate-900 dark:text-white">
                      {family.plainName}
                      {family.id === HYPERFRONTEND_FAMILY_ID ? (
                        <span className="ml-2 rounded bg-primary-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-700 dark:bg-primary-950 dark:text-primary-300">
                          HyperFrontend
                        </span>
                      ) : null}
                      {family.kind === 'baseline' ? (
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          single deployment
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{family.boundary}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="hidden text-xs text-slate-400 sm:inline">
                      {impls.length} {impls.length === 1 ? 'implementation' : 'implementations'}
                    </span>
                    <ChevronIcon className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </span>
                </button>

                {isOpen ? (
                  <div className="border-t border-slate-100 p-4 dark:border-slate-800">
                    <p className="text-sm text-slate-600 dark:text-slate-400">{family.definition}</p>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">What it buys</p>
                        <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-400">
                          {family.advantages.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">What it costs</p>
                        <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-400">
                          {family.costs.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    {impls.length > 0 ? (
                      <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                        {impls.map((impl) => (
                          <li key={impl.id} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                            <LogoMark id={impl.id} name={impl.name} />
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-2">
                                {impl.url ? (
                                  <a
                                    href={impl.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-medium text-slate-900 hover:text-primary-600 hover:underline dark:text-white dark:hover:text-primary-400"
                                  >
                                    {impl.name}
                                  </a>
                                ) : (
                                  <span className="text-sm font-medium text-slate-900 dark:text-white">{impl.name}</span>
                                )}
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                    impl.availability === 'available'
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                      : impl.availability === 'available-immature'
                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                  }`}
                                >
                                  {AVAILABILITY_LABELS[impl.availability] ?? impl.availability}
                                </span>
                              </span>
                              <span className="mt-1 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                {impl.differsBy}
                              </span>
                              {impl.note ? (
                                <span className="mt-1 block text-xs italic text-slate-400 dark:text-slate-500">{impl.note}</span>
                              ) : null}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </section>

      {/* eliminations */}
      <section className="mt-10">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">What your answers ruled out, and why</h2>
        <EliminationCascade result={result} />
      </section>

      {/* inputs */}
      <section className="mt-10">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Your answers</h2>

        {/* why: a three-column table is unreadable on a phone, so the same rows render as stacked blocks below the small breakpoint */}
        <ul className="mt-4 space-y-3 sm:hidden">
          {result.answered.map(({ question, answer }) => (
            <li key={question.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">{question.prompt}</p>
              <p className="mt-1.5 text-sm font-medium text-slate-900 dark:text-white">{answer.label}</p>
              <span className="mt-2 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {answer.answerClass === 'hard' ? 'Hard requirement' : 'Preference'}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 hidden sm:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <tr>
                <th className="py-2 pr-4 font-medium">Question</th>
                <th className="py-2 pr-4 font-medium">Answer</th>
                <th className="py-2 font-medium">Weight</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {result.answered.map(({ question, answer }) => (
                <tr key={question.id}>
                  <td className="py-3 pr-4 align-top text-slate-600 dark:text-slate-400">{question.prompt}</td>
                  <td className="py-3 pr-4 align-top font-medium text-slate-900 dark:text-white">{answer.label}</td>
                  <td className="py-3 align-top text-xs text-slate-500 dark:text-slate-400">
                    {answer.answerClass === 'hard' ? 'Hard requirement' : 'Preference'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-10 print:hidden">
        <ResearchDisclosure
          reviewed={metadata.researchSnapshot}
          route="/docs/is-hyperfrontend-right-for-you/result"
          subject="fit assessment result"
          unitCount={metadata.unitCount}
          attributeCount={metadata.attributeCount}
        />
      </div>
    </div>
  )
}

/** Props for the chevron icon. */
interface ChevronIconProps {
  /** Sizing and rotation classes. */
  className?: string
}

function ChevronIcon({ className }: ChevronIconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  )
}

/** Props for {@link FloorGroup}. */
interface FloorGroupProps {
  /** Heading naming which side of the boundary these requirements land on. */
  title: string
  /** The requirements to list. */
  requirements: FloorRequirement[]
}

/**
 * One side of the requirement floor, listed as summaries with the technical
 * detail available on demand.
 *
 * The heading names the side in plain terms, so nothing depends on the reader
 * already knowing the vocabulary the research model uses internally.
 * @param props - See {@link FloorGroupProps}.
 * @param props.title
 * @param props.requirements
 * @returns The grouped requirement list.
 */
function FloorGroup({ title, requirements }: FloorGroupProps) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</p>
      <ul className="mt-2 space-y-2">
        {requirements.map((requirement) => (
          <li key={requirement.id}>
            <details className="group/req">
              <summary className="cursor-pointer text-sm text-slate-700 marker:text-slate-300 dark:text-slate-300">
                {requirement.summary}
              </summary>
              <p className="mt-1 pl-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{requirement.detail}</p>
            </details>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TickIcon({ className }: ChevronIconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  )
}

/** Props for one line of record provenance. */
interface MetaPairProps {
  /** What the value states. */
  label: string
  /** The value itself. */
  value: string
}

/**
 * One provenance pair, set as label and value on a shared baseline so the three
 * of them read as one line rather than as a table of stacked cells.
 * @param props - See {@link MetaPairProps}.
 * @param props.label
 * @param props.value
 * @returns The pair.
 */
function MetaPair({ label, value }: MetaPairProps) {
  return (
    <div className="flex items-baseline gap-2 sm:justify-center">
      <dt className="shrink-0 text-slate-400 dark:text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-700 dark:text-slate-300">{value}</dd>
    </div>
  )
}
