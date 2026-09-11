/**
 * A named runtime profile a publishable package can declare.
 *
 * Each profile is one of the clusters the repository's packages already fall
 * into: `isomorphic` for code that runs anywhere, `node-only` for code that
 * reaches for Node built-ins, and `browser-only` for code that needs a DOM or a
 * worker scope. A package whose support in a runtime is only partial, or that
 * needs a caveat written alongside it, declares that by hand; no profile writes
 * a `partial` level or a note.
 */
export type CompatibilityProfile = 'isomorphic' | 'node-only' | 'browser-only'

/**
 * Schema options for the make-publishable generator.
 */
export interface MakePublishableGeneratorSchema {
  /** The name of the project to make publishable (e.g., 'lib-my-utils') */
  project: string
  /** Global variable name for IIFE/UMD builds (e.g., 'HyperfrontendMyUtils') */
  globalName?: string
  /** Entry point for IIFE/UMD bundles (e.g., '.' or './browser') */
  bundleEntry?: string
  /** npm keywords for the package */
  keywords?: string[]
  /** Runtime profile written to metadata.compatibility in project.json */
  compatibility?: CompatibilityProfile
  /** Skip creating E2E project */
  skipE2E?: boolean
  /** Skip creating CI workflow files */
  skipCI?: boolean
  /** Skip formatting the generated files */
  skipFormat?: boolean
}
