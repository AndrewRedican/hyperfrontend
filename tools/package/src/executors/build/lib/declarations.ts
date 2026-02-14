import { logger } from '@nx/devkit'
import { existsSync, mkdirSync, cpSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, relative, resolve } from 'node:path'
import type { EntryPointDiscovery } from './types'

/**
 * Generates TypeScript declarations for all entry points.
 * Uses a separate tsc call to ensure consistent declaration paths across all entries.
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
  if (discovery.category === 'root') return

  logger.info('Generating TypeScript declarations...')

  const tscPath = resolve(workspaceRoot, 'node_modules', '.bin', 'tsc')

  try {
    execFileSync(
      tscPath,
      ['--project', tsConfigPath, '--emitDeclarationOnly', '--declaration', '--declarationMap', '--outDir', outputPath],
      { cwd: projectRoot, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    )
  } catch (error) {
    const err = <Error & { stdout?: string; stderr?: string }>error
    if (err.stderr) logger.error(err.stderr)
    if (err.stdout) logger.error(err.stdout)
    throw error
  }

  flattenDeclarationPaths(projectRoot, outputPath, workspaceRoot, discovery)
}

/**
 * Flattens declaration paths from nested tsc output structure to flat output.
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

  if (!existsSync(nestedDeclarations)) return

  for (const entry of discovery.entryPoints) {
    if (entry.isRoot) continue

    const srcDir = entry.srcPath
    const declSrc = join(nestedDeclarations, srcDir)
    const declDest = join(outputPath, srcDir)

    if (existsSync(declSrc)) {
      mkdirSync(dirname(declDest), { recursive: true })
      cpSync(declSrc, declDest, { recursive: true, force: true })
    }
  }

  cleanupNestedDeclarations(projectRoot, outputPath, workspaceRoot)
}

/**
 * Removes the top-level nested folder created by tsc.
 *
 * @param projectRoot - Absolute path to the project root
 * @param outputPath - Absolute path to output directory
 * @param workspaceRoot - Absolute path to workspace root
 */
function cleanupNestedDeclarations(projectRoot: string, outputPath: string, workspaceRoot: string): void {
  const parts = relative(workspaceRoot, projectRoot).split('/')
  const topLevel = parts[0]

  if (topLevel) {
    const topLevelNested = join(outputPath, topLevel)
    if (existsSync(topLevelNested)) {
      rmSync(topLevelNested, { recursive: true, force: true })
    }
  }
}
