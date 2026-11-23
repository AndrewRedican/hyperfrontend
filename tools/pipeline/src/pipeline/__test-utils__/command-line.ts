/**
 * The pipeline's command line for the specs that start it: where it lies, a disposable workspace
 * of two libraries whose tasks a stand-in for the workspace's command line runs, and how to start
 * it in a directory, at once or beside a server the spec itself keeps.
 *
 * @module pipeline/__test-utils__/command-line
 */

import type { FileTree } from '@hyperfrontend/testing/fs'
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'

/** The workspace these sources belong to. */
export const WORKSPACE_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..', '..')

/** The hook the command line loads workspace sources through, as `--import` takes it. */
export const ALIASES = pathToFileURL(resolve(WORKSPACE_ROOT, 'libs', 'workspace', 'src', 'hooks', 'index.ts')).href

/** The pipeline's command line. */
export const PIPELINE = resolve(WORKSPACE_ROOT, 'tools', 'pipeline', 'bin', 'pipeline.ts')

/** What stands in for the workspace's command line: it says which task it ran and fails the one the environment names. */
const STUB = [
  'const id = process.argv[3]',
  'process.stdout.write(`ran ${id}\\n`)',
  "process.exit(id === process.env['FIXTURE_FAILS'] ? 1 : 0)",
  '',
].join('\n')

/** Two libraries with a lint and a build each, one of them tested, and the entries every task of a plan starts. */
export const LIBRARIES: FileTree = {
  'hf.json': {},
  'package.json': { name: '@fixture/workspace', private: true, type: 'module' },
  '.gitignore': '.hf\n',
  'libs/workspace/src/hooks/index.ts': 'export {}\n',
  'libs/workspace/bin/hf.mjs': STUB,
  'libs/a/project.json': { name: 'lib-a', projectType: 'library', sourceRoot: 'libs/a/src', targets: { lint: {}, test: {}, build: {} } },
  'libs/a/package.json': { name: '@fixture/a', version: '0.0.0', private: true },
  'libs/a/src/index.ts': 'export const a = 1\n',
  'libs/b/project.json': { name: 'lib-b', projectType: 'library', sourceRoot: 'libs/b/src', targets: { lint: {}, build: {} } },
  'libs/b/package.json': { name: '@fixture/b', version: '0.0.0', private: true },
  'libs/b/src/index.ts': 'export const b = 1\n',
}

/** What a workflow or a hook around the specs tells a pipeline about itself, which a pipeline started by a spec must not hear. */
const SURROUNDINGS = [
  'GITHUB_ACTIONS',
  'GITHUB_EVENT_NAME',
  'GITHUB_OUTPUT',
  'GITHUB_REPOSITORY',
  'GITHUB_RUN_ATTEMPT',
  'GITHUB_RUN_ID',
  'GITHUB_SHA',
  'GITHUB_STEP_SUMMARY',
  'GITHUB_TOKEN',
  'HF_PIPELINE_INHERIT',
] as const

/** What a command line answered. */
export interface Answer {
  /** The exit code. */
  readonly status: number | null
  /** Standard output, whole. */
  readonly stdout: string
  /** Standard error, whole. */
  readonly stderr: string
}

/**
 * Runs git in a repository, as a fixed identity.
 *
 * @param cwd - The repository
 * @param args - The git arguments
 * @returns What git printed, trimmed
 */
export function gitIn(cwd: string, ...args: string[]): string {
  return execFileSync('git', ['-c', 'user.name=fixture', '-c', 'user.email=fixture@localhost', ...args], { cwd, encoding: 'utf8' }).trim()
}

/**
 * The environment a pipeline started by a spec runs in: this process's, without what a workflow
 * or a hook around the specs would tell the pipeline about itself.
 *
 * @param env - What the spec sets on top
 * @returns This process's environment without those entries, the spec's own on top
 */
function environmentFor(env: Readonly<Record<string, string>>): NodeJS.ProcessEnv {
  const inherited = { ...process.env }
  for (const name of SURROUNDINGS) delete inherited[name]
  return { ...inherited, ...env }
}

/**
 * Runs the pipeline's command line in a directory and waits for it.
 *
 * @param cwd - The workspace the command line runs in
 * @param args - The command and its flags
 * @param env - Environment entries set on top of this process's
 * @returns The exit code and what was printed
 */
export function runPipeline(cwd: string, args: readonly string[], env: Readonly<Record<string, string>> = {}): Answer {
  const run = spawnSync(process.execPath, ['--import', ALIASES, PIPELINE, ...args], { cwd, encoding: 'utf8', env: environmentFor(env) })
  return { status: run.status, stdout: run.stdout, stderr: run.stderr }
}

/**
 * Starts the pipeline's command line in a directory without blocking, so a server the spec keeps
 * in this process can answer it.
 *
 * @param cwd - The workspace the command line runs in
 * @param args - The command and its flags
 * @param env - Environment entries set on top of this process's
 * @returns Resolves with the exit code and what was printed once the process ends
 */
export function startPipeline(cwd: string, args: readonly string[], env: Readonly<Record<string, string>> = {}): Promise<Answer> {
  return createPromise((settle) => {
    const child = spawn(process.execPath, ['--import', ALIASES, PIPELINE, ...args], { cwd, env: environmentFor(env) })
    const printed = { stdout: '', stderr: '' }
    child.stdout.on('data', (chunk: Buffer) => (printed.stdout += chunk.toString('utf8')))
    child.stderr.on('data', (chunk: Buffer) => (printed.stderr += chunk.toString('utf8')))
    child.on('close', (status) => settle({ status, ...printed }))
  })
}
