import type { MemoryMonitorOptions } from '@hyperfrontend/builder/models'

export const WORKSPACE_SCOPE = '@hyperfrontend/'

export const INHERITABLE_FIELDS: readonly string[] = ['repository', 'bugs', 'homepage', 'author']

export const DEFAULT_PROJECT_ASSETS: readonly string[] = ['README.md', 'CHANGELOG.md']

export const DEFAULT_WORKSPACE_ASSETS: readonly string[] = ['LICENSE.md', 'SECURITY.md']

export const FUNDING_ASSET = 'FUNDING.md'

/** Directory, relative to the workspace root, that holds the committed media assets. */
export const MEDIA_ROOT = 'assets/media'

/** The URL that serves the media directory. */
export const MEDIA_PUBLIC_BASE_URL = 'https://www.hyperfrontend.dev/media/'

/** The URL under which each library's documentation lives. */
export const DOCS_BASE_URL = 'https://www.hyperfrontend.dev/docs/libraries/'

export const MEMORY_THRESHOLDS: MemoryMonitorOptions = {
  warningMB: 512,
  criticalMB: 768,
  growthMB: 50,
}
