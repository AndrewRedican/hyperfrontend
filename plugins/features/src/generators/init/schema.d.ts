/**
 * Schema for the init generator options.
 */
export interface InitGeneratorSchema {
  /** Target project name */
  project: string
  /** Optional path to configuration file */
  configPath?: string
  /** Skip dependency installation */
  skipInstall?: boolean
}
