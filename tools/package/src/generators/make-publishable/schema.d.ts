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
  /** Skip creating E2E project */
  skipE2E?: boolean
  /** Skip creating CI workflow files */
  skipCI?: boolean
  /** Skip formatting the generated files */
  skipFormat?: boolean
}
