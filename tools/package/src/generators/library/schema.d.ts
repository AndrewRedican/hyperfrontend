import type { CompatibilityProfile, DocsCategoryOption, EcosystemTierOption } from '../make-publishable/schema'

/**
 * Schema options for the library generator.
 */
export interface LibraryGeneratorSchema {
  /** The name of the library (without 'lib-' prefix) */
  name: string
  /** The directory where the library will be created (e.g., 'libs' or 'libs/utils') */
  directory?: string
  /** A description of the library */
  description?: string
  /** The type tag for module boundary enforcement */
  type?: 'core' | 'util' | 'feature' | 'protocol'
  /** Whether the library should be publishable to npm */
  publishable?: boolean
  /** npm keywords for the package (only used when publishable is true) */
  keywords?: string[]
  /** Runtime profile written to metadata.compatibility (required when publishable is true) */
  compatibility?: CompatibilityProfile
  /** Section of the docs-site index (only used when publishable is true) */
  docsCategory?: DocsCategoryOption
  /** Level of the docs-site ecosystem hierarchy (only used when publishable is true) */
  ecosystemTier?: EcosystemTierOption
  /** Skip formatting the generated files */
  skipFormat?: boolean
}
