/**
 * Structural pattern of a library's entry-point layout.
 *
 * - `root`: single entry at `src/index.ts`
 * - `platform`: browser / node split under `src/browser/` and `src/node/`
 * - `feature`: multiple feature modules under `src/<feature>/`
 * - `hybrid`: a mix of root, platform, and / or feature entries
 * - `complex`: nested platform-plus-feature structures
 */
export type EntryPointCategory = 'root' | 'platform' | 'feature' | 'hybrid' | 'complex'

/**
 * Platform hint used for browser / node-specific entry points.
 */
export type EntryPointPlatform = 'browser' | 'node'

/**
 * A single resolved entry point within a library.
 */
export interface EntryPoint {
  /** Subpath export key relative to the package root (e.g., `.`, `./browser`, `./browser/v1`). */
  exportPath: string
  /** Path inside `src/` to the entry directory (e.g., ``, `browser`, `browser/v1`). */
  srcPath: string
  /** Absolute path to the entry source file (e.g., `<projectRoot>/src/<srcPath>/index.ts`). */
  inputFile: string
  /** True when the entry corresponds to `src/index.ts`. */
  isRoot: boolean
  /** Platform hint when the entry lives under `src/browser/` or `src/node/`. */
  platform?: EntryPointPlatform
}

/**
 * Result of scanning a library for its entry points.
 */
export interface EntryPointDiscovery {
  /** Detected layout category. */
  category: EntryPointCategory
  /** Every discovered entry point in stable order. */
  entryPoints: EntryPoint[]
  /** Whether `src/index.ts` exists. */
  hasRootEntry: boolean
  /** Subset of entries flagged with a platform hint. */
  platformEntries: EntryPoint[]
  /** Subset of feature / module entries (non-root, non-platform). */
  featureEntries: EntryPoint[]
}
