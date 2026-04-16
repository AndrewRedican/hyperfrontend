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
  /** Skip formatting the generated files */
  skipFormat?: boolean
}
