/** What the `move` generator takes. */
export interface MoveGeneratorOptions {
  /** The project moved */
  project: string
  /** The directory the project's directory moves under, relative to the root */
  destination: string
  /** The new name of the project's directory; the current one when unset */
  newName?: string
  /** The project's new name, when the names are updated; the directory's name when unset */
  projectName?: string
  /** The package's new name, when the names are updated; the directory's name under the package's current scope when unset */
  packageName?: string
  /** Whether the project's and the package's names follow the new location; true when unset */
  updateName?: boolean
  /** Skip formatting the generated files */
  skipFormat?: boolean
}
