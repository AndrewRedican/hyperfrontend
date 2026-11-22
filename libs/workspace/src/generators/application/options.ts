/** What the `application` generator takes. */
export interface ApplicationGeneratorOptions {
  /** The name of the application, which names its directory and, with the scope of the root manifest, its package */
  name: string
  /** The directory the application is created under; `apps` when unset */
  directory?: string
  /** The project's name, as tasks address it; the application's name when unset */
  projectName?: string
  /** A description of the application */
  description?: string
  /** The tags the module boundaries read */
  tags?: string[]
  /** Skip formatting the generated files */
  skipFormat?: boolean
}
