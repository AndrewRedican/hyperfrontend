/**
 * Runs one task of the workspace, `run <project>:<target> [--name=value ...]`: finds the project
 * and its target the way discovery finds them, merges the target with its defaults, then runs
 * its commands or imports its executor and calls it in this process. Nothing the task depends on
 * runs first, and nothing is cached or restored.
 *
 * @module runner/run
 */

import type { NxJsonConfiguration } from '@hyperfrontend/integration-nx/compat'
import type { CommandsHost } from './commands'
import type { ResolvedProject } from './context'
import type { ImportModule } from './executors'
import type { ResolvedTarget } from './targets'
import { join } from 'node:path'
import { discoverProjects, listFiles, readJson } from '../graph/workspace'
import { runCommands } from './commands'
import { executorContext, projectConfigurations } from './context'
import { loadExecutor, locateExecutor, settle, withDefaults } from './executors'
import { parseOverrides, typedOverrides } from './overrides'
import { describeError } from './refusal'
import { executorOf, parseTaskId, RUN_COMMANDS } from './targets'

/** What the command line expects. */
export const USAGE = 'usage: hf run <project>:<target> [--name=value ...]'

/** Where a task runs and what it runs with. */
export interface RunHost extends CommandsHost {
  /** The directory the command line started in. */
  readonly cwd: string
  /** Imports an executor's module. */
  readonly importModule: ImportModule
}

/**
 * Runs one task.
 *
 * @param id - The task, `<project>:<target>`
 * @param args - The arguments after the task, `--name=value` or `--name`
 * @param host - Where the task runs and what it runs with
 * @returns True when the task succeeded
 * @throws {Error} When the task cannot run as asked, or its executor throws
 */
export async function runTask(id: string, args: readonly string[], host: RunHost): Promise<boolean> {
  const overrides = parseOverrides(args)
  const projects = discoverProjects(host.root, listFiles(host.root))
  const nx = readJson<NxJsonConfiguration>(join(host.root, 'nx.json')) ?? {}
  const { project, target: targetName } = parseTaskId(id, projects)
  const configurations = projectConfigurations(nx, projects)
  const target = (configurations[project.name] as ResolvedProject).targets[targetName] as ResolvedTarget
  const executor = executorOf(target, id)
  if (executor === RUN_COMMANDS) return runCommands(target.options, overrides.args, host)
  const source = locateExecutor(host.root, projects, executor)
  const implementation = await loadExecutor(source, host.importModule, executor)
  const options = withDefaults({ ...target.options, ...typedOverrides(overrides.options, source.schema) }, source.schema)
  const context = executorContext({
    root: host.root,
    cwd: host.cwd,
    projectName: project.name,
    targetName,
    target,
    nx,
    projects,
    configurations,
  })
  return settle(implementation(options, context))
}

/**
 * The command line: runs the task it names and reports why it could not, when it could not.
 *
 * @param argv - The arguments after the entry, `run <project>:<target> [--name=value ...]`
 * @param host - Where the task runs and what it runs with
 * @returns The exit code: 0 when the task succeeded, 1 otherwise
 */
export async function main(argv: readonly string[], host: RunHost): Promise<number> {
  const [command, id, ...args] = argv
  if (command !== 'run' || id === undefined) {
    host.write(USAGE)
    return 1
  }
  try {
    return (await runTask(id, args, host)) ? 0 : 1
  } catch (error) {
    host.write(`hf run ${id}: ${describeError(error)}`)
    return 1
  }
}
