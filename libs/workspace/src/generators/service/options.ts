/** What the `service` generator takes. */
export interface ServiceGeneratorOptions {
  /** The name of the service, which names its directory and, with the scope of the root manifest, its package */
  name: string
  /** The directory the service is created under; `apps` when unset */
  directory?: string
  /** The project's name, as tasks address it; the service's name when unset */
  projectName?: string
  /** A description of the service */
  description?: string
  /** The tags the module boundaries read */
  tags?: string[]
  /** Skip formatting the generated files */
  skipFormat?: boolean
}
