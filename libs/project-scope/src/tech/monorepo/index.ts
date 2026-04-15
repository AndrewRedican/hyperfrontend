/**
 * Monorepo tool detection for Nx, Turborepo, Lerna, Rush, and pnpm/npm/yarn workspaces.
 *
 * @module @hyperfrontend/project-scope/tech/monorepo
 */
export type { DetectionSource, MonorepoDetection, MonorepoDetector } from './types'
export { detectMonorepoTools, monorepoDetectors } from './detect-all'
export { lernaDetector } from './lerna'
export { npmWorkspacesDetector } from './npm-workspaces'
export { nxDetector } from './nx'
export { pnpmWorkspacesDetector } from './pnpm-workspaces'
export { rushDetector } from './rush'
export { turborepoDetector } from './turborepo'
export { yarnWorkspacesDetector } from './yarn-workspaces'
