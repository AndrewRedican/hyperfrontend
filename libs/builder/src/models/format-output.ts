import type { IifeConfig, UmdConfig } from './build-config'
import type { EntryPoint } from './entry-point'

/**
 * Build output for a single IIFE bundle.
 */
export interface IifeOutput {
  /** Resolved IIFE configuration that produced the bundle. */
  config: IifeConfig
  /** Entry points combined into the bundle. */
  entries: EntryPoint[]
}

/**
 * Build output for a single UMD bundle.
 */
export interface UmdOutput {
  /** Resolved UMD configuration that produced the bundle. */
  config: UmdConfig
  /** Entry points combined into the bundle. */
  entries: EntryPoint[]
}

/**
 * Aggregate per-format output collected during the bundle phase.
 */
export interface FormatOutputs {
  /** ESM entry points emitted. */
  esm: EntryPoint[]
  /** CommonJS entry points emitted. */
  cjs: EntryPoint[]
  /** IIFE bundles emitted. */
  iife: IifeOutput[]
  /** UMD bundles emitted. */
  umd: UmdOutput[]
}
