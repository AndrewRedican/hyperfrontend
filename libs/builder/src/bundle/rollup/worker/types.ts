import type { WorkspaceBundledDepRoute } from '../../dependencies/externalize-plugin'

/**
 * Output format the rollup worker produces.
 */
export type RollupWorkerFormat = 'esm' | 'cjs' | 'iife' | 'umd'

/**
 * Externalize-bundled-deps plugin payload carried by ESM / CJS descriptors when
 * a format opts into `bundleAllDeps`.
 */
export interface RollupWorkerBundledDepsPlugin {
  /** Bundled-dep package names whose imports should be rewritten to `_dependencies/<dep>/`. */
  deps: string[]
  /** Absolute path to the `_dependencies/` root the plugin maps imports into. */
  depsRoot: string
}

/**
 * Bundle-output configuration carried by IIFE / UMD descriptors.
 *
 * Captures the format-specific output knobs the worker needs to reconstruct
 * `OutputOptions` for a self-contained browser bundle.
 */
export interface RollupWorkerBundleOutput {
  /** Global variable name exposed by the bundle. */
  globalName: string
  /** Emit a minified twin alongside the unminified bundle. */
  minify: boolean
  /** Global names mapped onto the external dependencies. */
  globals?: Record<string, string>
  /** UMD-only AMD module identifier. */
  amdId?: string
}

/**
 * Bin-output configuration carried by ESM / CJS descriptors when the entry is a
 * `package.json#bin` executable script.
 *
 * When set, the worker writes the bundle to {@link outputFile} (instead of the
 * format's default `index.<fmt>.js` filename), prepends the {@link banner} and
 * appends the {@link footer}, and applies {@link chmod} to the produced file so
 * the npm bin symlink is invokable.
 */
export interface RollupWorkerBin {
  /** Absolute path the worker writes the bin output to. */
  outputFile: string
  /** Banner string prepended to the output (typically the `#!/usr/bin/env node` shebang). */
  banner: string
  /** Footer string appended to the output (the bootstrap that wires the runner to `process.argv`). */
  footer: string
  /** Rollup `output.exports` mode passed through to `bundle.write`. */
  exports: 'named' | 'default' | 'auto' | 'none'
  /** When `true`, dynamic imports are inlined so the bin remains a single self-contained file. */
  inlineDynamicImports: boolean
  /** File mode applied via `chmodSync` after the output is written (e.g. `0o755`). */
  chmod: number
}

/**
 * Serializable rollup-build descriptor: the contract between the parent
 * orchestrator and a forked worker. Every field must round-trip through
 * `JSON.stringify` / `JSON.parse`: no functions, no class instances.
 *
 * The worker reconstructs `RollupOptions` from the descriptor using the same
 * plugin factories the parent would have used in-process.
 */
export interface RollupBuildDescriptor {
  /** Output format. */
  format: RollupWorkerFormat
  /** Absolute path to the source TS/JS entry. */
  inputFile: string
  /** Absolute directory the worker writes its output(s) under. */
  outputDir: string
  /** Pre-resolved external package list. */
  external: string[]
  /** Sourcemap toggle threaded into the rollup output. */
  sourcemap: boolean
  /** When set: install the externalize-bundled-deps plugin (esm/cjs only). */
  bundledDepsPlugin: RollupWorkerBundledDepsPlugin | null
  /**
   * Workspace bundled-dep routes consumed by the externalize plugin. When non-empty,
   * imports of these workspace packages (and matching sub-paths) are rerouted to
   * the corresponding `_dependencies/<packageName>(/<sub>)?/index.<ext>` chunk.
   * Empty array for descriptors that do not opt into workspace-dep hoisting.
   */
  workspaceRoutes: WorkspaceBundledDepRoute[]
  /** Absolute tsconfig path threaded into the typescript plugin. */
  tsConfigPath: string
  /** Absolute project root threaded into the typescript plugin. */
  projectRoot: string
  /** Absolute workspace root threaded into the typescript plugin. */
  workspaceRoot: string
  /** When `true`, workspace deps are inlined; otherwise treated as external. */
  bundleWorkspaceDeps: boolean
  /** Bundle-output config carried by IIFE / UMD descriptors. `null` for esm/cjs. */
  bundle: RollupWorkerBundleOutput | null
  /** Bin-output config carried by ESM / CJS descriptors that emit an executable bin. `null` for non-bin entries. */
  bin: RollupWorkerBin | null
  /** Absolute path the worker writes its JSON report to. */
  reportPath: string
}

/**
 * Memory + size summary written to `reportPath` when the worker exits cleanly.
 */
export interface RollupWorkerReport {
  /** Total on-disk size of every emitted output, in bytes. */
  outputSize: number
  /** `process.memoryUsage().heapUsed` in MB at end of bundle. */
  endHeapMB: number
  /** `process.memoryUsage().rss` in MB at end of bundle. */
  endRssMB: number
  /** Worker wall-clock duration in ms. */
  durationMs: number
}
