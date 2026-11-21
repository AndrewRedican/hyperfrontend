/** What the `workspace` generator takes. */
export interface WorkspaceGeneratorOptions {
  /** Write a first hooks configuration and install its Git hooks into the clone */
  hooks?: boolean
  /** With hooks, add the root prepare script that installs them on every install */
  prepare?: boolean
  /** Skip formatting the generated files */
  skipFormat?: boolean
}
