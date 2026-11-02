/** The export subpaths, with the empty string for the main entry. */
export const ENTRIES = ['', 'browser', 'coverage', 'dom', 'fs', 'hooks', 'process', 'reporter', 'runner']
/** The named exports of the main entry, sorted. */
export const MAIN_EXPORTS = [
  'createDeferred',
  'createMock',
  'describe',
  'equals',
  'expect',
  'flushPromises',
  'it',
  'jest',
  'matchesSubset',
  'sleep',
  'waitFor',
  'waitUntil',
]
/** The modifiers hung off `it`. */
export const IT_MODIFIERS = ['each', 'only', 'skip', 'todo', 'concurrent', 'failing']
/** The modifiers hung off `describe`. */
export const DESCRIBE_MODIFIERS = ['each', 'only', 'skip']
/** The asymmetric matchers and assertion counters hung off `expect`. */
export const EXPECT_STATICS = [
  'any',
  'anything',
  'objectContaining',
  'arrayContaining',
  'stringContaining',
  'stringMatching',
  'closeTo',
  'assertions',
  'hasAssertions',
]
/** The asymmetric matchers that also exist under `expect.not`. */
export const EXPECT_NEGATIONS = ['objectContaining', 'arrayContaining', 'stringContaining', 'stringMatching']
/** The methods of the `jest` namespace. */
export const JEST_METHODS = [
  'fn',
  'spyOn',
  'mocked',
  'clearAllMocks',
  'resetAllMocks',
  'restoreAllMocks',
  'replaceProperty',
  'stubEnv',
  'stubGlobal',
  'useFakeTimers',
  'useRealTimers',
  'advanceTimersByTime',
  'advanceTimersByTimeAsync',
  'runAllTimers',
  'runOnlyPendingTimers',
  'clearAllTimers',
  'setSystemTime',
  'resetModules',
  'mock',
  'unmock',
  'doMock',
  'requireActual',
  'requireMock',
]
/** The named exports of each helper entry, sorted. */
export const HELPER_EXPORTS = {
  browser: ['createFakeWindow', 'createWindowPair', 'installResizeObserver'],
  fs: ['createTempDir', 'useTempDir', 'writeFile', 'writeTree'],
  process: [
    'Keys',
    'captureStdio',
    'cleanSignalExit',
    'createCapturedOutput',
    'createFakeChildProcess',
    'createTtyInput',
    'readAll',
    'sendSignal',
    'spawnSyncResult',
  ],
}
/** The functions the runner entry exports. */
export const RUNNER_FUNCTIONS = ['runProjectTests', 'buildRunPlan', 'withDefaults']
/** The coverage exclusions every configuration starts from. */
export const BASELINE_EXCLUDE = ['**/*.spec.ts', '**/*.spec.tsx', '**/*.d.ts', 'test.config.ts']
/** The functions the coverage entry exports. */
export const COVERAGE_EXPORTS = [
  'mergeLcov',
  'renderLcov',
  'findThresholdShortfalls',
  'renderCoverageTable',
  'findUnmeasuredFiles',
  'fileTotals',
  'overallTotals',
  'percentOf',
  'uncoveredRanges',
]
