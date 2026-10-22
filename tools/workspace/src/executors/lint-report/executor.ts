import type { ExecutorContext } from '@nx/devkit'
import type { LintReportExecutorOptions } from './schema'
import type { CrashedProject } from './types'
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { entries as objectEntries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { logger } from '../../lib/logger'
import { parseLintOutput, parseFailedProjects, findCrashSuspects, buildLegend, groupByFile, stripAnsi } from './parser'
import { generateReport } from './report-generator'

/**
 * Result of lint report executor.
 */
interface ExecutorResult {
  /**
   * Whether the executor completed successfully.
   */
  success: boolean
}

/**
 * Error shape from execFileSync when command fails.
 */
interface ExecError {
  /**
   * Standard output captured before failure.
   */
  stdout?: string

  /**
   * Standard error captured before failure.
   */
  stderr?: string

  /**
   * Exit code of the command, null when it was killed or never started.
   */
  status?: number | null

  /**
   * Signal that killed the command, if any.
   */
  signal?: string | null

  /**
   * Description of the failure, the only detail available when the command never started.
   */
  message?: string
}

/**
 * Outcome of one lint command.
 */
interface LintRun {
  /**
   * Standard output and standard error of the command.
   */
  raw: string

  /**
   * Phrase describing how the command ended, null when it exited cleanly.
   */
  failure: string | null
}

/**
 * Outcome of rerunning the suspect projects on their own.
 */
interface IsolationResult {
  /**
   * Projects that failed again without reporting any lint error.
   */
  crashes: CrashedProject[]

  /**
   * Output of every rerun.
   */
  raw: string
}

/**
 * Number of trailing output lines kept in the report of a lint run that did not complete.
 */
const CRASH_TAIL_LINES = 80

/**
 * Number of trailing output lines kept per crashed project.
 */
const PROJECT_TAIL_LINES = 40

/**
 * Most failed projects rerun on their own. More than this is a workspace-wide crash, and rerunning each would only repeat it.
 */
const MAX_ISOLATED_RERUNS = 5

/**
 * Describe how a failed lint command ended.
 *
 * @param error - Error thrown by execFileSync
 * @returns Phrase completing the sentence "The lint command ..."
 */
function describeFailure(error: ExecError): string {
  if (typeof error.status === 'number') return `exited with code ${error.status}`
  if (error.signal) return `was killed by ${error.signal}`
  return `could not be launched (${error.message ?? 'unknown error'})`
}

/**
 * Run one lint command through npx and capture how it ended.
 *
 * @param args - Arguments passed to npx
 * @param cwd - Directory to run in
 * @returns Captured output and failure description
 */
function runLint(args: string[], cwd: string): LintRun {
  try {
    const raw = execFileSync('npx', args, {
      env: { ...process.env, CI: '1' },
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      cwd,
      shell: process.platform === 'win32',
    })
    return { raw, failure: null }
  } catch (err: unknown) {
    const execError = err as ExecError
    return { raw: (execError.stdout ?? '') + (execError.stderr ?? ''), failure: describeFailure(execError) }
  }
}

/**
 * Keep the last lines of a command's output, without ANSI codes.
 *
 * @param raw - Raw output captured from the command
 * @param lineCount - Number of lines to keep
 * @returns Trailing lines joined by newlines
 */
function outputTail(raw: string, lineCount: number): string {
  return stripAnsi(raw).trimEnd().split(/\r?\n/).slice(-lineCount).join('\n')
}

/**
 * Build the report for a lint run that failed without any parseable lint error or failed task.
 *
 * @param command - Command line that was run
 * @param failure - Phrase describing how the command ended
 * @param raw - Raw output captured from the command
 * @returns Report content
 */
function generateCrashReport(command: string, failure: string, raw: string): string {
  return [
    '# Lint Report',
    '',
    `Lint did not complete: \`${command}\` ${failure} and its output holds no lint error.`,
    'This is a crash of the lint run itself (the linter or a rule throwing, an out-of-memory kill, a launch failure), not a clean result.',
    '',
    `## Output tail (last ${CRASH_TAIL_LINES} lines)`,
    '',
    '```',
    outputTail(raw, CRASH_TAIL_LINES) || '(no output captured)',
    '```',
    '',
  ].join('\n')
}

/**
 * Rerun each suspect project on its own to tell a crash from a failure the combined run obscured.
 *
 * A rerun that passes, or that reports lint errors, is not a crash. Its output joins the combined output so its findings reach the report.
 *
 * @param suspects - Failed projects that own no parsed lint error
 * @param cwd - Workspace root
 * @returns Crashed projects and the output of every rerun
 */
function isolateCrashes(suspects: string[], cwd: string): IsolationResult {
  const crashes: CrashedProject[] = []
  let raw = ''

  for (const [index, project] of suspects.entries()) {
    if (index >= MAX_ISOLATED_RERUNS) {
      crashes.push({ project, failure: null, tail: null })
      continue
    }

    logger.info(`Rerunning ${project}:lint on its own...`)
    const rerun = runLint(['nx', 'run', `${project}:lint`, '--fix'], cwd)
    raw += `\n${rerun.raw}`

    if (rerun.failure === null) {
      logger.warn(`${project}:lint failed in the combined run but passed on its own.`)
      continue
    }

    if (parseLintOutput(rerun.raw, cwd).some((e) => e.severity === 'error')) continue

    crashes.push({ project, failure: rerun.failure, tail: outputTail(rerun.raw, PROJECT_TAIL_LINES) })
  }

  return { crashes, raw }
}

/**
 * Lint report executor for generating LLM-optimized lint reports.
 *
 * Runs `nx run-many -t=lint` and transforms the output into a structured
 * report optimized for LLM consumption with:
 * - Legend at top with rule documentation links
 * - Files sorted by quick wins (fewest errors first)
 * - Imperative instructions for fixing
 * - Reference to relevant skill files
 *
 * A lint task that fails without a single parseable lint error did not
 * lint at all. Each such project is rerun on its own, and the ones that
 * still fail that way are reported as crashed. A crash fails the executor
 * regardless of `failOnError`.
 *
 * @param options - Configuration options for report generation
 * @param context - Executor context providing workspace information
 * @returns Promise resolving to success/failure result
 */
export default async function lintReportExecutor(options: LintReportExecutorOptions, context: ExecutorContext): Promise<ExecutorResult> {
  const outputPath = options.outputPath ?? 'lint-output.txt'
  const affected = options.affected ?? false
  const maxFixes = options.maxFixes ?? 5
  const failOnError = options.failOnError ?? false
  const reportPath = join(context.root, outputPath)

  logger.info('Running lint...')

  const target = affected ? 'affected' : 'run-many'
  const args = ['nx', target, '-t=lint', '--fix']
  const run = runLint(args, context.root)

  logger.info('Parsing lint output...')
  let entries = parseLintOutput(run.raw, context.root)
  let crashes: CrashedProject[] = []

  if (run.failure !== null) {
    const failedProjects = parseFailedProjects(run.raw)

    if (failedProjects.length === 0 && !entries.some((e) => e.severity === 'error')) {
      writeFileSync(reportPath, generateCrashReport(['npx', ...args].join(' '), run.failure, run.raw))
      logger.error(
        `Lint did not complete: the lint command ${run.failure} without reporting any lint error. See ${outputPath} for details.`
      )
      return { success: false }
    }

    const projectRoots = createMap<string, string>()
    for (const [name, project] of objectEntries(context.projectsConfigurations?.projects ?? {})) projectRoots.set(name, project.root)

    const isolated = isolateCrashes(findCrashSuspects(failedProjects, entries, projectRoots), context.root)
    crashes = isolated.crashes
    entries = parseLintOutput(run.raw + isolated.raw, context.root)
  }

  if (entries.length === 0 && crashes.length === 0) {
    logger.info('No lint issues found!')
    writeFileSync(reportPath, '# Lint Report\n\nNo issues found.\n')
    return { success: true }
  }

  const [legendMap, legendList] = buildLegend(entries)
  const fileMap = groupByFile(entries, legendMap)

  logger.info('Generating report...')
  const report = generateReport(legendList, fileMap, { maxFixes, workspaceRoot: context.root, crashes })

  writeFileSync(reportPath, report + '\n')
  logger.info(`Report written to ${outputPath}`)

  const errorCount = entries.filter((e) => e.severity === 'error').length
  logger.info(`Found ${errorCount} errors across ${fileMap.size} files`)

  if (crashes.length > 0) {
    logger.error(`Lint did not complete for ${crashes.length} projects. See ${outputPath} for details.`)
    return { success: false }
  }

  if (failOnError && errorCount > 0) {
    logger.error(`Lint failed with ${errorCount} errors. See ${outputPath} for details.`)
    return { success: false }
  }

  return { success: true }
}
