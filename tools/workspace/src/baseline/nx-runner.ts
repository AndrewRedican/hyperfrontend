/**
 * Runs the Nx installed in a checkout without its daemon, cloud runner or legacy project-level
 * selection, so a capture reads the task-level selection of exactly that checkout.
 *
 * @module baseline/nx-runner
 */

import type { NxRunner } from './capture'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { readJsonFile } from '@hyperfrontend/project-scope/core'

/** The fields of Nx's own manifest the runner reads. */
interface NxManifest {
  /** The executables, by name. */
  readonly bin: Readonly<Record<string, string>>
}

/** How much output one Nx command may print before the capture gives up. */
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024

/**
 * A runner for the Nx installed under a checkout's `node_modules`.
 *
 * @param checkout - The absolute path of the checkout
 * @returns A runner whose output is the command's standard output; the executable is the one Nx's own manifest names
 */
export function nxRunner(checkout: string): NxRunner {
  const nx = join(checkout, 'node_modules', 'nx')
  const bin = join(nx, readJsonFile<NxManifest>(join(nx, 'package.json')).bin['nx'] ?? 'bin/nx.js')
  return (args) =>
    execFileSync(process.execPath, [bin, ...args], {
      cwd: checkout,
      encoding: 'utf8',
      maxBuffer: MAX_OUTPUT_BYTES,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NX_DAEMON: 'false', NX_LEGACY_AFFECTED: 'false', NX_NO_CLOUD: 'true', NX_TUI: 'false' },
    })
}
