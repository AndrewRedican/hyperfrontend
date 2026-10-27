/**
 * The workspace's own command line, which the root `package.json` names `hf`. Usage, from anywhere
 * inside the workspace: `npm run hf -- run <project>:<target> [--name=value ...]` runs that one task, nothing it depends on first and nothing cached, from the workspace root,
 * and exits 0 when it succeeds and 1 otherwise. The arguments after the task merge over the
 * target's options, or reach the commands of an `nx:run-commands` target.
 * `run-many -t <targets> [-p <names and globs> | --all]` runs those tasks and their prerequisites,
 * one `run` child each; `affected -t <targets> [--base=<ref>] [--head=<ref>]` does the same for
 * the tasks the change selects; `format --check|--write [--all | --files=<list>]` runs prettier;
 * `generate <generator> [...] [--dry-run]` runs a generator of `@hyperfrontend/package` over the
 * workspace; `show projects` lists the projects; `graph <command>` runs the graph's command line.
 * Processes the workspace starts itself run it as `node --import ./tools/lint/src/runtime/aliases.ts tools/workspace/bin/hf.ts`.
 *
 * @module bin/hf
 */

import type { GeneratorEntry, GeneratorManifest, GeneratorModule, GeneratorSchema } from '../src/runner/generate'
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { findUpwardWhere } from '@hyperfrontend/project-scope/core'
import { commitChanges, createFsTree } from '@hyperfrontend/project-scope/vfs'
import { selectAffected } from '../src/graph/affected/select'
import { changeSet } from '../src/graph/changes'
import { previousGraph } from '../src/graph/revision'
import { buildState } from '../src/graph/store/state'
import { ALIAS_HOOK, taskCommand } from '../src/pipeline/commands'
import { pathKey, searchPath } from '../src/runner/environment'
import { changedFiles, FORMAT_USAGE, parseFormatArgs, prettierRuns } from '../src/runner/format'
import { GENERATE_USAGE, parseGenerateArgs } from '../src/runner/generate'
import {
  AFFECTED_USAGE,
  MANY_USAGE,
  manySummary,
  parseAffectedArgs,
  parseManyArgs,
  planMany,
  planTasks,
  runPlanned,
} from '../src/runner/many'
import { main } from '../src/runner/run'
import { SHOW_USAGE, showProjects } from '../src/runner/show'

/**
 * Writes a line of the command line's own to standard error, leaving standard output to the task.
 *
 * @param line - The text, without its newline
 */
function write(line: string): void {
  process.stderr.write(`${line}\n`)
}

/**
 * Ends the process once both standard streams have taken everything written to them.
 *
 * @param code - 0 when the task succeeded, 1 otherwise
 */
function exit(code: number): void {
  process.stdout.write('', () => process.stderr.write('', () => process.exit(code)))
}

const root = findUpwardWhere(process.cwd(), (directory) => existsSync(join(directory, 'nx.json')))
if (root === null) {
  write('run from inside the workspace: no nx.json above the working directory')
  process.exit(1)
}
const key = pathKey(process.env, process.platform)
// why: the tasks and the processes their executors start find the workspace's own binaries first, as they did when npx started them
process.env[key] = searchPath(root, process.env[key], process.execPath, process.platform)

/**
 * Runs a program in a child with inherited standard streams, from the workspace root.
 *
 * @param command - The program
 * @param args - Its arguments
 * @returns The exit code
 */
function runChild(command: string, args: readonly string[]): Promise<number> {
  return createPromise((resolve) => {
    const child = spawn(command, args, { cwd: root as string, stdio: 'inherit' })
    child.on('error', () => resolve(1))
    child.on('close', (code) => resolve(code ?? 1))
  })
}

/**
 * Runs `run-many`: plans the tasks on the owned graph, then runs each in a child.
 *
 * @param argv - The arguments after `run-many`
 * @returns The exit code
 */
async function runMany(argv: readonly string[]): Promise<number> {
  const request = parseManyArgs(argv)
  const { graph } = buildState(root as string)
  return runTasks(planMany(graph, request), request.args)
}

/**
 * Runs planned tasks, one child each, and prints the summary.
 *
 * @param tasks - The tasks in order
 * @param args - The arguments every requested task receives
 * @returns The exit code
 */
async function runTasks(tasks: Parameters<typeof runPlanned>[0], args: readonly string[]): Promise<number> {
  const outcomes = await runPlanned(tasks, args, {
    runChild: (id, extra) => runChild(process.execPath, [...taskCommand(id).slice(1), ...extra]),
    now: dateNow,
    write,
  })
  for (const line of manySummary(outcomes)) write(line)
  return outcomes.every((outcome) => outcome.status === 'succeeded') ? 0 : 1
}

/**
 * Runs `affected`: the tasks the owned selection picks for the change, and their prerequisites.
 *
 * @param argv - The arguments after `affected`
 * @returns The exit code
 */
async function affected(argv: readonly string[]): Promise<number> {
  const request = parseAffectedArgs(argv)
  const { graph } = buildState(root as string)
  const changes = changeSet(root as string, request.base, request.head)
  const sets = selectAffected({ graph, changes, targets: request.targets, previous: previousGraph(root as string, changes) })
  const tasks = request.targets.flatMap((target) =>
    (sets.get(target)?.selected ?? []).map((decision) => ({ project: decision.task.slice(0, -(target.length + 1)), target }))
  )
  write(`hf affected: ${tasks.length} tasks selected from ${changes.changes.length} changed files`)
  return runTasks(planTasks(graph, tasks), request.args)
}

/**
 * Runs `generate`: a generator of the workspace's package over a tree of the workspace, whose
 * changes are written, or printed under `--dry-run`.
 *
 * @param argv - The arguments after `generate`
 * @returns The exit code
 */
async function generate(argv: readonly string[]): Promise<number> {
  const packageRoot = join(root as string, 'tools', 'package')
  const manifest = parse(readFileSync(join(packageRoot, 'generators.json'), 'utf8')) as GeneratorManifest
  const entryOf = (generator: string): GeneratorEntry => {
    const entry = manifest.generators[generator]
    if (entry === undefined) throw createError(`no generator ${generator}: ${keys(manifest.generators).join(', ')}`)
    return entry
  }
  const schemaOf = (generator: string): GeneratorSchema =>
    parse(readFileSync(join(packageRoot, entryOf(generator).schema), 'utf8')) as GeneratorSchema
  const request = parseGenerateArgs(argv, schemaOf)
  const factory = (await import(pathToFileURL(join(packageRoot, `${entryOf(request.generator).factory}.ts`)).href)) as GeneratorModule
  const tree = createFsTree(root as string)
  await factory.default(tree, request.options)
  const result = commitChanges(tree, { dryRun: request.dryRun })
  for (const change of result.changes) process.stdout.write(`${change.type} ${change.path}\n`)
  if (request.dryRun) write('hf generate: dry run, nothing written')
  return 0
}

/**
 * Runs `show`: lists the projects.
 *
 * @param argv - The arguments after `show`
 * @returns The exit code
 */
async function show(argv: readonly string[]): Promise<number> {
  const { graph } = buildState(root as string)
  process.stdout.write(`${showProjects(argv, graph.projects.values())}\n`)
  return 0
}

/**
 * Runs `graph`: the graph's own command line, in a child.
 *
 * @param argv - The arguments after `graph`
 * @returns The exit code
 */
function graph(argv: readonly string[]): Promise<number> {
  return runChild(process.execPath, ['--import', ALIAS_HOOK, 'tools/workspace/bin/graph.ts', ...argv])
}

/**
 * Runs `format`: prettier over every, the named or the changed files.
 *
 * @param argv - The arguments after `format`
 * @returns The exit code
 */
async function format(argv: readonly string[]): Promise<number> {
  const git = (args: readonly string[]): string => execFileSync('git', args, { cwd: root as string, encoding: 'utf8', maxBuffer: 1 << 28 })
  const runs = prettierRuns(parseFormatArgs(argv), (scope) =>
    scope === 'all'
      ? git(['ls-files', '-z', '--cached', '--others', '--exclude-standard'])
          .split('\0')
          .filter((file) => file !== '' && existsSync(join(root as string, file)))
      : changedFiles(git(['status', '--porcelain', '-z', '--untracked-files=all']))
  )
  const prettier = join(root as string, 'node_modules', 'prettier', 'bin', 'prettier.cjs')
  let code = 0
  for (const args of runs) code = max(code, await runChild(process.execPath, [prettier, ...args]))
  return code
}

const [command, ...rest] = process.argv.slice(2)
const commands: Record<string, [(argv: readonly string[]) => Promise<number>, string]> = {
  'run-many': [runMany, MANY_USAGE],
  affected: [affected, AFFECTED_USAGE],
  format: [format, FORMAT_USAGE],
  generate: [generate, GENERATE_USAGE],
  show: [show, SHOW_USAGE],
  graph: [graph, 'usage: hf graph <command>, as tools/workspace/bin/graph.ts reads it'],
}
const chosen = commands[command ?? '']
if (chosen === undefined) {
  main(process.argv.slice(2), {
    root,
    cwd: process.cwd(),
    env: process.env,
    platform: process.platform,
    execPath: process.execPath,
    spawn: (line, options) => spawn(line, options),
    write,
    importModule: (file) => import(pathToFileURL(file).href),
  }).then(exit)
} else {
  chosen[0](rest).then(exit, (error: unknown) => {
    write(`hf ${command}: ${error instanceof Error ? error.message : String(error)}`)
    write(chosen[1])
    exit(1)
  })
}
