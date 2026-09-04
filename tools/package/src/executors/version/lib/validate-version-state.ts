import type { ChangelogEntry, FlowConfig, FlowResult } from '@hyperfrontend/versioning'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { readPackageJsonIfExists } from '@hyperfrontend/project-scope/project/package'
import { parseChangelog, isEntryContentEqual, hasVersion, getEntryByVersion } from '@hyperfrontend/versioning/changelog'
import { createVersionFlow } from '@hyperfrontend/versioning/flow'
import { executeFlow } from '@hyperfrontend/versioning/flow/executor'

/**
 * Type of discrepancy discovered during validation.
 */
export type DiscrepancyType = 'version-mismatch' | 'changelog-missing' | 'changelog-mismatch' | 'unexpected-state'

/**
 * Details about a specific validation discrepancy.
 */
export interface Discrepancy {
  /** The file where the discrepancy was found */
  readonly file: string
  /** Type of discrepancy */
  readonly type: DiscrepancyType
  /** Expected value */
  readonly expected: string
  /** Actual value found */
  readonly actual: string
  /** Human-readable remediation instruction */
  readonly remedy: string
}

/**
 * Expected version state calculated from commit analysis.
 */
export interface ExpectedVersionState {
  /** Expected next version */
  readonly version: string
  /** Type of version bump */
  readonly bumpType: 'major' | 'minor' | 'patch' | 'none'
  /** Expected changelog entry (if applicable) */
  readonly changelogEntry?: ChangelogEntry
  /** Commits analyzed */
  readonly commitCount: number
}

/**
 * Actual version state read from disk.
 */
export interface ActualVersionState {
  /** Actual version in package.json */
  readonly version: string
  /** Whether changelog contains expected version entry */
  readonly hasVersionEntry: boolean
  /** The actual changelog entry (if exists) */
  readonly changelogEntry?: ChangelogEntry
}

/**
 * Result of version state validation.
 */
export interface VersionValidationResult {
  /** Validation status */
  readonly status: 'valid' | 'invalid' | 'skipped' | 'error'
  /** Library/project name */
  readonly library: string
  /** Reason for skipping (if status is 'skipped') */
  readonly skipReason?: string
  /** Error message (if status is 'error') */
  readonly errorMessage?: string
  /** Expected state (if validation ran) */
  readonly expected?: ExpectedVersionState
  /** Actual state (if validation ran) */
  readonly actual?: ActualVersionState
  /** List of discrepancies found */
  readonly discrepancies: readonly Discrepancy[]
}

/**
 * Options for version validation.
 */
export interface ValidateVersionStateOptions {
  /** Workspace root path */
  readonly workspaceRoot: string
  /** Project/library name */
  readonly projectName: string
  /** Project root relative to workspace */
  readonly projectRoot: string
  /** Enable verbose output */
  readonly verbose?: boolean
  /** Scope filtering configuration */
  readonly scopeFiltering?: FlowConfig['scopeFiltering']
  /** Upper bound on the commit window the flow analyzes */
  readonly maxCommitFallback?: FlowConfig['maxCommitFallback']
  /** Repository configuration */
  readonly repository?: FlowConfig['repository']
}

/**
 * Validates that a library's version state matches what's expected based on
 * conventional commit analysis. This is used by the version-check executor
 * to verify that lefthook has properly updated versions before CI validation.
 *
 * The validation process:
 * 1. Runs the version flow in dry-run mode to calculate expected state
 * 2. Reads actual state from disk (package.json, CHANGELOG.md)
 * 3. Compares expected vs actual versions and changelog entries
 * 4. Returns detailed discrepancies if mismatches found
 *
 * A changelog entry is compared by its content: the version and the sections. The date
 * and the compare URL are stamped at generation time, so a version commit that has not
 * been published yet keeps validating as later commits land on top of it and as the days
 * pass, right up until its content no longer describes the commits since the last release.
 *
 * @param options - Validation options including paths and configuration
 * @returns Validation result with status and any discrepancies found
 */
export async function validateVersionState(options: ValidateVersionStateOptions): Promise<VersionValidationResult> {
  const { workspaceRoot, projectName, projectRoot, verbose, scopeFiltering, maxCommitFallback, repository } = options
  const packageJsonPath = join(workspaceRoot, projectRoot, 'package.json')
  const changelogPath = join(workspaceRoot, projectRoot, 'CHANGELOG.md')

  const flowConfig: Partial<FlowConfig> = {
    dryRun: true,
    skipGit: true,
    skipTag: true,
    skipChangelog: false,
    repository: repository ?? 'inferred',
    scopeFiltering,
    maxCommitFallback,
  }

  let flowResult: FlowResult
  try {
    const flow = createVersionFlow('conventional', flowConfig)
    flowResult = await executeFlow(flow, projectName, workspaceRoot, {
      dryRun: true,
      verbose: verbose ?? false,
      projectRoot,
    })
  } catch (error) {
    return {
      status: 'error',
      library: projectName,
      errorMessage: `Failed to execute version flow: ${error instanceof Error ? error.message : String(error)}`,
      discrepancies: [],
    }
  }

  if (flowResult.status === 'skipped') {
    return {
      status: 'skipped',
      library: projectName,
      skipReason: flowResult.summary || 'No version bump needed or already published',
      discrepancies: [],
    }
  }

  if (flowResult.status === 'failed') {
    return {
      status: 'error',
      library: projectName,
      errorMessage: flowResult.summary || 'Version flow failed',
      discrepancies: [],
    }
  }

  const { state } = flowResult

  if (state.bumpType === 'none' || !state.nextVersion) {
    return {
      status: 'skipped',
      library: projectName,
      skipReason: 'No version bump required based on commit analysis',
      discrepancies: [],
    }
  }

  const expected: ExpectedVersionState = {
    version: state.nextVersion,
    bumpType: state.bumpType as 'major' | 'minor' | 'patch' | 'none',
    changelogEntry: state.changelogEntry,
    commitCount: state.commits?.length ?? 0,
  }

  const pkg = readPackageJsonIfExists(packageJsonPath)
  if (!pkg) {
    return {
      status: 'error',
      library: projectName,
      errorMessage: `Cannot read package.json at ${packageJsonPath}`,
      discrepancies: [],
    }
  }

  let actualHasVersionEntry = false
  let actualChangelogEntry: ChangelogEntry | undefined
  if (existsSync(changelogPath)) {
    try {
      const changelogContent = readFileSync(changelogPath, 'utf-8')
      const actualChangelog = parseChangelog(changelogContent)
      actualHasVersionEntry = hasVersion(actualChangelog, expected.version)
      actualChangelogEntry = getEntryByVersion(actualChangelog, expected.version) ?? undefined
    } catch {
      // Changelog parsing failed - will be reported as discrepancy
    }
  }

  const actual: ActualVersionState = {
    version: pkg.version ?? '0.0.0',
    hasVersionEntry: actualHasVersionEntry,
    changelogEntry: actualChangelogEntry,
  }

  const discrepancies: Discrepancy[] = []

  if (actual.version !== expected.version) {
    discrepancies.push({
      file: 'package.json',
      type: 'version-mismatch',
      expected: expected.version,
      actual: actual.version,
      remedy: `Run: npx nx version ${projectName}\nOr push again to trigger lefthook versioning`,
    })
  }

  if (!actual.hasVersionEntry) {
    discrepancies.push({
      file: 'CHANGELOG.md',
      type: 'changelog-missing',
      expected: `Entry for version ${expected.version}`,
      actual: 'No entry found',
      remedy: `Run: npx nx version ${projectName}\nThis will generate the changelog entry`,
    })
  } else if (expected.changelogEntry && actual.changelogEntry) {
    // why: the date and compare URL are stamped when an entry is generated, so a committed entry that is still waiting to be published legitimately carries an older stamp than the one regenerated here.
    if (!isEntryContentEqual(expected.changelogEntry, actual.changelogEntry)) {
      discrepancies.push({
        file: 'CHANGELOG.md',
        type: 'changelog-mismatch',
        expected: 'Changelog entry generated from current commits',
        actual: 'Existing entry differs from expected',
        remedy: 'Re-run versioning to regenerate changelog entry',
      })
    }
  }

  if (discrepancies.length === 0) {
    return {
      status: 'valid',
      library: projectName,
      expected,
      actual,
      discrepancies: [],
    }
  }

  return {
    status: 'invalid',
    library: projectName,
    expected,
    actual,
    discrepancies,
  }
}

/**
 * Formats a validation result as a user-friendly string.
 *
 * @param result - The validation result to format
 * @returns Formatted string for console output
 */
export function formatValidationResult(result: VersionValidationResult): string {
  const lines: string[] = []

  switch (result.status) {
    case 'valid':
      lines.push(`✅ ${result.library}: version ${result.expected?.version} matches expected`)
      break

    case 'skipped':
      lines.push(`⏭️  ${result.library}: ${result.skipReason}`)
      break

    case 'error':
      lines.push(`⚠️  ${result.library}: ${result.errorMessage}`)
      break

    case 'invalid':
      lines.push(`❌ ${result.library}: version mismatch`)
      lines.push('')
      if (result.expected) {
        lines.push(
          `Expected: ${result.expected.version} (${result.expected.bumpType.toUpperCase()} bump from ${result.expected.commitCount} commit(s))`
        )
      }
      if (result.actual) {
        lines.push(`Actual:   ${result.actual.version}`)
      }
      lines.push('')
      lines.push('Discrepancies:')
      for (const d of result.discrepancies) {
        lines.push(`  - ${d.file}: ${d.type}`)
        lines.push(`    Expected: ${d.expected}`)
        lines.push(`    Actual:   ${d.actual}`)
      }
      lines.push('')
      lines.push('Remedy:')
      if (result.discrepancies.length > 0) {
        lines.push(
          result.discrepancies[0].remedy
            .split('\n')
            .map((l) => `  ${l}`)
            .join('\n')
        )
      }
      break
  }

  return lines.join('\n')
}
