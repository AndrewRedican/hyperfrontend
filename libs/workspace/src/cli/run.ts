/**
 * The workspace's command line as a function. From anywhere inside the workspace:
 * `run <project>:<target> [--name=value ...]` runs that one task, nothing it depends on first and
 * nothing cached; `run-many -t <targets> [-p <names and globs> | --all]` runs those tasks and
 * their prerequisites, one child each; `affected -t <targets> [--base=<ref>] [--head=<ref>]`
 * does the same for the tasks a change selects; `format --check|--write [--all | --files=<list>]`
 * runs prettier; `generate <generator> [...] [--dry-run]` runs a generator over the workspace;
 * `show projects [--with-target=<target>] [--json]` lists the projects; `graph <command>` prints
 * and persists the graph.
 *
 * @module cli/run
 */

import type { ProjectRecord } from '../graph/model'
import type { AffectedSet } from '../graph/selection'
import type { Generator } from '../runner/contract'
import type { HandoverHost, Invocation } from './handover'
import { execFileSync, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { hasOwn } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { findUpwardWhere } from '@hyperfrontend/project-scope/core'
import { commitChanges, createFsTree } from '@hyperfrontend/project-scope/vfs'
import { selectAffected } from '../graph/affected/select'
import { changeSet } from '../graph/changes'
import { previousGraph } from '../graph/revision'
import { buildState } from '../graph/store/state'
import { discoverProjects, listFiles } from '../graph/workspace'
import { installAliases } from '../hooks/index'
import { pathKey, searchPath } from '../runner/environment'
import { changedFiles, FORMAT_USAGE, parseFormatArgs, prettierRuns } from '../runner/format'
import { GENERATE_USAGE, parseGenerateArgs } from '../runner/generate'
import { locateGenerator } from '../runner/generators'
import { AFFECTED_USAGE, MANY_USAGE, manySummary, parseAffectedArgs, parseManyArgs, planMany, planTasks, runPlanned } from '../runner/many'
import { describeError, refusal } from '../runner/refusal'
import { main } from '../runner/run'
import { selfCommand } from '../runner/self'
import { SHOW_USAGE, showProjects } from '../runner/show'
import { GRAPH_USAGE, runGraph } from './graph'
import { handOver, processHost } from './handover'

/** The file that marks a workspace root. */
export const WORKSPACE_FILE = 'hf.json'

/** What a run of the command line is given. */
export type WorkspaceCliOptions = Invocation

/** What every command works with. */
interface Session {
  /** The workspace root, absolute. */
  readonly root: string
  /** The directory the command line was started in. */
  readonly cwd: string
  /** Writes a line of a result. */
  readonly say: (line: string) => void
  /** Writes a line of the command line's own. */
  readonly note: (line: string) => void
}

/** A generator's module, as the command line calls it. */
interface GeneratorModule {
  /** The generator. */
  readonly default: Generator
}

/** A command: its arguments and the session, to an exit code. */
type Command = (argv: readonly string[], session: Session) => Promise<number> | number

/**
 * Runs a program in a child with inherited standard streams, from the workspace root.
 *
 * @param root - The workspace root, absolute
 * @param command - The program
 * @param args - Its arguments
 * @returns The exit code
 */
function runChild(root: string, command: string, args: readonly string[]): Promise<number> {
  return createPromise((resolve) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit' })
    child.on('error', () => resolve(1))
    child.on('close', (code) => resolve(code ?? 1))
  })
}

/**
 * Runs planned tasks, each in a child started the way this process was, and prints the summary.
 *
 * @param tasks - The tasks in order
 * @param args - The arguments every requested task receives
 * @param session - The workspace root and where to write
 * @returns The exit code
 */
async function runTasks(tasks: Parameters<typeof runPlanned>[0], args: readonly string[], session: Session): Promise<number> {
  const outcomes = await runPlanned(tasks, args, {
    runChild: (id, extra) => {
      const [program, ...rest] = selfCommand(process, ['run', id, ...extra]) as [string, ...string[]]
      return runChild(session.root, program, rest)
    },
    now: dateNow,
    write: session.note,
  })
  for (const line of manySummary(outcomes)) session.note(line)
  return outcomes.every((outcome) => outcome.status === 'succeeded') ? 0 : 1
}

/**
 * Runs `run-many`: plans the tasks on the owned graph, then runs each in a child.
 *
 * @param argv - The arguments after `run-many`
 * @param session - The workspace root and where to write
 * @returns The exit code
 */
function runMany(argv: readonly string[], session: Session): Promise<number> {
  const request = parseManyArgs(argv)
  return runTasks(planMany(buildState(session.root).graph, request), request.args, session)
}

/**
 * Runs `affected`: the tasks the owned selection picks for the change, and their prerequisites.
 *
 * @param argv - The arguments after `affected`
 * @param session - The workspace root and where to write
 * @returns The exit code
 */
function affected(argv: readonly string[], session: Session): Promise<number> {
  const { root } = session
  const request = parseAffectedArgs(argv)
  const { graph } = buildState(root)
  const changes = changeSet(root, request.base, request.head)
  const sets = selectAffected({ graph, changes, targets: request.targets, previous: previousGraph(root, changes) })
  const tasks = request.targets.flatMap((target) =>
    (sets.get(target) as AffectedSet).selected.map((decision) => ({ project: decision.task.slice(0, -(target.length + 1)), target }))
  )
  session.note(`hf affected: ${tasks.length} tasks selected from ${changes.changes.length} changed files`)
  return runTasks(planTasks(graph, tasks), request.args, session)
}

/**
 * Runs `generate`: a generator of the workspace or of an installed package over a tree of the
 * workspace, whose changes are written, or printed under `--dry-run`.
 *
 * @param argv - The arguments after `generate`
 * @param session - The workspace root and where to write
 * @returns The exit code
 */
async function generate(argv: readonly string[], session: Session): Promise<number> {
  const { root } = session
  const projects = discoverProjects(root, listFiles(root))
  const locate = (name: string): ReturnType<typeof locateGenerator> => locateGenerator(root, projects, name)
  const request = parseGenerateArgs(argv, (name) => locate(name).schema)
  const module = (await import(pathToFileURL(locate(request.generator).file).href)) as GeneratorModule
  const tree = createFsTree(root)
  await module.default(tree, request.options)
  const result = commitChanges(tree, { dryRun: request.dryRun })
  for (const change of result.changes) session.say(`${change.type} ${change.path}`)
  if (request.dryRun) session.note('hf generate: dry run, nothing written')
  return 0
}

/**
 * Runs `show`: lists the projects.
 *
 * @param argv - The arguments after `show`
 * @param session - The workspace root and where to write
 * @returns The exit code
 */
function show(argv: readonly string[], session: Session): number {
  session.say(showProjects(argv, buildState(session.root).graph.projects.values() as Iterable<ProjectRecord>))
  return 0
}

/**
 * Runs `format`: prettier over every, the named or the changed files.
 *
 * @param argv - The arguments after `format`
 * @param session - The workspace root and where to write
 * @returns The exit code
 * @throws {Error} When prettier is not installed in the workspace
 */
async function format(argv: readonly string[], session: Session): Promise<number> {
  const { root } = session
  const git = (args: readonly string[]): string => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 })
  const runs = prettierRuns(parseFormatArgs(argv), (scope) =>
    scope === 'all'
      ? git(['ls-files', '-z', '--cached', '--others', '--exclude-standard'])
          .split('\0')
          .filter((file) => file !== '' && existsSync(join(root, file)))
      : changedFiles(git(['status', '--porcelain', '-z', '--untracked-files=all']))
  )
  const prettier = prettierEntry(root)
  let code = 0
  for (const args of runs) code = max(code, await runChild(root, process.execPath, [prettier, ...args]))
  return code
}

/**
 * The prettier executable the workspace installs.
 *
 * @param root - The workspace root, absolute
 * @returns The path of its entry module
 * @throws {Error} When the workspace has no prettier
 */
function prettierEntry(root: string): string {
  try {
    return createRequire(join(root, 'package.json')).resolve('prettier/bin/prettier.cjs')
  } catch {
    throw refusal('prettier is not installed in the workspace; install it to format')
  }
}

/** The commands by name, each with its usage. */
const COMMANDS: Readonly<Record<string, readonly [Command, string]>> = {
  'run-many': [runMany, MANY_USAGE],
  affected: [affected, AFFECTED_USAGE],
  format: [format, FORMAT_USAGE],
  generate: [generate, GENERATE_USAGE],
  show: [show, SHOW_USAGE],
  graph: [(argv, session) => runGraph(argv, session.root, session), GRAPH_USAGE],
}

/** The words that ask for the usage. */
const HELP = ['--help', '-h']

/** What the command line prints about itself. */
export const USAGE = `@hyperfrontend/workspace: run the tasks of a workspace, see what a change affects, and generate code

Usage: hf <command> [options]

Commands:
  run <project>:<target> [--name=value ...]            Run one task, nothing it depends on first
  run-many -t <targets> [-p <projects> | --all]        Run tasks and what they depend on
  affected -t <targets> [--base=<ref>] [--head=<ref>]  Run the tasks a change selects
  format --check|--write [--all | --files=<list>]      Run prettier over changed, named or all files
  generate <generator> [...] [--dry-run]               Run a generator of the workspace or of an installed package
  show projects [--with-target=<target>] [--json]      List the projects
  graph <command>                                      Print and explain the workspace graph
`

/**
 * Whether a word is a command this command line owns.
 *
 * @param word - The first argument
 * @returns True for `run` and every command of the table
 *
 * @example Deciding which command line answers
 * ```typescript
 * isOwnCommand('run-many') // true
 * isOwnCommand('pack') // false: the features command line is asked, when it is installed
 * ```
 */
export function isOwnCommand(word: string): boolean {
  return word === 'run' || hasOwn(COMMANDS, word)
}

/**
 * Runs the workspace's command line. The `hf` name is shared with `@hyperfrontend/features`:
 * where that package is installed, a command this one does not own is passed on to its command
 * line, and the usage is followed by its usage.
 *
 * @param options - The arguments, the starting directory and where to write
 * @param host - How the features command line is found and loaded
 * @returns The exit code: 0 when the command succeeded, 1 otherwise
 *
 * @example The command line as a function
 * ```typescript
 * import { runWorkspaceCli } from '@hyperfrontend/workspace/cli'
 *
 * const code = await runWorkspaceCli({
 *   argv: ['run-many', '-t', 'build', '-p', 'lib-*'],
 *   cwd: process.cwd(),
 *   stdout: process.stdout,
 *   stderr: process.stderr,
 * })
 * // => 0 when every task succeeded, 1 otherwise
 * ```
 *
 * @example Another `hf` command line passing a command on
 * ```typescript
 * const code = await runWorkspaceCli({ argv, cwd, stdout, stderr, handedOver: true })
 * // => the exit code; an unknown command is reported here rather than passed back
 * ```
 */
export async function runWorkspaceCli(options: WorkspaceCliOptions, host: HandoverHost = processHost()): Promise<number> {
  const { argv, cwd } = options
  const note = (line: string): void => void options.stderr.write(`${line}\n`)
  const say = (line: string): void => void options.stdout.write(`${line}\n`)
  const [command, ...rest] = argv
  if (command === undefined || HELP.includes(command)) {
    options.stdout.write(USAGE)
    if (options.handedOver !== true) await handOver({ ...options, argv: ['--help'] }, host)
    return command === undefined ? 1 : 0
  }
  if (!isOwnCommand(command)) {
    const code = options.handedOver === true ? null : await handOver(options, host)
    if (code !== null) return code
    note(`hf: unknown command ${command}`)
    options.stderr.write(USAGE)
    return 1
  }
  // why: a generator may be what creates the workspace file, so it alone runs where there is none yet
  const root = findUpwardWhere(cwd, (directory) => existsSync(join(directory, WORKSPACE_FILE))) ?? (command === 'generate' ? cwd : null)
  if (root === null) {
    note(`run from inside the workspace: no ${WORKSPACE_FILE} above the working directory`)
    return 1
  }
  // why: the workspace's own executors, generators and configurations load from their TypeScript source
  installAliases(root)
  // why: every command reads its paths from the workspace root, wherever in the workspace it was typed
  process.chdir(root)
  const key = pathKey(process.env, process.platform)
  // why: the tasks and the processes their executors start find the workspace's own binaries first, as they did when npx started them
  process.env[key] = searchPath(root, process.env[key], process.execPath, process.platform)
  const chosen = COMMANDS[command]
  if (chosen === undefined)
    return main(argv, {
      root,
      cwd,
      env: process.env,
      platform: process.platform,
      execPath: process.execPath,
      spawn: (line, spawnOptions) => spawn(line, spawnOptions),
      write: note,
      importModule: (file) => import(pathToFileURL(file).href),
    })
  try {
    return await chosen[0](rest, { root, cwd, say, note })
  } catch (error) {
    note(`hf ${command}: ${describeError(error)}`)
    note(chosen[1])
    return 1
  }
}
