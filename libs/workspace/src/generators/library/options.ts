/** What the `library` generator takes. */
export interface LibraryGeneratorOptions {
  /** The name of the library, which names its directory and, with the scope, its package */
  name: string
  /** The directory the library is created under; `libs` when unset */
  directory?: string
  /** The npm scope of the package, with or without its `@`; the scope of the root manifest's name when unset */
  scope?: string
  /** The project's name, as tasks address it; the library's name when unset */
  projectName?: string
  /** The package's name; the library's name under the scope when unset */
  packageName?: string
  /** A description of the library */
  description?: string
  /** The tags the module boundaries read */
  tags?: string[]
  /** Whether the generator named `make-publishable` runs on the library next */
  publishable?: boolean
  /** npm keywords for the package, handed to `make-publishable` */
  keywords?: string[]
  /** The bundle formats the package builds, handed to `make-publishable` */
  formats?: string[]
  /** Skip formatting the generated files */
  skipFormat?: boolean
}
