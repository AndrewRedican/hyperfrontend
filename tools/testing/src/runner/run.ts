import type { TestConfig } from './config'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { findUnmeasuredFiles } from '../coverage/completeness'
import { buildRunPlan, serialiseModuleMap } from './argv'
import { withDefaults } from './config'

/**
 * Where a run happens and what it reports against.
 */
export type RunContext = {
  /** Absolute path to the workspace root. */
  workspaceRoot: string
  /** Absolute path to the project root. */
  projectRoot: string
  /** Absolute path to the project's coverage output directory. */
  coverageDir: string
  /** Capture the runner's output instead of letting it reach the terminal. */
  silent?: boolean
}

/**
 * What a completed run reported.
 */
export type RunOutcome = {
  /** Whether every environment passed and every source file was measured. */
  success: boolean
  /** Human-readable reasons the run failed, empty when it passed. */
  failures: string[]
}

/**
 * Runs a project's tests, one invocation per declared environment, then verifies that
 * coverage accounted for every file the project asked to measure.
 *
 * @param config - The project's configuration.
 * @param context - Where the run happens and where coverage is written.
 * @returns Whether the run passed, with the reasons it did not.
 */
export function runProjectTests(config: TestConfig, context: RunContext): RunOutcome {
  const resolved = withDefaults(config)
  const failures: string[] = []

  // why: the directory is this target's declared Nx output, so it has to hold what this run produced and nothing a previous tool left behind.
  rmSync(context.coverageDir, { recursive: true, force: true })
  mkdirSync(context.coverageDir, { recursive: true })

  const moduleMap = serialiseModuleMap(resolved)
  const environment = {
    ...process.env,
    HF_TEST_WORKSPACE_ROOT: context.workspaceRoot,
    ...(moduleMap ? { HF_TEST_MODULE_MAP: moduleMap } : {}),
  }
  // why: Node marks its own test children with this, and a child that inherits it refuses to run any files at all.
  delete environment['NODE_TEST_CONTEXT']

  const reports: string[] = []

  for (const declared of resolved.environments) {
    const plan = buildRunPlan(resolved, declared, context.workspaceRoot, context.projectRoot, context.coverageDir)

    const stdio = context.silent ? 'pipe' : 'inherit'
    const result = spawnSync(process.execPath, plan.argv, { cwd: context.projectRoot, stdio, env: environment })
    if (result.status !== 0) failures.push(`environment "${declared.name}" reported failures`)

    const lcovPath = resolve(context.projectRoot, plan.lcovPath)
    if (existsSync(lcovPath)) reports.push(lcovPath)
  }

  // why: Node omits files no test loaded, so a wholly untested source file would otherwise pass a full-coverage gate.
  // why: the reports are unioned first, because a file may be exercised by only one of a project's environments.
  // why: a run that produced no report at all lands here too, and every included file is then correctly reported unmeasured.
  const { missing } = findUnmeasuredFiles(reports, context.projectRoot, resolved.coverageInclude, resolved.coverageExclude)
  if (missing.length > 0) failures.push(`no test loaded these files, so coverage never measured them:\n  ${missing.join('\n  ')}`)

  return { success: failures.length === 0, failures }
}
