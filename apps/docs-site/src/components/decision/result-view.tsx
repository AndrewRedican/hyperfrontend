'use client'

import type { ReactNode } from 'react'
import type { FloorRequirement } from '../../data/decision-framework'
import type { EngineResult, FitStrength } from '../../lib/decision-engine'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createDate } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { decisionFramework } from '../../data/decision-framework'
import { evaluate, HYPERFRONTEND_FAMILY_ID, loadAssessment, pruneAnswers, saveAssessment } from '../../lib/decision-engine'
import { buildDecisionRecord } from '../../lib/decision-record'
import { ResearchDisclosure } from '../research-disclosure'
import { BandedLandscape } from './banded-landscape'
import { EliminationCascade } from './elimination-cascade'
import { IndependenceSeam } from './independence-seam'
import { LogoMark } from './logo-mark'

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
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const labelRef = useRef<HTMLInputElement>(null)

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

  useEffect(() => {
    // why: the label is the one field a reader is expected to fill on arrival, and naming the record is what makes it shareable
    if (generatedOn) labelRef.current?.focus()
  }, [generatedOn])

  const result: EngineResult | null = useMemo(() => (answers ? evaluate(answers) : null), [answers])

  const record = useMemo(
    () => (result && generatedOn ? buildDecisionRecord({ label, generatedOn, result }) : ''),
    [label, generatedOn, result]
  )

  const copy = useCallback(() => {
    void navigator.clipboard?.writeText(record).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      },
      () => setCopied(false)
    )
  }, [record])

  const print = useCallback(() => {
    window.print()
  }, [])

  const updateLabel = useCallback(
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
      {/* record header */}
      <div className="rounded-2xl border border-slate-200 p-6 dark:border-slate-800">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <label htmlFor="record-label" className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Decision record
            </label>
            <input
              ref={labelRef}
              id="record-label"
              type="text"
              value={label}
              onChange={(event) => updateLabel(event.target.value)}
              placeholder="Name this assessment"
              className="mt-1 block w-full border-0 border-b border-transparent bg-transparent p-0 font-display text-2xl font-bold text-slate-900 placeholder:text-slate-300 focus:border-slate-300 focus:outline-none focus:ring-0 dark:text-white dark:placeholder:text-slate-700 print:border-0"
            />
          </div>

          {/* why: the actions stack in their own column so they never share a line with the title, and the label keeps the full width of the container for the meta line below */}
          <div className="flex shrink-0 flex-col gap-2 print:hidden sm:w-52">
            <RecordAction onClick={copy} icon={copied ? <TickIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}>
              {copied ? 'Copied' : 'Copy as Markdown'}
            </RecordAction>
            <RecordAction onClick={print} icon={<PrinterIcon className="h-4 w-4" />}>
              Print or save as PDF
            </RecordAction>
            <RecordAction href={assessmentRoute} icon={<PencilIcon className="h-4 w-4" />}>
              Change answers
            </RecordAction>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-4 text-xs dark:border-slate-800 sm:grid-cols-4">
          <div>
            <dt className="text-slate-400 dark:text-slate-500">Generated</dt>
            <dd className="mt-0.5 font-medium text-slate-700 dark:text-slate-300">{generatedOn}</dd>
          </div>
          <div>
            <dt className="text-slate-400 dark:text-slate-500">Decision framework</dt>
            <dd className="mt-0.5 font-medium text-slate-700 dark:text-slate-300">v{metadata.frameworkVersion}</dd>
          </div>
          <div>
            <dt className="text-slate-400 dark:text-slate-500">Research verified</dt>
            <dd className="mt-0.5 font-medium text-slate-700 dark:text-slate-300">{metadata.researchSnapshot}</dd>
          </div>
          <div>
            <dt className="text-slate-400 dark:text-slate-500">Stored</dt>
            <dd className="mt-0.5 font-medium text-slate-700 dark:text-slate-300">In this browser only</dd>
          </div>
        </dl>
      </div>

      {/* verdict */}
      <section className="mt-6">
        {result.hyperfrontend.viable && result.outcome === 'microfrontend' ? (
          <div className="overflow-hidden rounded-2xl border border-emerald-300 bg-emerald-50 dark:border-emerald-800/70 dark:bg-emerald-950/30">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:gap-6">
              {/* why: the mark fills the container height on wide screens so the verdict reads before any text does, and caps to a badge on narrow ones */}
              <div className="flex shrink-0 items-stretch justify-center bg-emerald-100 px-6 py-5 dark:bg-emerald-900/40 sm:px-6 sm:py-6">
                <VerdictTickIcon className="h-14 w-14 self-center text-emerald-600 dark:text-emerald-400 sm:h-auto sm:min-h-[7.5rem] sm:w-20 sm:self-stretch" />
              </div>
              <div className="min-w-0 flex-1 px-6 py-5 sm:pl-0 sm:pr-7">
                <p className="flex items-center gap-2">
                  <ProductLogo className="h-5 w-5 shrink-0" />
                  <span className="font-display text-lg font-bold text-slate-900 dark:text-white">HyperFrontend</span>
                </p>
                <h2 className="mt-2 text-xl font-bold text-emerald-900 dark:text-emerald-200">
                  {fitHeadline(result.hyperfrontend.strength)}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-emerald-900/80 dark:text-emerald-100/80">
                  {fitSubline(result.hyperfrontend.strength, result.hyperfrontend.alternatives)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div
            className={`rounded-2xl border p-6 ${
              result.outcome === 'no-match'
                ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
                : 'border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50'
            }`}
          >
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {result.outcome === 'no-match'
                ? 'No researched approach satisfies every requirement'
                : result.outcome === 'baselines-only'
                  ? 'You do not need microfrontends'
                  : 'HyperFrontend is not the right fit'}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {result.outcome === 'no-match'
                ? 'Your requirements combine in a way nothing in the researched set satisfies. That is a real finding rather than a failure to choose: the section below names which single requirement would reopen which options.'
                : result.outcome === 'baselines-only'
                  ? 'Every approach that survives your answers ships as one deployment. Adopting a microfrontend architecture would add coordination and runtime cost without buying independence you need.'
                  : 'Your answers rule out the architecture HyperFrontend implements. What follows is which approaches do fit, and exactly what would have to change for it to become viable.'}
            </p>
          </div>
        )}
      </section>

      {/* how the reader's own delivery works, before the landscape they are choosing from */}
      <section className="mt-10">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">How your delivery works</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Who ships each piece, what they hand over, where the pieces are joined, and what reaches the user. Drawn only from what you told
          us: anything still open is a link back to the question that settles it.
        </p>
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

/**
 * The headline for a viable verdict, graded by how strongly the answers point
 * at this approach rather than merely permitting it.
 * @param strength - The graded fit from the engine.
 * @returns The headline sentence.
 */
function fitHeadline(strength: FitStrength): string {
  switch (strength) {
    case 'only-option':
      return 'Excellent. It is the only approach that fits'
    case 'strong':
      return 'Excellent. It is a strong fit'
    case 'good':
      return 'Good news. It is a good fit'
    default:
      return 'It fits your situation'
  }
}

/**
 * The supporting line for a viable verdict, which stays honest about company:
 * surviving alongside six other approaches is not the same as winning.
 * @param strength - The graded fit from the engine.
 * @param alternatives - How many other microfrontend approaches also survive.
 * @returns The supporting sentence.
 */
function fitSubline(strength: FitStrength, alternatives: number): string {
  if (strength === 'only-option') return 'No other researched approach meets every requirement you stated.'
  if (alternatives === 1) return 'One other approach also meets your requirements. Both are shown below.'
  return `${alternatives} other approaches also meet your requirements, and are shown below.`
}

/** Props for the product logo. */
interface ProductLogoProps {
  /** Sizing classes. */
  className?: string
}

function ProductLogo({ className }: ProductLogoProps) {
  return (
    <>
      <img src="/hf-light.svg" alt="" aria-hidden="true" className={`${className ?? ''} block dark:hidden`} />
      <img src="/hf-dark.svg" alt="" aria-hidden="true" className={`${className ?? ''} hidden dark:block`} />
    </>
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

/** Props for a record action, which renders as a button or a link. */
interface RecordActionProps {
  /** Leading icon. */
  icon: ReactNode
  /** Action label. */
  children: ReactNode
  /** Click handler, for actions that act on the page. */
  onClick?: () => void
  /** Destination, for actions that navigate. */
  href?: string
}

/**
 * One action in the record's action column, kept visually identical whether it
 * navigates or acts in place.
 * @param props - See {@link RecordActionProps}.
 * @param props.icon
 * @param props.children
 * @param props.onClick
 * @param props.href
 * @returns The action control.
 */
function RecordAction({ icon, children, onClick, href }: RecordActionProps) {
  const shared =
    'flex w-full items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
  if (href) {
    return (
      <Link href={href} className={shared}>
        {icon}
        {children}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} className={shared}>
      {icon}
      {children}
    </button>
  )
}

function CopyIcon({ className }: ChevronIconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5A3.375 3.375 0 0 0 6.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0 0 15 2.25h-1.5a2.251 2.251 0 0 0-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 0 0-9-9Z"
      />
    </svg>
  )
}

function PrinterIcon({ className }: ChevronIconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Z"
      />
    </svg>
  )
}

function PencilIcon({ className }: ChevronIconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125"
      />
    </svg>
  )
}

function TickIcon({ className }: ChevronIconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  )
}

function VerdictTickIcon({ className }: ChevronIconProps) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" stroke="currentColor" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <circle cx="24" cy="24" r="20" strokeWidth={2.5} className="opacity-30" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="m14 24.5 7 7 13-15" />
    </svg>
  )
}
