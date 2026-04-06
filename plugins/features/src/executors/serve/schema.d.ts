/**
 * Schema for the serve executor configuration.
 */
export interface ServeExecutorSchema {
  /** Target project to serve */
  project: string
  /** Port number for the dev server */
  port?: number
  /** Open browser on server start */
  open?: boolean
  /** Build mode */
  mode?: 'development' | 'production'
}
