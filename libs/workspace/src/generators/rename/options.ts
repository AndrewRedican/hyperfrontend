/** What the `rename` generator takes. */
export interface RenameGeneratorOptions {
  /** The project renamed */
  project: string
  /** The project's new name */
  newName: string
  /** The package's new name; the new name under the package's current scope when unset */
  packageName?: string
  /** Skip formatting the generated files */
  skipFormat?: boolean
}
