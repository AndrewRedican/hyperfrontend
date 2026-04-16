/**
 * Schema options for the rename generator.
 */
export interface RenameGeneratorSchema {
  /** Current project name to rename */
  project: string
  /** New name for the project (will be prefixed appropriately) */
  newName: string
  /** Skip formatting the generated files */
  skipFormat?: boolean
}
