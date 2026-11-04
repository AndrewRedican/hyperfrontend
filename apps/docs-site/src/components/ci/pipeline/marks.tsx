import type { ChainStatus, ExecutionStatus, JobStatus, TaskState } from '@/lib/ci/execution'
import type { Environment, RunOutcome } from '@/lib/ci/model'
import type { Category } from '@/lib/ci/vocabulary'
import { CATEGORY_LABEL, CHAIN_STATUS_LABEL, ENVIRONMENT_LABEL, STATE_COLOUR, STATE_LABEL } from '@/lib/ci/vocabulary'

/** Props for {@link StateMark}. */
export interface StateMarkProps {
  /** The state */
  state: TaskState
  /** What the mark is of, for the label: `lib-a:build` or `the run` */
  of?: string
  /** The side of the mark, in pixels */
  size?: number
  /** Extra classes */
  className?: string
}

/** The strokes inside the ring of each state, on a 16-unit square. */
const STATE_PATH: Record<TaskState, string> = {
  success: 'M4.5 8.3l2.3 2.3 4.7-5',
  failure: 'M5.3 5.3l5.4 5.4 M10.7 5.3l-5.4 5.4',
  skipped: 'M4.5 8h7 M8.8 5.3L11.5 8l-2.7 2.7',
  cancelled: 'M4.8 11.2l6.4-6.4',
  queued: 'M8 8h0.01',
  blocked: 'M4.5 8h0.01 M8 8h0.01 M11.5 8h0.01',
  ready: 'M6.3 5.2v5.6L10.8 8z',
  unknown: 'M6.2 6.4a1.8 1.8 0 1 1 2.6 1.6c-.6.3-.8.6-.8 1.2 M8 11.3h0.01',
}

/** The states drawn as a filled ring; the rest are hollow. */
const FILLED: readonly TaskState[] = ['success', 'failure', 'ready']

/**
 * One state as a small ring: filled for an ended task that ran and for a running one, hollow
 * for the rest, with a stroke that says which, so colour is never the only difference.
 * @param props - See {@link StateMarkProps}.
 * @param props.state
 * @param props.of
 * @param props.size
 * @param props.className
 * @returns The mark
 */
export function StateMark({ state, of = '', size = 14, className = '' }: StateMarkProps) {
  const filled = FILLED.includes(state)
  const label = of === '' ? STATE_LABEL[state] : `${of}: ${STATE_LABEL[state]}`
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      role="img"
      aria-label={label}
      className={`inline-block shrink-0 align-[-2px] ${state === 'ready' ? 'ci-pulse' : ''} ${className}`}
      style={{ color: STATE_COLOUR[state] }}
    >
      <title>{label}</title>
      <circle
        cx="8"
        cy="8"
        r="6.5"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray={state === 'queued' ? '1.5 2' : state === 'blocked' ? '3 2' : undefined}
      />
      <path
        d={STATE_PATH[state]}
        fill="none"
        stroke={filled ? 'var(--ci-surface)' : 'currentColor'}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * The state a run or job stands in, as a task state for its mark.
 * @param status - Where it stands
 * @param outcome - What it ended as, or null
 * @returns The state
 */
export function stateOfRun(status: ExecutionStatus | JobStatus, outcome: RunOutcome | string | null): TaskState {
  if (status === 'queued') return 'queued'
  if (status === 'in_progress' || status === 'running') return 'ready'
  switch (outcome) {
    case 'success':
      return 'success'
    case 'failure':
    case 'timed_out':
    case 'startup_failure':
    case 'action_required':
      return 'failure'
    case 'cancelled':
      return 'cancelled'
    case 'skipped':
    case 'neutral':
      return 'skipped'
    default:
      return 'unknown'
  }
}

/**
 * The state a chain stands in, as a task state for its mark.
 * @param status - The chain's status
 * @returns The state
 */
export function stateOfChain(status: ChainStatus): TaskState {
  switch (status) {
    case 'queued':
      return 'queued'
    case 'running':
      return 'ready'
    case 'incomplete':
      return 'unknown'
    default:
      return status
  }
}

/** Props for {@link ChainMark}. */
export interface ChainMarkProps {
  /** The chain's status */
  status: ChainStatus
  /** What the mark is of */
  of: string
  /** The side, in pixels */
  size?: number
}

/**
 * A chain's status as a mark.
 * @param props - See {@link ChainMarkProps}.
 * @param props.status
 * @param props.of
 * @param props.size
 * @returns The mark
 */
export function ChainMark({ status, of, size = 14 }: ChainMarkProps) {
  return <StateMark state={stateOfChain(status)} of={`${of}: ${CHAIN_STATUS_LABEL[status]}`} size={size} />
}

/** The strokes of each platform icon, on a 24-unit square. */
const OS_PATH: Record<Environment, string> = {
  linux:
    'M12 3a4 4 0 0 1 4 4v2.5c0 1.2 2.2 3.3 2.2 6.3 0 1.4-.8 2.2-1.7 2.2h-9c-.9 0-1.7-.8-1.7-2.2 0-3 2.2-5.1 2.2-6.3V7a4 4 0 0 1 4-4z M10 8.2h.01 M14 8.2h.01 M11 10.3h2l-1 1.2z M8.5 18l-1.7 2.3c-.4.6 0 1.2.7 1.2h2.3 M15.5 18l1.7 2.3c.4.6 0 1.2-.7 1.2h-2.3',
  windows: 'M4 6.2l7-1v7.1H4z M12.5 5l7.5-1v8.3h-7.5z M4 13.7h7v7.1l-7-1z M12.5 13.7H20V22l-7.5-1z',
  // why: the command key, a symbol every Mac keyboard carries, stands for macOS without drawing Apple's trademarked logo
  macos:
    'M9 9h6v6H9z M9 9H6.5A2.5 2.5 0 1 1 9 6.5z M15 9h2.5A2.5 2.5 0 1 0 15 6.5z M9 15H6.5A2.5 2.5 0 1 0 9 17.5z M15 15h2.5a2.5 2.5 0 1 1-2.5 2.5z',
}

/**
 * The strokes of a platform icon, for a drawing inside another SVG.
 * @param environment - The environment
 * @returns The path data, on a 24-unit square
 */
export function osPath(environment: Environment): string {
  return OS_PATH[environment]
}

/** Props for {@link OsIcon}. */
export interface OsIconProps {
  /** The environment */
  environment: Environment
  /** Extra classes, sizing it */
  className?: string
  /** Whether the name is also shown beside it */
  named?: boolean
}

/**
 * A platform as a small icon, named for a screen reader and a tooltip.
 * @param props - See {@link OsIconProps}.
 * @param props.environment
 * @param props.className
 * @param props.named
 * @returns The icon
 */
export function OsIcon({ environment, className = 'h-3.5 w-3.5', named = false }: OsIconProps) {
  const label = ENVIRONMENT_LABEL[environment]
  return (
    <span className="inline-flex items-center gap-1" title={label}>
      <svg viewBox="0 0 24 24" className={`inline-block shrink-0 ${className}`} role="img" aria-label={label}>
        <title>{label}</title>
        <path d={OS_PATH[environment]} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {named ? <span>{label}</span> : null}
    </span>
  )
}

/** The strokes of each category icon, on a 24-unit square. */
const CATEGORY_PATH: Record<Category, string> = {
  install: 'M12 3v11 M8 10l4 4 4-4 M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  typecheck: 'M5 5h10 M10 5v9 M13 17l2.5 2.5L20 15',
  lint: 'M4 7h12 M4 12h8 M4 17h5 M14 16l2.3 2.3L21 13.5',
  test: 'M9 3h6 M10 3v6l-5 9.5A1.5 1.5 0 0 0 6.3 21h11.4a1.5 1.5 0 0 0 1.3-2.5L14 9V3 M7.5 15h9',
  build: 'M3.5 7.5L12 3.5l8.5 4v9L12 20.5l-8.5-4z M3.5 7.5L12 11.5l8.5-4 M12 11.5v9',
  e2e: 'M5 4.5h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2z M3 9h18 M9 13l2 2-2 2 M13 17h3',
  probe: 'M8 3v5 M16 3v5 M6 8h12v3a6 6 0 0 1-12 0z M12 17v4',
  smoke: 'M7 17.5a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.6 1.5A3.3 3.3 0 0 1 17 17.5z M9 21h6',
  verify: 'M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z M9 12l2 2 4-4',
  publish: 'M12 14V3 M8 7l4-4 4 4 M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  deploy: 'M12 3c3 2 5 6 5 10l-2 2-3-2-3 2-2-2c0-4 2-8 5-10z M9 15l-3 4 M15 15l3 4 M12 9h.01',
  other: 'M12 12h.01 M7 12h.01 M17 12h.01',
}

/** Props for {@link TargetIcon}. */
export interface TargetIconProps {
  /** The category */
  category: Category
  /** Extra classes, sizing it */
  className?: string
}

/**
 * A category of target as a small icon, named for a screen reader and a tooltip.
 * @param props - See {@link TargetIconProps}.
 * @param props.category
 * @param props.className
 * @returns The icon
 */
export function TargetIcon({ category, className = 'h-3.5 w-3.5' }: TargetIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={`inline-block shrink-0 ${className}`} role="img" aria-label={category}>
      <title>{`${category}: ${CATEGORY_LABEL[category]}`}</title>
      <path d={CATEGORY_PATH[category]} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * The strokes of a category icon, for a drawing inside another SVG.
 * @param category - The category
 * @returns The path data
 */
export function categoryPath(category: Category): string {
  return CATEGORY_PATH[category]
}

/** Props for {@link ExternalLink}. */
export interface ExternalLinkProps {
  /** The address */
  href: string
  /** The text */
  children: React.ReactNode
  /** Extra classes */
  className?: string
  /** A title */
  title?: string
}

/**
 * A link to GitHub that opens in a new tab and never selects the row it sits in.
 * @param props - See {@link ExternalLinkProps}.
 * @param props.href
 * @param props.children
 * @param props.className
 * @param props.title
 * @returns The link
 */
export function ExternalLink({ href, children, className = '', title }: ExternalLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className={`underline decoration-slate-300 underline-offset-2 hover:decoration-current dark:decoration-slate-600 ${className}`}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </a>
  )
}
