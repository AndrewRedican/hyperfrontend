/**
 * Git hooks owned by the workspace: the typed configuration of their steps, the runner behind `hf hooks run`, and the stubs Git starts.
 *
 * @module @hyperfrontend/workspace/git-hooks
 */

export type { HooksSession } from './command'
export type { GitHook, HookName, HooksConfig, HookStep, LocalHooksConfig } from './config'
export type { LoadedHooks } from './load'
export type { Launch } from './program'
export type { HookHost, HookRun } from './run'
export type { SkipSources } from './skips'
export type { Git } from './staged'
export type { StubPlace, StubPlan } from './stubs'
export { HOOKS_USAGE, runHooksCommand } from './command'
export { checkHooks, checkLocalHooks, defineHooks, defineLocalHooks, GIT_HOOKS, PUSH_STEPS, stepNames } from './config'
export { HOOKS_CONFIG, loadHooks, LOCAL_HOOKS_CONFIG } from './load'
export { launchOf } from './program'
export { runHook } from './run'
export { HOOKS_VARIABLE, namesOf, SKIP_VARIABLE, skipReason, unknownSkips } from './skips'
export { fullyStaged, gitIn, restage } from './staged'
export { STUB_MARKER, StubOrigin, planStubs, stubEntry, stubOf, stubOrigin, stubPlace } from './stubs'
