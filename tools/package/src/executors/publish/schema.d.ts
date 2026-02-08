/**
 * Options for the publish executor.
 */
export interface PublishExecutorOptions {
  /** Run in dry-run mode without actually publishing */
  dryRun?: boolean
  /** Custom npm registry URL */
  registry?: string
  /** NPM dist-tag to publish with */
  tag?: string
  /** Publish access level for scoped packages */
  access?: 'public' | 'restricted'
  /** One-time password for npm 2FA */
  otp?: string
}
