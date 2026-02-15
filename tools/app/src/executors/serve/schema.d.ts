/**
 * Options for the serve executor.
 */
export interface ServeExecutorOptions {
  /** Custom serve command to run. Defaults to npm run dev. */
  command?: string
  /** Port to run the development server on. */
  port?: number
}
