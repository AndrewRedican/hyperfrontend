/**
 * Isomorphic library build utilities for the build executor.
 *
 * Builds libraries with browser/ and node/ entry points.
 */
import { logger } from '@nx/devkit'
import { existsSync, mkdirSync, cpSync, rmSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join, relative } from 'node:path'
import { rollup, type RollupOptions, type OutputOptions } from 'rollup'
import nodeResolve from '@rollup/plugin-node-resolve'
import { babel } from '@rollup/plugin-babel'
import { generateIsomorphicPackageJson, readProjectPackageJson } from './package-json'
import { getIsomorphicEntryPoints } from './detect'

/** Isomorphic entry point names */
type IsomorphicEntry = 'browser' | 'node'

/**
 * Creates Rollup configuration for an isomorphic entry point.
 *
 * @param inputFile - Absolute path to the entry file
 * @param external - External dependencies to exclude from bundle
 * @returns Rollup configuration
 */
export function createIsomorphicRollupConfig(
  inputFile: string,
  external: string[]
): RollupOptions {
  return {
    input: inputFile,
    external,
    plugins: [
      nodeResolve({ extensions: ['.ts', '.js'] }),
      babel({
        babelHelpers: 'bundled',
        extensions: ['.ts', '.js'],
        presets: ['@babel/preset-typescript'],
      }),
    ],
  }
}

/**
 * Creates output configurations for an isomorphic entry point.
 *
 * @param entryOutputPath - Absolute path to the entry output directory
 * @returns Array of Rollup output configurations
 */
export function createIsomorphicOutputConfigs(entryOutputPath: string): OutputOptions[] {
  return [
    {
      file: join(entryOutputPath, 'index.esm.js'),
      format: 'esm',
      sourcemap: true,
    },
    {
      file: join(entryOutputPath, 'index.cjs.js'),
      format: 'cjs',
      sourcemap: true,
    },
  ]
}

/**
 * Builds a single isomorphic entry point.
 *
 * @param projectRoot - Absolute path to the project root
 * @param outputPath - Absolute path to output directory
 * @param entry - Entry point name ('browser' or 'node')
 * @param external - External dependencies to exclude from bundle
 */
async function buildEntryPoint(
  projectRoot: string,
  outputPath: string,
  entry: IsomorphicEntry,
  external: string[]
): Promise<void> {
  const inputFile = join(projectRoot, 'src', entry, 'index.ts')
  const entryOutputPath = join(outputPath, entry)

  mkdirSync(entryOutputPath, { recursive: true })

  const rollupConfig = createIsomorphicRollupConfig(inputFile, external)
  const outputConfigs = createIsomorphicOutputConfigs(entryOutputPath)

  const bundle = await rollup(rollupConfig)

  try {
    for (const output of outputConfigs) {
      await bundle.write(output)
    }
  } finally {
    await bundle.close()
  }

  logger.info(`Built ${entry} entry point`)
}

/**
 * Generates TypeScript declarations for isomorphic library.
 *
 * @param projectRoot - Absolute path to the project root
 * @param outputPath - Absolute path to output directory
 * @param tsConfigPath - Absolute path to tsconfig file
 * @param workspaceRoot - Absolute path to workspace root
 */
export function generateDeclarations(
  projectRoot: string,
  outputPath: string,
  tsConfigPath: string,
  workspaceRoot: string
): void {
  logger.info('Generating TypeScript declarations...')

  execSync(
    `npx tsc --project ${tsConfigPath} --emitDeclarationOnly --declaration --declarationMap --outDir ${outputPath}`,
    {
      stdio: 'inherit',
      cwd: projectRoot,
    }
  )

  flattenDeclarationPaths(projectRoot, outputPath, workspaceRoot)
}

/**
 * Flattens declaration paths from nested structure to flat output.
 *
 * TypeScript outputs nested structure due to rootDir, so we flatten it.
 *
 * @param projectRoot - Absolute path to the project root
 * @param outputPath - Absolute path to output directory
 * @param workspaceRoot - Absolute path to workspace root
 */
function flattenDeclarationPaths(
  projectRoot: string,
  outputPath: string,
  workspaceRoot: string
): void {
  const nestedDeclarations = join(outputPath, relative(workspaceRoot, join(projectRoot, 'src')))

  if (!existsSync(nestedDeclarations)) {
    return
  }

  // Copy lib declarations (shared code)
  const libSrc = join(nestedDeclarations, 'lib')
  const libDest = join(outputPath, 'lib')
  if (existsSync(libSrc)) {
    cpSync(libSrc, libDest, { recursive: true, force: true })
  }

  // Copy browser declarations
  const browserSrc = join(nestedDeclarations, 'browser')
  const browserDest = join(outputPath, 'browser')
  if (existsSync(browserSrc)) {
    cpSync(browserSrc, browserDest, { recursive: true, force: true })
  }

  // Copy node declarations
  const nodeSrc = join(nestedDeclarations, 'node')
  const nodeDest = join(outputPath, 'node')
  if (existsSync(nodeSrc)) {
    cpSync(nodeSrc, nodeDest, { recursive: true, force: true })
  }

  // Clean up nested directory structure
  cleanupNestedDeclarations(projectRoot, outputPath, workspaceRoot)
}

/**
 * Removes the top-level nested folder created by tsc.
 *
 * @param projectRoot - Absolute path to the project root
 * @param outputPath - Absolute path to output directory
 * @param workspaceRoot - Absolute path to workspace root
 */
function cleanupNestedDeclarations(
  projectRoot: string,
  outputPath: string,
  workspaceRoot: string
): void {
  const parts = relative(workspaceRoot, projectRoot).split('/')
  const topLevel = parts[0]

  if (topLevel) {
    const topLevelNested = join(outputPath, topLevel)
    if (existsSync(topLevelNested)) {
      rmSync(topLevelNested, { recursive: true, force: true })
    }
  }
}

/**
 * Builds an isomorphic library (browser + node entry points).
 *
 * @param projectRoot - Absolute path to the project root
 * @param outputPath - Absolute path to output directory
 * @param tsConfigPath - Absolute path to tsconfig file
 * @param external - External dependencies to exclude from bundle
 * @param workspaceRoot - Absolute path to workspace root
 */
export async function buildIsomorphicLibrary(
  projectRoot: string,
  outputPath: string,
  tsConfigPath: string,
  external: string[],
  workspaceRoot: string
): Promise<void> {
  logger.info('Building isomorphic library...')

  const entryPoints = getIsomorphicEntryPoints()

  // Build each entry point
  for (const entry of entryPoints) {
    await buildEntryPoint(projectRoot, outputPath, entry, external)
  }

  // Generate TypeScript declarations
  generateDeclarations(projectRoot, outputPath, tsConfigPath, workspaceRoot)

  // Generate package.json
  const srcPkg = readProjectPackageJson(projectRoot)
  generateIsomorphicPackageJson(srcPkg, outputPath)

  logger.info('Isomorphic library build complete')
}

/**
 * Gets the entry file path for an isomorphic entry point.
 *
 * @param projectRoot - Absolute path to the project root
 * @param entry - Entry point name ('browser' or 'node')
 * @returns Absolute path to the entry file
 */
export function getIsomorphicEntryFile(projectRoot: string, entry: IsomorphicEntry): string {
  return join(projectRoot, 'src', entry, 'index.ts')
}
