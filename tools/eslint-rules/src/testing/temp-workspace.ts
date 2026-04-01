import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createRuleLogger } from '../utils/logger'

const logger = createRuleLogger('testing:temp-workspace')

/**
 * Configuration for creating a temporary workspace.
 */
export interface TempWorkspaceConfig {
  /**
   * Content for project.json (Nx project configuration).
   * Will be serialized to JSON.
   */
  projectJson?: object

  /**
   * Content for package.json.
   * Will be serialized to JSON.
   */
  packageJson?: object

  /**
   * Content for README.md.
   */
  readme?: string

  /**
   * Content for tsconfig.json.
   * Will be serialized to JSON.
   */
  tsconfigJson?: object

  /**
   * Additional files to create.
   * Keys are relative paths, values are file contents.
   *
   * @example
   * ```typescript
   * files: {
   *   'src/index.ts': 'export const foo = 1',
   *   'src/utils/helper.ts': 'export function helper() {}'
   * }
   * ```
   */
  files?: Record<string, string>

  /**
   * Additional directories to create (without files).
   * Directories specified in `files` are created automatically.
   */
  directories?: string[]

  /**
   * Prefix for the temporary directory name.
   *
   * @default 'eslint-test-'
   */
  prefix?: string
}

/**
 * Represents a temporary workspace for testing.
 */
export interface TempWorkspace {
  /**
   * Absolute path to the root of the temporary workspace.
   */
  readonly root: string

  /**
   * Returns the absolute path to a file within the workspace.
   *
   * @param relativePath - Path relative to workspace root
   * @returns Absolute path
   *
   * @example
   * ```typescript
   * workspace.getPath('src/index.ts')
   * // => '/tmp/eslint-test-abc123/src/index.ts'
   * ```
   */
  getPath(relativePath: string): string

  /**
   * Writes a file to the workspace.
   * Creates parent directories as needed.
   *
   * @param relativePath - Path relative to workspace root
   * @param content - File content
   */
  writeFile(relativePath: string, content: string): void

  /**
   * Writes a JSON file to the workspace.
   * Creates parent directories as needed.
   *
   * @param relativePath - Path relative to workspace root
   * @param content - Object to serialize as JSON
   */
  writeJsonFile(relativePath: string, content: object): void

  /**
   * Creates a directory in the workspace.
   * Creates parent directories as needed.
   *
   * @param relativePath - Path relative to workspace root
   */
  createDirectory(relativePath: string): void

  /**
   * Removes the workspace and all its contents.
   * Safe to call multiple times.
   */
  cleanup(): void
}

/**
 * Manages multiple temporary workspaces for a test suite.
 * Ensures all workspaces are cleaned up in afterAll.
 */
export interface TempWorkspaceManager {
  /**
   * Creates a new temporary workspace.
   * The workspace is automatically tracked for cleanup.
   */
  create(config?: TempWorkspaceConfig): TempWorkspace

  /**
   * Removes all tracked workspaces.
   * Call this in afterAll().
   */
  cleanupAll(): void

  /**
   * Number of workspaces currently tracked.
   */
  readonly count: number
}

/**
 * Creates a temporary workspace for testing ESLint rules.
 *
 * @param config - Workspace configuration
 * @returns A TempWorkspace instance
 *
 * @example
 * ```typescript
 * const workspace = createTempWorkspace({
 *   projectJson: { projectType: 'library', targets: { build: {}, publish: {} } },
 *   packageJson: { name: '@test/lib', version: '1.0.0' },
 *   files: {
 *     'src/index.ts': 'export const foo = 1'
 *   }
 * })
 *
 * // Use in test
 * const filePath = workspace.getPath('package.json')
 *
 * // Cleanup
 * workspace.cleanup()
 * ```
 */
export function createTempWorkspace(config: TempWorkspaceConfig = {}): TempWorkspace {
  const prefix = config.prefix ?? 'eslint-test-'
  const root = mkdtempSync(join(tmpdir(), prefix))

  logger.debug(`Created temp workspace: ${root}`)

  const writeFile = (relativePath: string, content: string): void => {
    const fullPath = join(root, relativePath)
    const dirPath = join(root, relativePath.split('/').slice(0, -1).join('/'))

    if (dirPath !== root) {
      mkdirSync(dirPath, { recursive: true, mode: 0o700 })
    }

    writeFileSync(fullPath, content, { mode: 0o600 })
    logger.debug(`Wrote file: ${relativePath}`)
  }

  const writeJsonFile = (relativePath: string, content: object): void => {
    writeFile(relativePath, stringify(content, null, 2))
  }

  const createDirectory = (relativePath: string): void => {
    mkdirSync(join(root, relativePath), { recursive: true, mode: 0o700 })
    logger.debug(`Created directory: ${relativePath}`)
  }

  mkdirSync(join(root, 'src'), { recursive: true, mode: 0o700 })

  if (config.projectJson) {
    writeJsonFile('project.json', config.projectJson)
  }

  if (config.packageJson) {
    writeJsonFile('package.json', config.packageJson)
  }

  if (config.readme) {
    writeFile('README.md', config.readme)
  }

  if (config.tsconfigJson) {
    writeJsonFile('tsconfig.json', config.tsconfigJson)
  }

  if (config.directories) {
    for (const dir of config.directories) {
      createDirectory(dir)
    }
  }

  if (config.files) {
    for (const [relativePath, content] of entries(config.files)) {
      writeFile(relativePath, content)
    }
  }

  let cleanedUp = false

  return {
    root,

    getPath(relativePath: string): string {
      return join(root, relativePath)
    },

    writeFile,

    writeJsonFile,

    createDirectory,

    cleanup(): void {
      if (cleanedUp) return
      cleanedUp = true

      try {
        rmSync(root, { recursive: true, force: true })
        logger.debug(`Cleaned up workspace: ${root}`)
      } catch (error) {
        logger.warn(`Failed to cleanup workspace ${root}: ${error}`)
      }
    },
  }
}

/**
 * Creates a manager for multiple temporary workspaces.
 * Use this in test files to track all workspaces and clean them up in afterAll.
 *
 * @returns A TempWorkspaceManager instance
 *
 * @example
 * ```typescript
 * const manager = createTempWorkspaceManager()
 *
 * afterAll(() => {
 *   manager.cleanupAll()
 * })
 *
 * it('should validate package.json', () => {
 *   const workspace = manager.create({
 *     packageJson: { name: '@test/lib' }
 *   })
 *   // workspace is automatically tracked for cleanup
 * })
 * ```
 */
export function createTempWorkspaceManager(): TempWorkspaceManager {
  const workspaces: TempWorkspace[] = []

  return {
    create(config?: TempWorkspaceConfig): TempWorkspace {
      const workspace = createTempWorkspace(config)
      workspaces.push(workspace)
      return workspace
    },

    cleanupAll(): void {
      for (const workspace of workspaces) {
        workspace.cleanup()
      }
      workspaces.length = 0
      logger.debug('Cleaned up all workspaces')
    },

    get count(): number {
      return workspaces.length
    },
  }
}
