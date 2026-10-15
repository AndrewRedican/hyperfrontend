/**
 * The coverage side of a run: lcov reports merged per file, the threshold gate, the per-file
 * table, and the completeness check for source files no test loaded.
 *
 * @module @hyperfrontend/testing/coverage
 */
export type { CompletenessReport } from './completeness'
export type { FileCoverage, Metric, MetricTotals } from './lcov'
export { findUnmeasuredFiles } from './completeness'
export { findThresholdShortfalls, renderCoverageTable } from './gate'
export { fileTotals, mergeLcov, overallTotals, percentOf, renderLcov, uncoveredRanges } from './lcov'
