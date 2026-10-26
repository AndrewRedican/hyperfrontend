/**
 * Registry drift: which publishable libraries carry a version the registry positively lacks, so
 * `main` can publish them whether or not the push touched them. A registry that cannot be
 * reached counts as having every version, so an outage never schedules work.
 *
 * @module pipeline/registry
 */

import type { PackageManifest, ProjectRecord } from '../graph/model'
import type { CommandResult, runCommand } from './execute'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { promiseAll } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { compareText } from '../graph/order'
import { isPublishable } from './fold'

/** What the registry says about one version. */
export const Presence = freeze({
  /** The registry has it. */
  Present: 'present',
  /** The registry answered that it has no such version or package. */
  Absent: 'absent',
  /** The registry could not be asked, or answered something else. */
  Unknown: 'unknown',
} as const)

/** One of the answers. */
export type Presence = (typeof Presence)[keyof typeof Presence]

/** Asks the registry about one version. */
export type RegistryProbe = (name: string, version: string) => Promise<Presence>

/** How the npm probe runs. */
export interface NpmProbeOptions {
  /** The working directory. */
  readonly cwd: string
  /** How long one query may take, in milliseconds. */
  readonly timeoutMs?: number
  /** Runs npm. */
  readonly run: typeof runCommand
}

/** A version no package publishes. */
const UNRELEASED = '0.0.0'

/** How long one `npm view` may take. */
const DEFAULT_TIMEOUT_MS = 30_000

/**
 * What an `npm view <name>@<version> version --json` answer means.
 *
 * @param result - What npm ended as
 * @param version - The version asked about
 * @returns Present when npm printed the version, absent when it answered 404, else unknown
 */
export function classifyView(result: CommandResult, version: string): Presence {
  if (result.stdout.trim() === `"${version}"`) return Presence.Present
  if (!result.timedOut && result.error === null && result.stderr.includes('E404')) return Presence.Absent
  return Presence.Unknown
}

/**
 * A probe asking npm.
 *
 * @param options - The working directory, the time limit and the runner
 * @returns A probe running `npm view`
 */
export function npmProbe(options: NpmProbeOptions): RegistryProbe {
  return async (name, version) =>
    classifyView(
      await options.run(['npm', 'view', `${name}@${version}`, 'version', '--json'], {
        cwd: options.cwd,
        timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      }),
      version
    )
}

/**
 * Whether a publishable project carries a version the registry can be asked about.
 *
 * @param project - A publishable project
 * @returns True for a named manifest at a version other than the stub `0.0.0`
 */
function hasRelease(project: ProjectRecord): boolean {
  const manifest = project.manifest as PackageManifest
  return typeof manifest.name === 'string' && typeof manifest.version === 'string' && manifest.version !== UNRELEASED
}

/**
 * The publishable libraries whose current version the registry lacks.
 *
 * @param projects - The projects of the workspace
 * @param probe - How the registry is asked
 * @returns The project names, sorted; a stub at `0.0.0` is never asked about
 */
export async function registryDrift(projects: Iterable<ProjectRecord>, probe: RegistryProbe): Promise<string[]> {
  const candidates = [...projects].filter((project) => isPublishable(project) && hasRelease(project))
  const answers = await promiseAll(
    candidates.map((project) =>
      probe((project.manifest as PackageManifest).name as string, (project.manifest as PackageManifest).version as string)
    )
  )
  return candidates
    .filter((project, index) => answers[index] === Presence.Absent)
    .map((project) => project.name)
    .sort(compareText)
}
