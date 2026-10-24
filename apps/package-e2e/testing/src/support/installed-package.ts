import type { SpawnSyncReturns } from 'node:child_process'
import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * The e2e project root: the directory the executor installed the packed tarball under.
 */
export const PROJECT_DIR = resolve(import.meta.dirname, '..', '..')

/**
 * Where the packed `@hyperfrontend/testing` landed after `npm install`.
 *
 * The suites reach the package by this path on purpose. The executor preloads the
 * workspace's own copy of the runtime and aliases the package name to workspace source, so
 * a bare `import '@hyperfrontend/testing'` in a spec would never touch the tarball.
 */
export const INSTALLED_DIR = join(PROJECT_DIR, 'node_modules', '@hyperfrontend', 'testing')

/**
 * Names a file inside the installed package.
 *
 * @param segments - Path segments below the package root.
 * @returns The absolute path.
 */
export function installedPath(...segments: string[]): string {
  return join(INSTALLED_DIR, ...segments)
}

/**
 * Names a file inside the installed package as the `file:` URL Node accepts wherever it
 * expects a module specifier: `import()`, `--import` and `--test-reporter`.
 *
 * @param segments - Path segments below the package root.
 * @returns The absolute `file:` URL.
 */
export function installedUrl(...segments: string[]): string {
  return pathToFileURL(installedPath(...segments)).href
}

/**
 * The prefix of every variable the e2e executor and the workspace runner hand to a child.
 */
const HARNESS_PREFIX = 'HF_TEST_'

/**
 * The variable Node sets on the children of its own test runner. A nested `node --test`
 * that inherits it reports that it is being called recursively and runs no files at all,
 * while still exiting 0.
 */
const NODE_TEST_MARKER = 'NODE_TEST_CONTEXT'

/**
 * Builds the environment a child run inherits: this process's, minus every harness
 * variable and Node's own test-runner marker.
 *
 * Without the harness variables the child's preload reads no workspace aliases, so the
 * fixture's `@hyperfrontend/testing` import resolves from this project's `node_modules`,
 * which is the installed tarball.
 *
 * @returns Variables for a child that must find the package the way a consumer does.
 */
export function childEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith(HARNESS_PREFIX) || key === NODE_TEST_MARKER) continue
    environment[key] = value
  }
  return environment
}

/**
 * Runs a callback with the harness variables removed from this process's environment,
 * restoring them afterwards.
 *
 * The installed runner spreads `process.env` into the children it spawns, so a call made
 * from inside the executor's run would otherwise hand them the executor's alias table.
 *
 * @param callback - What to run while the variables are absent.
 * @returns Whatever the callback returned.
 */
export function withoutHarnessEnvironment<TResult>(callback: () => TResult): TResult {
  const removed: Record<string, string | undefined> = {}
  for (const key of Object.keys(process.env)) {
    if (!key.startsWith(HARNESS_PREFIX)) continue
    removed[key] = process.env[key]
    delete process.env[key]
  }

  try {
    return callback()
  } finally {
    for (const [key, value] of Object.entries(removed)) process.env[key] = value
  }
}

/**
 * What a child `node --test` run reported.
 */
export type ChildRun = {
  /** The exit code, or null when the child was killed. */
  status: number | null
  /** Everything the child wrote to stdout, which is where its TAP report goes. */
  stdout: string
  /** Everything the child wrote to stderr. */
  stderr: string
}

/**
 * What a child run may vary beyond its preloads and spec files.
 */
export type ChildRunOptions = {
  /** The reporter Node prints to stdout; TAP, Node's own, unless a check is about a reporter. */
  reporter?: string
  /** Further Node arguments placed before `--test`, such as the coverage flags. */
  nodeArgs?: readonly string[]
}

/**
 * Runs spec files on Node's test runner in a child process, judged by Node's own reporter
 * rather than by anything the package under test prints.
 *
 * @param cwd - The fixture directory the child runs from.
 * @param preloadUrls - `file:` URLs handed to `--import`, in order.
 * @param specs - Spec files, relative to the fixture directory.
 * @param options - The reporter and any further Node arguments.
 * @returns The child's exit status and output.
 */
export function runChildSuite(
  cwd: string,
  preloadUrls: readonly string[],
  specs: readonly string[],
  options: ChildRunOptions = {}
): ChildRun {
  const argv = [
    '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
    ...preloadUrls.flatMap((url) => ['--import', url]),
    ...(options.nodeArgs ?? []),
    '--test',
    `--test-reporter=${options.reporter ?? 'tap'}`,
    '--test-reporter-destination=stdout',
    ...specs,
  ]
  const result: SpawnSyncReturns<string> = spawnSync(process.execPath, argv, {
    cwd,
    env: childEnvironment(),
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 60_000,
  })
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

/**
 * Reads one of the counts Node's TAP reporter prints at the end of a run.
 *
 * @param output - The child's stdout.
 * @param label - Which summary line to read.
 * @returns The count, or -1 when the summary line is absent.
 */
export function tapCount(output: string, label: 'tests' | 'pass' | 'fail' | 'skipped' | 'todo'): number {
  const prefix = `# ${label} `
  const line = output.split(/\r?\n/).find((candidate) => candidate.startsWith(prefix))
  return line === undefined ? -1 : Number(line.slice(prefix.length))
}
