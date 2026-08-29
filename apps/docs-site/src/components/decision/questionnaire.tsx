'use client'

import type { Question } from '../../data/decision-framework'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { max, min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { setTimeout, clearTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { decisionFramework } from '../../data/decision-framework'
import { clearAssessment, evaluate, loadAssessment, pruneAnswers, saveAssessment } from '../../lib/decision-engine'
import { ProgressRing } from './progress-ring'

/** Props for {@link Questionnaire}. */
export interface QuestionnaireProps {
  /** Route the completed assessment navigates to. */
  resultRoute: string
}

/**
 * The assessment itself: one question at a time, with a ring showing position
 * and a running count of how much of the solution space is still open.
 *
 * Showing a single question keeps the reader deciding rather than surveying,
 * and keeps the whole step inside the viewport. Progress is honest about being
 * a moving target, since answering one question can unlock others.
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
  const [architectMode, setArchitectMode] = useState(false)
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
  const remainingFamilies = result.surviving.length

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
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {everythingAnswered ? 'All questions answered' : `Question ${position + 1}`}
            </p>
            <p className="mt-0.5 truncate text-sm text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-900 dark:text-white">{remainingFamilies}</span> of{' '}
              {decisionFramework.families.length} approaches still fit
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setArchitectMode((mode) => !mode)}
              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {architectMode ? 'Plain' : 'Technical'}
            </button>
            {answeredCount > 0 ? (
              <button
                type="button"
                onClick={reset}
                className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Reset
              </button>
            ) : null}
          </div>
        </div>

        {everythingAnswered && position >= sequence.length - 1 ? (
          <div className="p-8 text-center">
            <h2 ref={headingRef} tabIndex={-1} className="text-xl font-bold text-slate-900 outline-none dark:text-white">
              That is everything we need
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
              {answeredCount} answers narrowed {decisionFramework.families.length} architectural approaches down to {remainingFamilies}.
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
              {architectMode ? question.architect : question.circumstance}
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{question.why}</p>

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
