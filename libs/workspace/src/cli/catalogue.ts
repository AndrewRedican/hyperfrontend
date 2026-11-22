/**
 * The commands of the workspace's command line that run no single task, by name, each with its
 * usage: `run-many -t <targets> [-p <names and globs> | --all]` runs those tasks and their
 * prerequisites, one child each, each `-t` a stage of its own; `affected -t <targets>
 * [--base=<ref>] [--head=<ref>]` does the same for the tasks a change selects; `format --check|--write [--all | --files=<list>]`
 * runs prettier; `generate <generator> [...] [--dry-run]` runs a generator over the workspace;
 * `show projects [--with-target=<target>] [--json]` lists the projects; `graph <command>` prints
 * and persists the graph; `hooks run <hook>` runs the steps of a Git hook; `push` runs the steps
 * that come before a push, then pushes. Each answers `--help` or `-h` with its usage and runs
 * nothing. The dispatch answers `run` itself and reads this table for every other word, so a
 * command added here changes nothing a task passes through.
 *
 * @module cli/catalogue
 */

import type { ProjectRecord } from '../graph/model'
import type { AffectedSet } from '../graph/selection'
import type { Generator } from '../runner/contract'
import type { TaskSession } from './tasks'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { hasOwn } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { commitChanges, createFsTree } from '@hyperfrontend/project-scope/vfs'
import { HOOKS_USAGE, PUSH_USAGE, runHooksCommand, runPushCommand } from '../git-hooks/command'
import { selectAffected } from '../graph/affected/select'
import { changeSet } from '../graph/changes'
import { baseRecords } from '../graph/revision'
import { buildState } from '../graph/store/state'
import { discoverProjects, listFiles } from '../graph/workspace'
import { counted } from '../progress/view'
import { changedFiles, FORMAT_USAGE, parseFormatArgs, prettierRuns } from '../runner/format'
import { GENERATE_USAGE, parseGenerateArgs } from '../runner/generate'
import { locateGenerator } from '../runner/generators'
import { AFFECTED_USAGE, MANY_USAGE, parseAffectedArgs, parseManyArgs, planMany, planTasks } from '../runner/many'
import { asksForHelp } from '../runner/overrides'
import { refusal } from '../runner/refusal'
import { SHOW_USAGE, showProjects } from '../runner/show'
import { GRAPH_USAGE, runGraph, verifiedBase } from './graph'
import { runChild, runTasks } from './tasks'

/** What every command works with. */
export interface CommandSession extends TaskSession {
  /** The directory the command line was started in. */
  readonly cwd: string
  /** Writes a line of a result. */
  readonly say: (line: string) => void
}

/** A generator's module, as the command line calls it. */
interface GeneratorModule {
  /** The generator. */
  readonly default: Generator
}

/** A command: its arguments and the session, to an exit code. */
export type Command = (argv: readonly string[], session: CommandSession) => Promise<number> | number

/**
 * Runs `run-many`: plans the tasks on the owned graph, then runs each in a child.
 *
 * @param argv - The arguments after `run-many`
 * @param session - The workspace root and where to write
 * @returns The exit code
 */
function runMany(argv: readonly string[], session: CommandSession): Promise<number> {
  const request = parseManyArgs(argv)
  return runTasks({ ...request, tasks: planMany(buildState(session.root).graph, request) }, session)
}

/**
 * Runs `affected`: the tasks the owned selection picks for the change, and their prerequisites.
 *
 * @param argv - The arguments after `affected`
 * @param session - The workspace root and where to write
 * @returns The exit code
 */
function affected(argv: readonly string[], session: CommandSession): Promise<number> {
  const { root } = session
  const request = parseAffectedArgs(argv)
  const { graph } = buildState(root)
  const changes = changeSet(root, verifiedBase(root, request.base), request.head)
  const sets = selectAffected({ graph, changes, targets: request.targets, ...baseRecords(root, changes) })
  const tasks = request.targets.flatMap((target) =>
    (sets.get(target) as AffectedSet).selected.map((decision) => ({ project: decision.task.slice(0, -(target.length + 1)), target }))
  )
  session.note(`hf affected: ${counted(tasks.length, 'task')} selected from ${counted(changes.changes.length, 'changed file')}`)
  return runTasks({ ...request, tasks: planTasks(graph, tasks) }, session)
}

/**
 * Runs `generate`: a generator of the workspace or of an installed package over a tree of the
 * workspace, whose changes are written, or printed under `--dry-run`.
 *
 * @param argv - The arguments after `generate`
 * @param session - The workspace root and where to write
 * @returns The exit code
 */
async function generate(argv: readonly string[], session: CommandSession): Promise<number> {
  const { root } = session
  const projects = discoverProjects(root, listFiles(root))
  const locate = (name: string): ReturnType<typeof locateGenerator> => locateGenerator(root, projects, name)
  const request = parseGenerateArgs(argv, (name) => locate(name).schema)
  const module = (await import(/* hf-graph: opaque */ pathToFileURL(locate(request.generator).file).href)) as GeneratorModule
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
function show(argv: readonly string[], session: CommandSession): number {
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
async function format(argv: readonly string[], session: CommandSession): Promise<number> {
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

/**
 * A command that answers a help word with its usage and runs nothing, and its usage.
 *
 * @param handler - What the command does with any other arguments
 * @param usage - What the command expects
 * @param within - How many leading arguments are read for a help word; all of them unless given
 * @returns The command and its usage, as the table holds them
 */
function answeringHelp(handler: Command, usage: string, within?: number): readonly [Command, string] {
  const command: Command = (argv, session) => {
    if (!asksForHelp(argv, within)) return handler(argv, session)
    session.say(usage)
    return 0
  }
  return [command, usage]
}

/** The commands by name, each with its usage; `run` is not among them, since the dispatch answers it itself. */
export const COMMANDS: Readonly<Record<string, readonly [Command, string]>> = {
  'run-many': answeringHelp(runMany, MANY_USAGE),
  affected: answeringHelp(affected, AFFECTED_USAGE),
  format: answeringHelp(format, FORMAT_USAGE),
  generate: answeringHelp(generate, GENERATE_USAGE),
  show: answeringHelp(show, SHOW_USAGE),
  graph: answeringHelp((argv, session) => runGraph(argv, session.root, session), GRAPH_USAGE),
  // why: Git's own arguments follow the hook's name, and a help word read among them would skip the hook and exit cleanly
  hooks: answeringHelp(runHooksCommand, HOOKS_USAGE, 2),
  push: answeringHelp(runPushCommand, PUSH_USAGE),
}

/** What the command line prints about itself. */
export const USAGE = `@hyperfrontend/workspace: run the tasks of a workspace, see what a change affects, and generate code

Usage: hf <command> [options]

Commands:
  run <project>:<target> [--name=value ...]            Run one task, nothing it depends on first
  run-many -t <targets> [-p <projects> | --all]        Run tasks and what they depend on; each -t is a stage
  affected -t <targets> [--base=<ref>] [--head=<ref>]  Run the tasks a change selects; each -t is a stage
  format --check|--write [--all | --files=<list>]      Run prettier over changed, named or all files
  generate <generator> [...] [--dry-run]               Run a generator of the workspace or of an installed package
  show projects [--with-target=<target>] [--json]      List the projects
  graph <command>                                      Print and explain the workspace graph
  hooks run <hook> [--only=<steps>] [--skip=<steps>]   Run the steps of a Git hook, as its stub does
  push [arguments of git push]                         Run the steps that come before a push, then push
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
