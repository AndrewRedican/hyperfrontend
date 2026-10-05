import type { ExecutorContext } from '@nx/devkit'
import type { LintReportExecutorOptions } from './schema'
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { logger } from '../../lib/logger'
import { parseLintOutput, buildLegend, groupByFile, stripAnsi } from './parser'
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
 * Number of trailing output lines kept in the report of a lint run that did not complete.
 */
const CRASH_TAIL_LINES = 80

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
 * Build the report for a lint run that failed without any parseable ESLint error.
 *
 * @param command - Command line that was run
 * @param failure - Phrase describing how the command ended
 * @param raw - Raw output captured from the command
 * @returns Report content
 */
function generateCrashReport(command: string, failure: string, raw: string): string {
  const lines = stripAnsi(raw).trimEnd().split(/\r?\n/)
  const tail = lines.slice(-CRASH_TAIL_LINES).join('\n')
  return [
    '# Lint Report',
    '',
    `Lint did not complete: \`${command}\` ${failure} and its output holds no ESLint error.`,
    'This is a crash of the lint run itself (ESLint or a rule throwing, an out-of-memory kill, a launch failure), not a clean result.',
    '',
    `## Output tail (last ${CRASH_TAIL_LINES} lines)`,
    '',
    '```',
    tail || '(no output captured)',
    '```',
    '',
  ].join('\n')
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
 * A lint command that fails without a single parseable ESLint error did not
 * lint at all, so the executor fails regardless of `failOnError` and reports
 * the tail of the raw output instead.
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

  logger.info('Running lint...')

  const target = affected ? 'affected' : 'run-many'
  const args = ['nx', target, '-t=lint', '--fix']

  let raw: string
  let failure: string | null = null
  try {
    raw = execFileSync('npx', args, {
      env: { ...process.env, CI: '1' },
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      cwd: context.root,
      shell: process.platform === 'win32',
    })
  } catch (err: unknown) {
    const execError = err as ExecError
    raw = (execError.stdout ?? '') + (execError.stderr ?? '')
    failure = describeFailure(execError)
  }

  logger.info('Parsing lint output...')
  const entries = parseLintOutput(raw, context.root)
  const errorCount = entries.filter((e) => e.severity === 'error').length

  if (failure !== null && errorCount === 0) {
    writeFileSync(join(context.root, outputPath), generateCrashReport(['npx', ...args].join(' '), failure, raw))
    logger.error(`Lint did not complete: the lint command ${failure} without reporting any ESLint error. See ${outputPath} for details.`)
    return { success: false }
  }

  if (entries.length === 0) {
    logger.info('No lint issues found!')
    writeFileSync(join(context.root, outputPath), '# Lint Report\n\nNo issues found.\n')
    return { success: true }
  }

  const [legendMap, legendList] = buildLegend(entries)
  const fileMap = groupByFile(entries, legendMap)

  logger.info('Generating report...')
  const report = generateReport(legendList, fileMap, { maxFixes, workspaceRoot: context.root })

  writeFileSync(join(context.root, outputPath), report + '\n')
  logger.info(`Report written to ${outputPath}`)

  logger.info(`Found ${errorCount} errors across ${fileMap.size} files`)

  if (failOnError && errorCount > 0) {
    logger.error(`Lint failed with ${errorCount} errors. See ${outputPath} for details.`)
    return { success: false }
  }

  return { success: true }
}
