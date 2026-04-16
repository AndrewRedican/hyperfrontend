/**
 * Schema options for the move generator.
 */
export interface MoveGeneratorSchema {
  /** Project name to move */
  project: string
  /** Destination directory relative to workspace root (e.g., 'libs/utils') */
  destination: string
  /** New name for the project (optional, defaults to keeping current name) */
  newName?: string
  /** Update the project name and package name based on new location */
  updateName?: boolean
  /** Skip formatting the generated files */
  skipFormat?: boolean
}
