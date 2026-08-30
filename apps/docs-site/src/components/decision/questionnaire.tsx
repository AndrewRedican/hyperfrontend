'use client'

import type { Question } from '../../data/decision-framework'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { max, min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { setTimeout, clearTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { clearAssessment, evaluate, loadAssessment, pruneAnswers, saveAssessment } from '../../lib/decision-engine'
import { ProgressRing } from './progress-ring'

/** Props for {@link Questionnaire}. */
export interface QuestionnaireProps {
  /** Route the completed assessment navigates to. */
  resultRoute: string
}

/**
 * The assessment itself: one question at a time, with a ring showing position.
 *
 * Showing a single question keeps the reader deciding rather than surveying,
 * and keeps the whole step inside the viewport. Progress is honest about being
 * a moving target, since answering one question can unlock others. Each question
 * is asked once, plainly, with its mechanism available underneath on request.
 * @param props - See {@link QuestionnaireProps}.
 * @param props.resultRoute
 * @returns The questionnaire.
 * @example
 * ```tsx
 * <Questionnaire resultRoute="/docs/is-hyperfrontend-right-for-you/result" />
 * ```
 */
export function Questionnaire({ resultRoute }: QuestionnaireProps) {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [cursor, setCursor] = useState(0)
  const [restored, setRestored] = useState(false)
  const [justAnswered, setJustAnswered] = useState<string | null>(null)
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const stored = loadAssessment()
    if (stored) setAnswers(pruneAnswers(stored.answers))
    setRestored(true)
  }, [])

  useEffect(() => {
    if (restored) saveAssessment(loadAssessment()?.label ?? '', answers)
  }, [answers, restored])

  useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current)
    },
    []
  )

  const result = useMemo(() => evaluate(answers), [answers])
  const sequence: Question[] = result.relevant
  const position = min(cursor, sequence.length - 1)
  const question = sequence[position]
  const answeredCount = result.answered.length

  const focusHeading = useCallback(() => {
    headingRef.current?.focus()
  }, [])

  const select = useCallback(
    (questionId: string, answerId: string) => {
      setAnswers((previous) => pruneAnswers({ ...previous, [questionId]: answerId }))
      setJustAnswered(answerId)
      if (advanceTimer.current) clearTimeout(advanceTimer.current)
      advanceTimer.current = setTimeout(() => {
        setJustAnswered(null)
        setCursor((current) => current + 1)
        focusHeading()
      }, 260)
    },
    [focusHeading]
  )

  const back = useCallback(() => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current)
    setJustAnswered(null)
    setCursor((current) => max(current - 1, 0))
    focusHeading()
  }, [focusHeading])

  const reset = useCallback(() => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current)
    setAnswers({})
    setCursor(0)
    setJustAnswered(null)
    clearAssessment()
    focusHeading()
  }, [focusHeading])

  const finish = useCallback(() => {
    saveAssessment(loadAssessment()?.label ?? '', answers)
    router.push(resultRoute)
  }, [answers, resultRoute, router])

  if (!restored) {
    return (
      <div className="mt-8 h-72 animate-pulse rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40" />
    )
  }

  const everythingAnswered = result.next === null && answeredCount > 0

  return (
    <div className="mt-8">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
        <div className="flex items-center gap-4 border-b border-slate-200 p-5 dark:border-slate-800">
          <ProgressRing value={answeredCount} total={max(sequence.length, answeredCount)} label="Assessment progress" />
          <p className="min-w-0 flex-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {everythingAnswered ? 'All questions answered' : `Question ${position + 1}`}
          </p>
          {answeredCount > 0 ? (
            <button
              type="button"
              onClick={reset}
              className="shrink-0 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Reset
            </button>
          ) : null}
        </div>

        {everythingAnswered && position >= sequence.length - 1 ? (
          <div className="p-8 text-center">
            <h2 ref={headingRef} tabIndex={-1} className="text-xl font-bold text-slate-900 outline-none dark:text-white">
              That is everything we need
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
              Your result explains which approaches fit your answers, and why the others do not.
            </p>
            <button
              type="button"
              onClick={finish}
              className="mt-6 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
            >
              See your result
            </button>
            <div className="mt-4">
              <button type="button" onClick={back} className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-200">
                Change my last answer
              </button>
            </div>
          </div>
        ) : question ? (
          <div className="p-6 sm:p-8">
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="text-lg font-semibold leading-snug text-slate-900 outline-none dark:text-white sm:text-xl"
            >
              {question.prompt}
            </h2>

            {/* why: keying the element to the question collapses it again on every step, so the note is offered rather than left hanging open */}
            <details key={question.id} className="group mt-3">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 [&::-webkit-details-marker]:hidden">
                <InfoIcon className="h-3.5 w-3.5 shrink-0" />
                What this means
                <ChevronIcon className="h-3 w-3 shrink-0 transition-transform group-open:rotate-90" />
              </summary>
              <div className="mt-2 space-y-2 border-l-2 border-slate-200 pl-3 text-xs leading-relaxed text-slate-600 dark:border-slate-700 dark:text-slate-400">
                <p>{question.technicalNote}</p>
                <p className="text-slate-500 dark:text-slate-500">Why we ask: {question.why}</p>
              </div>
            </details>

            <div className="mt-5 space-y-2.5">
              {question.answers.map((answer) => {
                const isSelected = answers[question.id] === answer.id
                const isPending = justAnswered === answer.id
                return (
                  <button
                    key={answer.id}
                    type="button"
                    onClick={() => select(question.id, answer.id)}
                    aria-pressed={isSelected}
                    className={`block w-full rounded-xl border p-4 text-left transition ${
                      isSelected || isPending
                        ? 'border-primary-500 bg-primary-50 dark:border-primary-500 dark:bg-primary-950/40'
                        : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <span className="block text-sm font-medium text-slate-900 dark:text-white">{answer.label}</span>
                    {answer.detail ? <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{answer.detail}</span> : null}
                  </button>
                )
              })}
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={back}
                disabled={position === 0}
                className="text-xs font-medium text-slate-500 disabled:opacity-40 dark:text-slate-400"
              >
                Back
              </button>
              {answeredCount > 0 ? (
                <button type="button" onClick={finish} className="text-xs font-medium text-primary-600 dark:text-primary-400">
                  Skip ahead to the result
                </button>
              ) : (
                <span className="text-xs text-slate-400 dark:text-slate-500">Pick the closest answer</span>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** Props for the inline note icons. */
interface IconProps {
  /** Sizing and color classes. */
  className?: string
}

function InfoIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 11v5.5M12 7.75h.01" />
    </svg>
  )
}

function ChevronIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}
