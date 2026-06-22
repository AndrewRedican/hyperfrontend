import type { FormatOutputs } from './format-output'

/**
 * Per-format counts emitted during a build, derived from `FormatOutputs`.
 */
export interface FormatCounts {
  /** Number of ESM entry points emitted. */
  esm: number
  /** Number of CommonJS entry points emitted. */
  cjs: number
  /** Number of IIFE bundles emitted. */
  iife: number
  /** Number of UMD bundles emitted. */
  umd: number
}

/**
 * Output record describing a single emitted bin (per format and per platform).
 */
export interface BinOutput {
  /** Bin name (matches the configured `BinConfig.name`). */
  name: string
  /** Output kind: a JS script for one of the supported formats, or a native SEA binary. */
  kind: 'cjs' | 'esm' | 'native'
  /** Absolute path to the emitted artifact. */
  outputPath: string
  /** Native target identifier (e.g., `linux-x64`); present only when `kind === 'native'`. */
  platform?: string
}

/**
 * Final result returned by the `build()` facade.
 */
export interface BuildResult {
  /** Whether the build completed without throwing. Always `true` when `build()` resolves. */
  success: true
  /** Per-format counts of emitted artifacts. */
  formatCounts: FormatCounts
  /** Aggregated per-format outputs. */
  formatOutputs: FormatOutputs
  /** Bins emitted (JS scripts and / or native binaries). */
  binOutputs: BinOutput[]
  /** Total wall-clock duration in milliseconds. */
  durationMs: number
}
