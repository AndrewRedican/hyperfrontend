/**
 * The runner behind a project's `test.config.ts`: one `node --test` run per environment, then
 * the merged coverage report, the threshold gate and the completeness check.
 *
 * @module @hyperfrontend/testing/runner
 */
export type { RunPlan } from './argv'
export type { CoverageThresholds, TestConfig, TestEnvironment } from './config'
export type { RunContext, RunOutcome } from './run'
export { buildRunPlan, moduleUrl, selectSpecFiles, serialiseModuleMap, serialiseSetupFiles, setupPaths } from './argv'
export { BASELINE_COVERAGE_EXCLUDE, withDefaults } from './config'
export { runProjectTests } from './run'
