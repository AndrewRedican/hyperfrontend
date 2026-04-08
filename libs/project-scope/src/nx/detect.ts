import { join } from 'node:path'
import { exists, readJsonFileIfExists } from '../core/fs'
import { createScopedLogger } from '../core/logger'
import { readPackageJsonIfExists } from '../project/package'
import { findRootDirectory } from '../project/root'

const nxLogger = createScopedLogger('project-scope:nx')

/**
 * Files indicating NX workspace root.
 */
export const NX_CONFIG_FILES = <const>['nx.json', 'workspace.json']

/**
 * NX-specific project file.
 */
export const NX_PROJECT_FILE = 'project.json'

/**
 * NX workspace layout configuration.
 */
export interface NxWorkspaceLayout {
  /** Applications directory (default: 'apps') */
  appsDir: string
  /** Libraries directory (default: 'libs') */
  libsDir: string
}

/**
 * nx.json configuration structure.
 */
export interface NxJson {
  /** Default project */
  defaultProject?: string
  /** Workspace layout */
  workspaceLayout?: Partial<NxWorkspaceLayout>
  /** Named inputs for caching */
  namedInputs?: Record<string, unknown>
  /** Target defaults */
  targetDefaults?: Record<string, unknown>
  /** NX Cloud access token */
  nxCloudAccessToken?: string
  /** Plugins configuration */
  plugins?: unknown[]
  /** Task runner options */
  tasksRunnerOptions?: Record<string, unknown>
  /** Default base */
  defaultBase?: string
  /** Additional properties */
  [key: string]: unknown
}

/**
 * NX workspace information.
 */
export interface NxWorkspaceInfo {
  /** Workspace root path */
  root: string
  /** NX version from package.json */
  version: string | null
  /** Parsed nx.json */
  nxJson: NxJson
  /** Whether this is an integrated repo (vs standalone) */
  isIntegrated: boolean
  /** Default project name */
  defaultProject?: string
  /** Workspace layout configuration */
  workspaceLayout: NxWorkspaceLayout
}

/**
 * Check if directory is an NX workspace root.
 *
 * @param path - Directory path to check
 * @returns True if the directory contains nx.json or workspace.json
 *
 * @example
 * ```typescript
 * import { isNxWorkspace } from '@hyperfrontend/project-scope'
 *
 * if (isNxWorkspace('./my-project')) {
 *   console.log('This is an NX monorepo')
 * }
 * ```
 */
export function isNxWorkspace(path: string): boolean {
  for (const configFile of NX_CONFIG_FILES) {
    if (exists(join(path, configFile))) {
      nxLogger.debug('NX workspace detected', { path, configFile })
      return true
    }
  }
  nxLogger.debug('Not an NX workspace', { path })
  return false
}

/**
 * Check if directory is an NX project.
 *
 * @param path - Directory path to check
 * @returns True if the directory contains project.json
 *
 * @example
 * ```typescript
 * import { isNxProject } from '@hyperfrontend/project-scope'
 *
 * if (isNxProject('./libs/my-lib')) {
 *   console.log('This is an NX project')
 * }
 * ```
 */
export function isNxProject(path: string): boolean {
  const isProject = exists(join(path, NX_PROJECT_FILE))
  nxLogger.debug('NX project check', { path, isProject })
  return isProject
}

/**
 * Find NX workspace root from any path.
 *
 * @param startPath - Starting path to search from
 * @returns Workspace root path or null if not found
 *
 * @example
 * ```typescript
 * import { findNxWorkspaceRoot } from '@hyperfrontend/project-scope'
 *
 * const root = findNxWorkspaceRoot('./libs/my-lib/src')
 * if (root) {
 *   console.log('Workspace root:', root) // e.g., '/home/user/my-monorepo'
 * }
 * ```
 */
export function findNxWorkspaceRoot(startPath: string): string | null {
  nxLogger.debug('Finding NX workspace root', { startPath })
  const result = findRootDirectory(startPath, NX_CONFIG_FILES)
  if (result) {
    nxLogger.debug('Found NX workspace root', { startPath, root: result })
  } else {
    nxLogger.debug('NX workspace root not found', { startPath })
  }
  return result
}

/**
 * Detect NX version from package.json dependencies.
 *
 * @param workspacePath - Workspace root path
 * @returns NX version string (without semver range) or null
 */
function detectNxVersion(workspacePath: string): string | null {
  const packageJson = readPackageJsonIfExists(workspacePath)

  if (packageJson) {
    const nxVersion = packageJson.devDependencies?.['nx'] ?? packageJson.dependencies?.['nx']

    if (nxVersion) {
      return nxVersion.replace(/^[\^~>=<]+/, '')
    }
  }

  return null
}

/**
 * Check if workspace is integrated (not standalone).
 * Integrated repos typically have workspaceLayout, namedInputs, or targetDefaults.
 *
 * @param nxJson - Parsed nx.json configuration
 * @returns True if the workspace is integrated
 */
function isIntegratedRepo(nxJson: NxJson): boolean {
  return nxJson.workspaceLayout !== undefined || nxJson.namedInputs !== undefined || nxJson.targetDefaults !== undefined
}

/**
 * Get comprehensive NX workspace information.
 *
 * @param workspacePath - Workspace root path
 * @returns Workspace info or null if not an NX workspace
 *
 * @example
 * ```typescript
 * import { getNxWorkspaceInfo } from '@hyperfrontend/project-scope'
 *
 * const info = getNxWorkspaceInfo('/path/to/monorepo')
 * if (info) {
 *   console.log('NX version:', info.version)
 *   console.log('Apps dir:', info.workspaceLayout.appsDir)
 * }
 * ```
 */
export function getNxWorkspaceInfo(workspacePath: string): NxWorkspaceInfo | null {
  nxLogger.debug('Getting NX workspace info', { workspacePath })

  if (!isNxWorkspace(workspacePath)) {
    return null
  }

  const nxJson = readJsonFileIfExists<NxJson>(join(workspacePath, 'nx.json'))

  if (!nxJson) {
    const workspaceJson = readJsonFileIfExists<Record<string, unknown>>(join(workspacePath, 'workspace.json'))
    if (!workspaceJson) {
      nxLogger.debug('No nx.json or workspace.json found', { workspacePath })
      return null
    }

    nxLogger.debug('Using legacy workspace.json', { workspacePath })
    return {
      root: workspacePath,
      version: detectNxVersion(workspacePath),
      nxJson: {},
      isIntegrated: true,
      workspaceLayout: {
        appsDir: 'apps',
        libsDir: 'libs',
      },
    }
  }

  const info = {
    root: workspacePath,
    version: detectNxVersion(workspacePath),
    nxJson,
    isIntegrated: isIntegratedRepo(nxJson),
    defaultProject: nxJson.defaultProject,
    workspaceLayout: {
      appsDir: nxJson.workspaceLayout?.appsDir ?? 'apps',
      libsDir: nxJson.workspaceLayout?.libsDir ?? 'libs',
    },
  }

  nxLogger.debug('NX workspace info retrieved', {
    workspacePath,
    version: info.version,
    isIntegrated: info.isIntegrated,
    defaultProject: info.defaultProject,
  })

  return info
}
