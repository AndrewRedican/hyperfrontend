import type { FileCoverage } from './lcov.ts'
import { globSync } from 'node:fs'
import { relative, resolve } from 'node:path'

/**
 * The outcome of comparing the coverage report against the files that should be in it.
 */
export type CompletenessReport = {
  /** Files matched by the include globs that never appeared in the report. */
  missing: string[]
  /** How many files the report did account for. */
  covered: number
}

/**
 * Finds source files that should have been measured but are absent from the report.
 *
 * Node's coverage only reports files the run actually loaded, so a source file no test
 * imports simply vanishes instead of landing at zero percent. That silently removes the
 * guarantee a full-coverage threshold is supposed to give: a new, wholly untested file
 * would not fail the build. Comparing the report against the include globs restores it.
 *
 * @param measured - The merged report, already unioned across the project's environments.
 * @param projectRoot - Directory the include globs and report paths are anchored to.
 * @param include - Globs naming every file that must be measured.
 * @param exclude - Globs naming files that are exempt.
 * @returns The files missing from the report, and how many were accounted for.
 */
export function findUnmeasuredFiles(measured: readonly FileCoverage[], projectRoot: string, include: string[], exclude: string[]): CompletenessReport {
  const reported = new Set(measured.map((file) => resolve(projectRoot, file.path)))
  const expected = globSync(include, { cwd: projectRoot, exclude })

  const missing = expected
    .map((entry) => resolve(projectRoot, entry))
    .filter((absolute) => !reported.has(absolute))
    .map((absolute) => relative(projectRoot, absolute))
    .sort()

  return { missing, covered: reported.size }
}
