import type { ChainStatus, TaskState } from './execution'
import type { Environment } from './model'

/** What kind of work a target is, as the page groups targets. */
export type Category =
  | 'install'
  | 'typecheck'
  | 'lint'
  | 'test'
  | 'build'
  | 'e2e'
  | 'probe'
  | 'smoke'
  | 'verify'
  | 'publish'
  | 'deploy'
  | 'other'

/** The categories in the order a chain runs them. */
export const CATEGORIES: readonly Category[] = [
  'install',
  'typecheck',
  'lint',
  'test',
  'build',
  'e2e',
  'probe',
  'smoke',
  'verify',
  'publish',
  'deploy',
  'other',
]

/** What each category means, for a tooltip. */
export const CATEGORY_LABEL: Record<Category, string> = {
  install: 'installs an app',
  typecheck: 'typechecks',
  lint: 'lints',
  test: 'runs the unit tests',
  build: 'builds',
  e2e: 'runs the end-to-end tests of a library',
  probe: 'loads the built package on its floor Node.js release',
  smoke: 'drives the packed package from a consumer',
  verify: 'verifies a built app',
  publish: 'publishes to npm, after the Windows and macOS jobs conclude',
  deploy: 'provisions and deploys the demos to Railway',
  other: 'another target',
}

/**
 * The category of a target.
 *
 * @param target - A target name, such as `smoke-floor`
 * @returns Its category
 */
export function categoryOf(target: string): Category {
  if (target.startsWith('smoke')) return 'smoke'
  if (target === 'provision' || target === 'deploy') return 'deploy'
  return (CATEGORIES as readonly string[]).includes(target) ? (target as Category) : 'other'
}

/** One word per task state. */
export const STATE_LABEL: Record<TaskState, string> = {
  success: 'succeeded',
  failure: 'failed',
  skipped: 'skipped',
  cancelled: 'cancelled',
  queued: 'not started',
  blocked: 'waiting on a prerequisite',
  ready: 'running or waiting for a slot',
  unknown: 'no result recorded',
}

/** One glyph per task state. */
export const STATE_GLYPH: Record<TaskState, string> = {
  success: '✓',
  failure: '✕',
  skipped: '→',
  cancelled: '⊘',
  queued: '·',
  blocked: '…',
  ready: '▶',
  unknown: '?',
}

/** The colour variable of each task state; the states that have not ended share the series hue. */
export const STATE_COLOUR: Record<TaskState, string> = {
  success: 'var(--ci-good)',
  failure: 'var(--ci-critical)',
  skipped: 'var(--ci-warning)',
  cancelled: 'var(--ci-serious)',
  queued: 'var(--ci-ink-2)',
  blocked: 'var(--ci-ink-2)',
  ready: 'var(--ci-series-1)',
  unknown: 'var(--ci-ink-2)',
}

/** One word per chain status. */
export const CHAIN_STATUS_LABEL: Record<ChainStatus, string> = {
  queued: 'not started',
  running: 'running',
  success: 'succeeded',
  failure: 'failed',
  cancelled: 'cancelled',
  incomplete: 'incomplete',
}

/** The colour variable of each chain status. */
export const CHAIN_STATUS_COLOUR: Record<ChainStatus, string> = {
  queued: 'var(--ci-ink-2)',
  running: 'var(--ci-series-1)',
  success: 'var(--ci-good)',
  failure: 'var(--ci-critical)',
  cancelled: 'var(--ci-serious)',
  incomplete: 'var(--ci-ink-2)',
}

/** How each environment is named. */
export const ENVIRONMENT_LABEL: Record<Environment, string> = { linux: 'Linux', windows: 'Windows', macos: 'macOS' }

/** The states that have ended. */
export const ENDED_STATES: readonly TaskState[] = ['success', 'failure', 'skipped', 'cancelled']
