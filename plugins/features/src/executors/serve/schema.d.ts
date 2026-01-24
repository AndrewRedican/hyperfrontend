export interface ServeExecutorSchema {
  project: string
  port?: number
  open?: boolean
  mode?: 'development' | 'production'
}
