import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Process exit codes, one per class of failure.
 *
 * Distinct codes are what let a caller react without parsing output: a build
 * script can retry a toolchain problem and must not retry a budget failure.
 */
export const ExitCode = freeze({
  /** Everything asked for was produced. */
  Ok: 0,
  /** The command line was malformed. */
  Usage: 1,
  /** The configuration file is missing or does not describe a workspace. */
  ConfigInvalid: 2,
  /** A scene failed to record. */
  SceneFailed: 3,
  /** A finished asset was larger than the scene allows. */
  BudgetExceeded: 4,
  /** A browser or encoder the run needed is not installed. */
  ToolchainMissing: 5,
  /** A committed asset is missing, oversized or stale. */
  CheckFailed: 6,
} as const)

/** One of the process exit codes. */
export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode]
