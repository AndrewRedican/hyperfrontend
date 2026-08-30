'use client'

import type { EngineResult } from '../../lib/decision-engine'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { decisionFramework } from '../../data/decision-framework'

/** Props for {@link EliminationCascade}. */
export interface EliminationCascadeProps {
  /** The evaluated assessment whose eliminations are explained. */
  result: EngineResult
}

/** One answer and everything it removed. */
interface CascadeRow {
  /** Stable answer id, used as the row key. */
  answerId: string
  /** The question as the reader saw it. */
  question: string
  /** The answer they chose. */
  answer: string
  /** The architectural consequence of that answer. */
  consequence: string
  /** Whether the answer stated a hard requirement or a preference. */
  hard: boolean
  /** Plain names of the families this answer removed. */
  removed: string[]
}

/**
 * Explains every elimination as a chain from the answer that caused it.
 *
 * The decision model is not a tree: one answer can remove several families, and
 * a family can be removed for more than one reason. This renders the relation
 * honestly, as answers on the left flowing to the approaches each one closed
 * off, rather than forcing a branching diagram the model does not have.
 * @param props - See {@link EliminationCascadeProps}.
 * @param props.result
 * @returns The cascade, or a note when nothing has been ruled out.
 * @example
 * ```tsx
 * <EliminationCascade result={evaluate(answers)} />
 * ```
 */
export function EliminationCascade({ result }: EliminationCascadeProps) {
  const familyNames = createMap(decisionFramework.families.map((family) => [family.id, family.name]))

  const rows: CascadeRow[] = result.answered
    .map(({ question, answer }) => ({
      answerId: answer.id,
      question: question.prompt,
      answer: answer.label,
      consequence: answer.consequence,
      hard: answer.answerClass === 'hard',
      removed: result.eliminated
        .filter((entry) => entry.by.answerId === answer.id)
        .map((entry) => familyNames.get(entry.family.id) ?? entry.family.id),
    }))
    .filter((row) => row.removed.length > 0)

  if (rows.length === 0) {
    return (
      <p className="mt-4 rounded-lg border border-slate-200 p-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
        Nothing has been ruled out. Every approach in the dataset is still compatible with what you told us, which usually means the
        decisive constraints have not come up yet.
      </p>
    )
  }

  return (
    <ol className="mt-4 space-y-3">
      {rows.map((row) => (
        <li key={row.answerId} className="rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="grid gap-0 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-stretch">
            <div className="p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">{row.question}</p>
              <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">{row.answer}</p>
              <span
                className={`mt-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  row.hard
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {row.hard ? 'Hard requirement' : 'Preference'}
              </span>
            </div>

            <div className="flex items-center justify-center px-2 py-1 sm:py-0" aria-hidden="true">
              <svg viewBox="0 0 40 24" className="h-6 w-10 rotate-90 text-slate-300 dark:text-slate-700 sm:rotate-0">
                <path d="M2 12h30" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" fill="none" />
                <path d="M30 7l6 5-6 5z" fill="currentColor" />
              </svg>
            </div>

            <div className="rounded-b-xl bg-slate-50 p-4 dark:bg-slate-900/50 sm:rounded-l-none sm:rounded-r-xl">
              <p className="text-xs text-slate-500 dark:text-slate-400">Rules out</p>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {row.removed.map((name) => (
                  <li
                    key={name}
                    className="rounded-md bg-white px-2 py-1 text-xs text-slate-600 line-through decoration-slate-400 dark:bg-slate-800 dark:text-slate-400"
                  >
                    {name}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{row.consequence}</p>
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}
