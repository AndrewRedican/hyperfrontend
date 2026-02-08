/**
 * Unified library build utilities for the build executor.
 * Uses Rollup to build TypeScript libraries with multiple entry points.
 */
import { logger } from '@nx/devkit'
import { existsSync, mkdirSync, cpSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, relative } from 'node:path'
import { rollup, type RollupOptions, type OutputOptions, type RollupLog } from 'rollup'

import nodeResolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from '@rollup/plugin-typescript'
import json from '@rollup/plugin-json'
import terser from '@rollup/plugin-terser'
import type { EntryPoint, EntryPointDiscovery } from './types'
import { readProjectPackageJson, generatePackageJsonFromDiscovery } from './package-json'

/**
 * Creates Rollup configuration for a single entry point.
 *
 * @param inputFile - Absolute path to the entry file
 * @param tsConfigPath - Absolute path to the tsconfig file
 * @param outputPath - Absolute path to the entry output directory
 * @param projectRoot - Absolute path to the project root
 * @param external - External dependencies to exclude from bundle
 * @param isRootEntry - Whether this is the root entry point
 * @returns Rollup configuration
 */
export function createEntryPointRollupConfig(
  inputFile: string,
  tsConfigPath: string,
  outputPath: string,
  projectRoot: string,
  external: string[],
  isRootEntry: boolean
): RollupOptions {
  const isExternal = (id: string): boolean => {
    if (external.includes(id)) return true
    if (id.startsWith('@hyperfrontend/')) return true
    return false
  }

  return {
    input: inputFile,
    external: isExternal,

    onwarn(warning: RollupLog, defaultHandler: (warning: RollupLog) => void) {
      if (warning.plugin === 'typescript' && warning.message?.includes('TS2307')) return
      if (warning.code === 'EMPTY_BUNDLE') return
      defaultHandler(warning)
    },

    plugins: [
      json(),
      nodeResolve({
        extensions: ['.ts', '.js'],
        resolveOnly: [/^(?!@hyperfrontend\/)/],
      }),
      commonjs(),
      typescript({
        tsconfig: tsConfigPath,
        declaration: isRootEntry,
        declarationMap: isRootEntry,
        declarationDir: isRootEntry ? outputPath : undefined,
        rootDir: join(projectRoot, 'src'),
        outDir: outputPath,
        sourceMap: true,
        compilerOptions: {
          paths: {},
          baseUrl: projectRoot,
        },
      }),
    ],
  }
}

/**
 * Creates output configurations for ESM and CJS formats.
 *
 * @param outputPath - Absolute path to the output directory
 * @param entryName - Name for the output files (default: 'index')
 * @returns Array of Rollup output configurations
 */
export function createOutputConfigs(outputPath: string, entryName = 'index'): OutputOptions[] {
  return [
    { file: join(outputPath, `${entryName}.esm.js`), format: 'esm', sourcemap: true },
    { file: join(outputPath, `${entryName}.cjs.js`), format: 'cjs', sourcemap: true },
  ]
}

/**
 * Creates Rollup configuration for a self-contained UMD/IIFE bundle.
 *
 * @param inputFile - Absolute path to the root entry file
 * @param tsConfigPath - Absolute path to the tsconfig file
 * @param projectRoot - Absolute path to the project root
 * @param globalName - Global variable name (e.g., 'HyperfrontendNexus')
 * @param workspaceRoot - Absolute path to workspace root
 * @param bundlePath - Absolute path to bundle output directory
 * @returns Rollup configuration for bundled build
 */
function createBundleRollupConfig(
  inputFile: string,
  tsConfigPath: string,
  projectRoot: string,
  globalName: string,
  workspaceRoot: string,
  bundlePath: string
): RollupOptions {
  return {
    input: inputFile,
    external: [],

    onwarn(warning: RollupLog, defaultHandler: (warning: RollupLog) => void) {
      if (warning.plugin === 'typescript' && warning.message?.includes('TS2307')) return
      if (warning.code === 'EMPTY_BUNDLE') return
      if (warning.code === 'UNRESOLVED_IMPORT' && warning.exporter?.startsWith('@hyperfrontend/')) return
      defaultHandler(warning)
    },

    plugins: [
      json(),
      nodeResolve({
        extensions: ['.ts', '.js'],
        browser: true,
        preferBuiltins: false,
      }),
      commonjs(),
      typescript({
        tsconfig: tsConfigPath,
        declaration: false,
        declarationMap: false,
        sourceMap: true,
        compilerOptions: {
          baseUrl: workspaceRoot,
          outDir: bundlePath,
        },
      }),
    ],
  }
}

/**
 * Creates output configurations for bundled UMD and IIFE formats.
 *
 * @param bundlePath - Output directory for bundles
 * @param globalName - Global variable name
 * @returns Array of Rollup output configurations
 */
function createBundleOutputConfigs(bundlePath: string, globalName: string): OutputOptions[] {
  return [
    { file: join(bundlePath, 'index.umd.js'), format: 'umd', name: globalName, sourcemap: true },
    { file: join(bundlePath, 'index.umd.min.js'), format: 'umd', name: globalName, sourcemap: true, plugins: [terser()] },
    { file: join(bundlePath, 'index.iife.js'), format: 'iife', name: globalName, sourcemap: true },
    { file: join(bundlePath, 'index.iife.min.js'), format: 'iife', name: globalName, sourcemap: true, plugins: [terser()] },
  ]
}

/**
 * Builds self-contained UMD and IIFE bundles for CDN distribution.
 *
 * @param projectRoot - Absolute path to project root
 * @param outputPath - Base output path for the library
 * @param tsConfigPath - Absolute path to tsconfig file
 * @param globalName - Global variable name for UMD/IIFE
 * @param workspaceRoot - Absolute path to workspace root
 * @param discovery - Entry point discovery result
 */
export async function buildBundledOutput(
  projectRoot: string,
  outputPath: string,
  tsConfigPath: string,
  globalName: string,
  workspaceRoot: string,
  discovery: EntryPointDiscovery
): Promise<void> {
  logger.info('Building CDN bundles (UMD + IIFE)...')

  const rootEntry = discovery.entryPoints.find((e) => e.isRoot)
  if (!rootEntry) {
    throw new Error('Bundle build requires a root entry point (src/index.ts)')
  }

  const bundlePath = join(outputPath, 'bundle')
  mkdirSync(bundlePath, { recursive: true })

  const rollupConfig = createBundleRollupConfig(
    rootEntry.inputFile,
    tsConfigPath,
    projectRoot,
    globalName,
    workspaceRoot,
    bundlePath
  )
  const outputConfigs = createBundleOutputConfigs(bundlePath, globalName)

  const bundle = await rollup(rollupConfig)

  try {
    for (const output of outputConfigs) {
      await bundle.write(output)
      const filename = (output.file as string).split('/').pop()
      logger.info(`  Built: bundle/${filename}`)
    }
  } finally {
    await bundle.close()
  }

  logger.info('CDN bundles complete')
}

/**
 * Builds a single entry point.
 *
 * @param entry - Entry point to build
 * @param outputBasePath - Base output path for the library
 * @param tsConfigPath - Absolute path to tsconfig file
 * @param projectRoot - Absolute path to project root
 * @param external - External dependencies to exclude from bundle
 */
async function buildSingleEntryPoint(
  entry: EntryPoint,
  outputBasePath: string,
  tsConfigPath: string,
  projectRoot: string,
  external: string[]
): Promise<void> {
  const entryOutputPath = entry.srcPath ? join(outputBasePath, entry.srcPath) : outputBasePath

  mkdirSync(entryOutputPath, { recursive: true })

  const rollupConfig = createEntryPointRollupConfig(
    entry.inputFile,
    tsConfigPath,
    entryOutputPath,
    projectRoot,
    external,
    entry.isRoot
  )
  const outputConfigs = createOutputConfigs(entryOutputPath)

  const bundle = await rollup(rollupConfig)

  try {
    for (const output of outputConfigs) {
      await bundle.write(output)
    }
  } finally {
    await bundle.close()
  }

  logger.info(`  Built entry: ${entry.exportPath}`)
}

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
export function generateDeclarationsUnified(
  projectRoot: string,
  outputPath: string,
  tsConfigPath: string,
  workspaceRoot: string,
  discovery: EntryPointDiscovery
): void {
  if (discovery.category === 'root') return

  logger.info('Generating TypeScript declarations...')

  execFileSync(
    'npx',
    ['tsc', '--project', tsConfigPath, '--emitDeclarationOnly', '--declaration', '--declarationMap', '--outDir', outputPath],
    { stdio: 'inherit', cwd: projectRoot }
  )

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
function flattenDeclarationPaths(
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

/**
 * Builds a library with any entry point configuration.
 *
 * @param projectRoot - Absolute path to the project root
 * @param outputPath - Absolute path to output directory
 * @param tsConfigPath - Absolute path to tsconfig file
 * @param external - External dependencies to exclude from bundle
 * @param workspaceRoot - Absolute path to workspace root
 * @param discovery - Entry point discovery result
 * @param includeBundle - Whether CDN bundle fields should be added to package.json
 */
export async function buildUnifiedLibrary(
  projectRoot: string,
  outputPath: string,
  tsConfigPath: string,
  external: string[],
  workspaceRoot: string,
  discovery: EntryPointDiscovery,
  includeBundle = false
): Promise<void> {
  logger.info(`Building library (${discovery.category} structure, ${discovery.entryPoints.length} entry points)...`)

  for (const entry of discovery.entryPoints) {
    await buildSingleEntryPoint(entry, outputPath, tsConfigPath, projectRoot, external)
  }

  generateDeclarationsUnified(projectRoot, outputPath, tsConfigPath, workspaceRoot, discovery)

  const srcPkg = readProjectPackageJson(projectRoot)
  generatePackageJsonFromDiscovery(srcPkg, outputPath, discovery, includeBundle)

  logger.info('Library build complete')
}
