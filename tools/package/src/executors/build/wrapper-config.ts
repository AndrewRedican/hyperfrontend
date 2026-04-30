import type { MemoryMonitorOptions } from '@hyperfrontend/builder/models'

export const WORKSPACE_SCOPE = '@hyperfrontend/'

export const INHERITABLE_FIELDS: readonly string[] = ['repository', 'bugs', 'homepage', 'author']

export const DEFAULT_PROJECT_ASSETS: readonly string[] = ['README.md', 'CHANGELOG.md', 'ARCHITECTURE.md']

export const DEFAULT_WORKSPACE_ASSETS: readonly string[] = ['LICENSE.md', 'SECURITY.md']

export const FUNDING_ASSET = 'FUNDING.md'

export const MEMORY_THRESHOLDS: MemoryMonitorOptions = {
  warningMB: 512,
  criticalMB: 768,
  growthMB: 50,
}
