import type { ReactNode } from 'react'
import { FetchFailure } from '@/lib/ci/fetch'

/** What the placeholder stands in for: data on its way, data that does not exist yet, or data that failed. */
export type PlaceholderState = 'loading' | 'empty' | 'error'

/** Why an explorer has nothing to draw yet. */
export interface PendingState {
  /** Loading, empty or error */
  state: PlaceholderState
  /** A second line for the placeholder, or null */
  detail: string | null
}

/** Why an explorer has nothing to draw yet, or null once it has. */
export type Pending = PendingState | null

/** Props for the motifs. */
interface MotifProps {
  /** Loading, empty or error */
  state: PlaceholderState
}

/**
 * A failed read in a few words: the status GitHub answered, rather than the address asked.
 * @param error - What the read threw
 * @returns The sentence
 */
export function describeFailure(error: unknown): string {
  if (error instanceof FetchFailure) return error.status === 0 ? 'The request did not complete.' : `GitHub answered ${error.status}.`
  return error instanceof Error ? error.message : String(error)
}

/**
 * What a failed read means to the reader: a missing file is nothing recorded yet, anything else
 * an error worth retrying.
 * @param error - What the read threw
 * @returns The pending state
 */
export function pendingOf(error: unknown): Pending {
  if (error instanceof FetchFailure && error.status === 404) return { state: 'empty', detail: null }
  return { state: 'error', detail: describeFailure(error) }
}

/** The drawing a placeholder shows: a few linked nodes, or a few timeline bars. */
export type PlaceholderMotif = 'graph' | 'pipeline'

/** Props for {@link Placeholder}. */
export interface PlaceholderProps {
  /** Loading, empty or error */
  state: PlaceholderState
  /** The drawing */
  motif: PlaceholderMotif
  /** One short line */
  title: string
  /** A second line, or nothing */
  detail?: string | null
  /** Called by the retry button; no button without it */
  onRetry?: (() => void) | null
}

/** The nodes of the graph motif, as centre points. */
const NODES: readonly (readonly [number, number])[] = [
  [24, 48],
  [72, 20],
  [72, 76],
  [120, 34],
  [120, 70],
  [168, 52],
]

/** The edges of the graph motif, as node indices; the last one breaks in the error state. */
const EDGES: readonly (readonly [number, number])[] = [
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 4],
  [3, 5],
  [1, 4],
  [4, 5],
]

/** The bars of the pipeline motif: row, start and width; the third one fails in the error state. */
const BARS: readonly (readonly [number, number, number])[] = [
  [0, 8, 52],
  [0, 66, 86],
  [1, 22, 70],
  [1, 98, 40],
  [2, 8, 34],
  [2, 48, 120],
]

/**
 * The graph motif.
 * @param props - The state
 * @param props.state - Loading, empty or error
 * @returns The drawing
 */
function GraphMotif({ state }: MotifProps) {
  const broken = EDGES.length - 1
  return (
    <>
      {EDGES.map(([from, to], index) => {
        const [x1, y1] = NODES[from] as readonly [number, number]
        const [x2, y2] = NODES[to] as readonly [number, number]
        const isBroken = state === 'error' && index === broken
        return (
          <line
            key={index}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={isBroken ? 'var(--ci-critical)' : 'var(--ci-line)'}
            strokeWidth="2"
            strokeDasharray={isBroken ? '4 10' : state === 'empty' ? '3 4' : undefined}
          />
        )
      })}
      {NODES.map(([cx, cy], index) => (
        <circle
          key={index}
          cx={cx}
          cy={cy}
          r="8"
          className={state === 'loading' ? 'ci-placeholder__pulse' : undefined}
          style={{ animationDelay: `${index * 160}ms` }}
          fill={
            state === 'empty'
              ? 'var(--ci-surface)'
              : state === 'error' && index === NODES.length - 1
                ? 'var(--ci-critical)'
                : 'var(--ci-series-1)'
          }
          stroke={state === 'empty' ? 'var(--ci-line)' : 'var(--ci-surface)'}
          strokeWidth="2"
          strokeDasharray={state === 'empty' ? '3 3' : undefined}
        />
      ))}
    </>
  )
}

/**
 * The pipeline motif.
 * @param props - The state
 * @param props.state - Loading, empty or error
 * @returns The drawing
 */
function PipelineMotif({ state }: MotifProps) {
  return (
    <>
      {[0, 1, 2].map((row) => (
        <line key={row} x1="4" x2="188" y1={22 + row * 26} y2={22 + row * 26} stroke="var(--ci-line)" strokeWidth="1" opacity="0.6" />
      ))}
      {BARS.map(([row, x, width], index) => (
        <rect
          key={index}
          x={x}
          y={14 + row * 26}
          width={width}
          height="16"
          rx="4"
          className={state === 'loading' ? 'ci-placeholder__pulse' : undefined}
          style={{ animationDelay: `${index * 140}ms` }}
          fill={
            state === 'empty'
              ? 'var(--ci-surface)'
              : state === 'error' && index === 2
                ? 'var(--ci-critical)'
                : index % 2 === 0
                  ? 'var(--ci-series-1)'
                  : 'var(--ci-good)'
          }
          stroke={state === 'empty' ? 'var(--ci-line)' : 'none'}
          strokeWidth="1.5"
          strokeDasharray={state === 'empty' ? '3 3' : undefined}
        />
      ))}
    </>
  )
}

/**
 * What an explorer shows in place of its view while there is nothing to draw: a small drawing of
 * what will be there, one line saying why, and a retry when something failed.
 * @param props - See {@link PlaceholderProps}.
 * @param props.state - Loading, empty or error
 * @param props.motif - The drawing
 * @param props.title - The line
 * @param props.detail - The second line
 * @param props.onRetry - The retry
 * @returns The placeholder
 */
export function Placeholder({ state, motif, title, detail = null, onRetry = null }: PlaceholderProps): ReactNode {
  return (
    <div
      role={state === 'error' ? 'alert' : 'status'}
      aria-busy={state === 'loading'}
      className={`mt-6 flex min-h-72 flex-col items-center justify-center gap-4 rounded-xl border px-6 py-10 text-center ${
        state === 'error'
          ? 'border-rose-200 bg-rose-50/40 dark:border-rose-900/60 dark:bg-rose-950/20'
          : state === 'empty'
            ? 'border-dashed border-slate-300 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-900/40'
            : 'border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/40'
      }`}
    >
      <svg aria-hidden="true" viewBox="0 0 192 96" className="h-24 w-48 max-w-full" opacity={state === 'empty' ? 0.8 : 1}>
        {motif === 'graph' ? <GraphMotif state={state} /> : <PipelineMotif state={state} />}
      </svg>
      <div className="max-w-md">
        <p className="font-medium text-slate-900 dark:text-white">{title}</p>
        {detail === null ? null : (
          <p className={`mt-1 text-sm ${state === 'error' ? 'text-rose-700 dark:text-rose-300' : 'text-slate-600 dark:text-slate-400'}`}>
            {detail}
          </p>
        )}
      </div>
      {onRetry === null ? null : (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full border border-slate-300 px-4 py-1 text-sm font-medium text-slate-700 hover:bg-white dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Try again
        </button>
      )}
    </div>
  )
}
