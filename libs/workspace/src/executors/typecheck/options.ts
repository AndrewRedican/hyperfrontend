/**
 * Schema types for the typecheck executor.
 */
export interface TypecheckExecutorOptions {
  /**
   * Path to the library TypeScript configuration file, relative to the workspace root.
   * Defaults to {projectRoot}/tsconfig.lib.json.
   */
  tsConfig?: string
  /**
   * Path to the spec TypeScript configuration file, relative to the workspace root.
   * Defaults to {projectRoot}/tsconfig.spec.json, checked when that file exists.
   */
  specTsConfig?: string
}
