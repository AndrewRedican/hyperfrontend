import type { ExecutorContext } from '@nx/devkit'
import type { LintReportExecutorOptions } from './schema'
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { logger } from '../../lib/logger'
import { parseLintOutput, buildLegend, groupByFile } from './parser'
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
  const args = ['nx', target, '-t=lint']

  let raw: string
  try {
    raw = execFileSync('npx', args, {
      env: { ...process.env, CI: '1' },
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      cwd: context.root,
    })
  } catch (err: unknown) {
    const execError = <ExecError>err
    raw = (execError.stdout ?? '') + (execError.stderr ?? '')
  }

  logger.info('Parsing lint output...')
  const entries = parseLintOutput(raw, context.root)

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

  const errorCount = entries.filter((e) => e.severity === 'error').length
  logger.info(`Found ${errorCount} errors across ${fileMap.size} files`)

  if (failOnError && errorCount > 0) {
    logger.error(`Lint failed with ${errorCount} errors. See ${outputPath} for details.`)
    return { success: false }
  }

  return { success: true }
}
