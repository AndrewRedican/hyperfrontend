import type { PackedConsumer } from '@hyperfrontend/testing/consumer'
import type { RunOutcome, TestConfig } from '@hyperfrontend/testing/runner'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { consumerProjectPath } from './consumer-projects'

/** What a runner child reports back, with the coverage directory read before it is removed. */
export interface RunnerReport {
  /** Whether the run passed. */
  success: boolean
  /** The reasons it did not. */
  failures: string[]
  /** The coverage table rows. */
  coverageTable: string[]
  /** The files the run left in the coverage directory. */
  coverageFiles: string[]
  /** The merged lcov report, or an empty string when none was written. */
  lcov: string
}

/** What a runner child needs: the configuration and the roots the installed runner resolves paths against. */
interface RunnerArgs {
  /** The project's test configuration. */
  config: TestConfig
  /** The workspace root coverage paths are reported from. */
  workspaceRoot: string
  /** The project root the configuration applies to. */
  projectRoot: string
}

/**
 * Names a file inside the installed package.
 *
 * @param consumer - The consumer the package is installed in.
 * @param segments - Path segments below the package root.
 * @returns The absolute path.
 */
export function installedPath(consumer: PackedConsumer, ...segments: string[]): string {
  return join(consumer.path, 'node_modules', '@hyperfrontend', 'testing', ...segments)
}

/**
 * Names a file inside the installed package as the `file:` URL Node accepts for `--import` and `--test-reporter`.
 *
 * @param consumer - The consumer the package is installed in.
 * @param segments - Path segments below the package root.
 * @returns The absolute `file:` URL.
 */
export function installedUrl(consumer: PackedConsumer, ...segments: string[]): string {
  return pathToFileURL(installedPath(consumer, ...segments)).href
}

/**
 * Runs the installed runner over the `project` consumer in a child and reports the outcome with its coverage output.
 *
 * @param consumer - The consumer the package and the projects are installed in.
 * @param config - The project's test configuration.
 * @returns What the run reported and wrote.
 */
export function runInstalledRunner(consumer: PackedConsumer, config: TestConfig): RunnerReport {
  return consumer.run(
    async (args: RunnerArgs): Promise<RunnerReport> => {
      const { runProjectTests } = await import('@hyperfrontend/testing/runner')
      const { existsSync: exists, mkdtempSync, readFileSync: read, readdirSync, rmSync } = await import('node:fs')
      const { tmpdir } = await import('node:os')
      const { join: joinPath } = await import('node:path')
      const coverageDir = mkdtempSync(joinPath(tmpdir(), 'hf-testing-e2e-'))
      try {
        const outcome: RunOutcome = runProjectTests(args.config, {
          workspaceRoot: args.workspaceRoot,
          projectRoot: args.projectRoot,
          coverageDir,
          silent: true,
        })
        const lcovPath = joinPath(coverageDir, 'lcov.info')
        return {
          success: outcome.success,
          failures: outcome.failures,
          coverageTable: outcome.coverageTable,
          coverageFiles: readdirSync(coverageDir).sort(),
          lcov: exists(lcovPath) ? read(lcovPath, 'utf8') : '',
        }
      } finally {
        rmSync(coverageDir, { recursive: true, force: true })
      }
    },
    { args: { config, workspaceRoot: consumer.path, projectRoot: join(consumer.path, consumerProjectPath('project')) }, timeout: 300_000 }
  )
}
