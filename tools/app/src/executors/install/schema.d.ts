/**
 * Options for the install executor.
 */
export interface InstallExecutorOptions {
  /** Use npm ci instead of npm install for clean installs. */
  ci?: boolean
  /** Use --frozen-lockfile to fail if lockfile needs update. */
  frozen?: boolean
}
