import type { EntryPointDiscovery } from './types'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, cpSync, rmSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { logger } from '@nx/devkit'
import {createError} from '@hyperfrontend/immutable-api-utils/built-in-copy/error'

/**
 * Generates TypeScript declarations for all entry points.
 * Uses a separate tsc call to ensure consistent declaration paths across all entries.
 *
 * For all category types (root, hybrid, platform, feature, complex), this function:
 * 1. Runs tsc to generate declarations
 * 2. Flattens the output structure to match the expected package layout
 * 3. Cleans up intermediate nested folders
 *
 * @param projectRoot - Absolute path to the project root
 * @param outputPath - Absolute path to output directory
 * @param tsConfigPath - Absolute path to tsconfig file
 * @param workspaceRoot - Absolute path to workspace root
 * @param discovery - Entry point discovery result
 */
export function generateDeclarations(
  projectRoot: string,
  outputPath: string,
  tsConfigPath: string,
  workspaceRoot: string,
  discovery: EntryPointDiscovery
): void {
  logger.info('Generating TypeScript declarations...')

  const tscPath = resolve(workspaceRoot, 'node_modules', '.bin', 'tsc')

  const args = [
    '--project',
    tsConfigPath,
    '--noEmit',
    'false',
    '--emitDeclarationOnly',
    '--declaration',
    '--declarationMap',
    '--outDir',
    outputPath,
  ]

  const result = spawnSync(tscPath, args, {
    cwd: projectRoot,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  if (result.error) {
    logger.error(`  [DEBUG] tsc spawn error: ${result.error.message}`)
    throw result.error
  }

  if (result.status !== 0) {
    throw createError(`tsc failed with exit code ${result.status}`)
  }

  flattenDeclarationPaths(projectRoot, outputPath, workspaceRoot, discovery)
}

/**
 * Flattens declaration paths from nested tsc output structure to flat output.
 *
 * When tsc compiles with baseUrl set to workspace root, it outputs declarations
 * preserving the full workspace-relative path structure:
 *   dist/libs/logging/libs/logging/src/index.d.ts
 *
 * This function flattens that to the expected package structure:
 *   dist/libs/logging/index.d.ts
 *
 * For isomorphic packages with platform-specific entries (browser, node), the
 * subdirectory structure is preserved:
 *   dist/libs/network-protocol/browser/channel/index.d.ts
 *   dist/libs/network-protocol/node/channel/index.d.ts
 *
 * @param projectRoot - Absolute path to the project root
 * @param outputPath - Absolute path to output directory
 * @param workspaceRoot - Absolute path to workspace root
 * @param discovery - Entry point discovery result
 */
export function flattenDeclarationPaths(
  projectRoot: string,
  outputPath: string,
  workspaceRoot: string,
  discovery: EntryPointDiscovery
): void {
  const nestedDeclarations = join(outputPath, relative(workspaceRoot, join(projectRoot, 'src')))

  if (!existsSync(nestedDeclarations)) {
    return
  }

  for (let i = 0; i < discovery.entryPoints.length; i++) {
    const entry = discovery.entryPoints[i]
    if (entry.isRoot) {
      copyRootDeclarations(nestedDeclarations, outputPath)
    } else {
      const srcDir = entry.srcPath
      const declSrc = join(nestedDeclarations, srcDir)
      const declDest = join(outputPath, srcDir)
      if (existsSync(declSrc)) {
        mkdirSync(dirname(declDest), { recursive: true })
        cpSync(declSrc, declDest, { recursive: true, force: true })
      }
    }
  }

  copyLibDeclarations(nestedDeclarations, outputPath)

  cleanupNestedDeclarations(outputPath)
}

/**
 * Copies root-level declaration files from nested src to package root.
 * Only copies .d.ts and .d.ts.map files directly in the src directory,
 * not subdirectories (which are handled as separate entry points).
 *
 * @param nestedSrc - Path to nested src declarations (e.g., dist/libs/logging/libs/logging/src)
 * @param outputPath - Package output root (e.g., dist/libs/logging)
 */
function copyRootDeclarations(nestedSrc: string, outputPath: string): void {
  if (!existsSync(nestedSrc)) {
    return
  }

  const entries = readdirSync(nestedSrc)

  for (const entry of entries) {
    const srcPath = join(nestedSrc, entry)
    const stat = statSync(srcPath)

    if (stat.isFile() && (entry.endsWith('.d.ts') || entry.endsWith('.d.ts.map'))) {
      const destPath = join(outputPath, entry)
      cpSync(srcPath, destPath, { force: true })
    }
  }
}

/**
 * Copies the lib/ folder declarations if it exists.
 * This is required for packages where entry points (browser/, node/, common/)
 * re-export from ../lib/* paths. Without these declarations, TypeScript
 * consumers cannot resolve types from the re-exported paths.
 *
 * Only copies .d.ts and .d.ts.map files to ensure no source files leak into dist.
 *
 * @param nestedSrc - Path to nested src declarations (e.g., dist/libs/cryptography/libs/cryptography/src)
 * @param outputPath - Package output root (e.g., dist/libs/cryptography)
 */
function copyLibDeclarations(nestedSrc: string, outputPath: string): void {
  const libSrc = join(nestedSrc, 'lib')
  const libDest = join(outputPath, 'lib')

  if (!existsSync(libSrc)) {
    return
  }

  cpSync(libSrc, libDest, {
    recursive: true,
    force: true,
    filter: (src) => {
      const stat = statSync(src)
      if (stat.isDirectory()) return true
      return src.endsWith('.d.ts') || src.endsWith('.d.ts.map')
    },
  })
}

/**
 * Removes nested workspace folders created by tsc output.
 * These are the top-level workspace directories (libs/, plugins/) that tsc creates
 * when compiling from baseUrl=workspaceRoot.
 *
 * This also removes declarations from bundled workspace dependencies, which is
 * intentional - bundled dependencies' types should come from their own packages,
 * not be duplicated in the consuming package.
 *
 * @param outputPath - Absolute path to output directory
 */
function cleanupNestedDeclarations(outputPath: string): void {
  const workspaceDirs = ['libs', 'plugins', 'apps']

  for (const dir of workspaceDirs) {
    const nestedPath = join(outputPath, dir)
    const exists = existsSync(nestedPath)
    if (exists) {
      rmSync(nestedPath, { recursive: true, force: true })
    }
  }
}
