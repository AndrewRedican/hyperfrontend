/**
 * Build executor for hyperfrontend library packages.
 *
 * Auto-detects library type (standard vs isomorphic) and applies
 * the appropriate build strategy using Rollup.
 */
import { type ExecutorContext, logger, workspaceRoot } from '@nx/devkit'
import { existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, cpSync, rmSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join, dirname, basename, relative } from 'node:path'
import { rollup, RollupOptions, OutputOptions } from 'rollup'
import nodeResolve from '@rollup/plugin-node-resolve'
import { babel } from '@rollup/plugin-babel'
import typescript from '@rollup/plugin-typescript'
import { glob } from 'glob'
import type { BuildExecutorOptions, AssetConfig } from './schema'

/** Library type detection result */
type LibraryType = 'standard' | 'isomorphic'

/**
 * Detects library type by analyzing the source structure.
 * Isomorphic libraries have both browser/ and node/ entry points.
 *
 * @param projectRoot - Absolute path to the project root
 * @returns The detected library type
 */
function detectLibraryType(projectRoot: string): LibraryType {
  const srcDir = join(projectRoot, 'src')
  const hasBrowserEntry = existsSync(join(srcDir, 'browser/index.ts'))
  const hasNodeEntry = existsSync(join(srcDir, 'node/index.ts'))

  if (hasBrowserEntry && hasNodeEntry) {
    return 'isomorphic'
  }
  return 'standard'
}

/**
 * Resolves the output path, substituting {projectRoot} placeholder.
 *
 * @param outputPath - Output path template
 * @param projectRoot - Absolute path to the project root
 * @returns Resolved absolute output path
 */
function resolveOutputPath(outputPath: string, projectRoot: string): string {
  const relativeProjectRoot = relative(workspaceRoot, projectRoot)
  return join(workspaceRoot, outputPath.replace('{projectRoot}', relativeProjectRoot))
}

/**
 * Resolves the tsconfig path, substituting {projectRoot} placeholder.
 *
 * @param tsConfig - TypeScript config path template
 * @param projectRoot - Absolute path to the project root
 * @returns Resolved absolute tsconfig path
 */
function resolveTsConfigPath(tsConfig: string, projectRoot: string): string {
  const relativeProjectRoot = relative(workspaceRoot, projectRoot)
  const resolved = tsConfig.replace('{projectRoot}', relativeProjectRoot)
  return join(workspaceRoot, resolved)
}

/**
 * Copies assets to the output directory.
 *
 * @param assets - Array of asset configurations
 * @param projectRoot - Absolute path to the project root
 * @param outputPath - Absolute path to output directory
 */
async function copyAssets(
  assets: (string | AssetConfig)[],
  projectRoot: string,
  outputPath: string
): Promise<void> {
  for (const asset of assets) {
    if (typeof asset === 'string') {
      // Simple string asset - copy from project root
      const srcPath = join(projectRoot, asset)
      if (existsSync(srcPath)) {
        const destPath = join(outputPath, basename(asset))
        copyFileSync(srcPath, destPath)
        logger.info(`Copied ${asset}`)
      }
    } else {
      // Complex asset config
      const inputDir = asset.input.startsWith('./')
        ? join(workspaceRoot, asset.input.slice(2))
        : join(workspaceRoot, asset.input)

      const pattern = join(inputDir, asset.glob)
      const files = await glob(pattern, { nodir: true })

      for (const file of files) {
        const relPath = relative(inputDir, file)
        const destPath = join(outputPath, asset.output, relPath)
        mkdirSync(dirname(destPath), { recursive: true })
        copyFileSync(file, destPath)
      }
    }
  }
}

/**
 * Copies default assets (README, LICENSE, SECURITY) to output.
 *
 * @param projectRoot - Absolute path to the project root
 * @param outputPath - Absolute path to output directory
 */
function copyDefaultAssets(projectRoot: string, outputPath: string): void {
  // Copy README from project
  const readmeSrc = join(projectRoot, 'README.md')
  if (existsSync(readmeSrc)) {
    copyFileSync(readmeSrc, join(outputPath, 'README.md'))
  }

  // Copy LICENSE from workspace root
  const licenseSrc = join(workspaceRoot, 'LICENSE.md')
  if (existsSync(licenseSrc)) {
    copyFileSync(licenseSrc, join(outputPath, 'LICENSE.md'))
  }

  // Copy SECURITY from workspace root
  const securitySrc = join(workspaceRoot, 'SECURITY.md')
  if (existsSync(securitySrc)) {
    copyFileSync(securitySrc, join(outputPath, 'SECURITY.md'))
  }
}

/**
 * Reads and parses the source package.json.
 *
 * @param projectRoot - Absolute path to the project root
 * @returns Parsed package.json contents
 */
function readPackageJson(projectRoot: string): Record<string, unknown> {
  const pkgPath = join(projectRoot, 'package.json')
  return JSON.parse(readFileSync(pkgPath, 'utf-8'))
}

/**
 * Generates package.json for standard library output.
 *
 * @param srcPkg - Source package.json contents
 * @param outputPath - Absolute path to output directory
 */
function generateStandardPackageJson(
  srcPkg: Record<string, unknown>,
  outputPath: string
): void {
  const distPkg = {
    ...srcPkg,
    main: './index.cjs.js',
    module: './index.esm.js',
    types: './index.d.ts',
    exports: {
      './package.json': './package.json',
      '.': {
        types: './index.d.ts',
        import: './index.esm.js',
        require: './index.cjs.js',
      },
    },
  }
  writeFileSync(join(outputPath, 'package.json'), JSON.stringify(distPkg, null, 2))
}

/**
 * Generates package.json for isomorphic library output.
 *
 * @param srcPkg - Source package.json contents
 * @param outputPath - Absolute path to output directory
 */
function generateIsomorphicPackageJson(
  srcPkg: Record<string, unknown>,
  outputPath: string
): void {
  // Remove main/module/types since there's no root export, then add exports
  const { main, module, types, ...rest } = srcPkg as Record<string, unknown> & {
    main?: unknown
    module?: unknown
    types?: unknown
  }
  const distPkg = {
    ...rest,
    exports: {
      './package.json': './package.json',
      './browser': {
        types: './browser/index.d.ts',
        import: './browser/index.esm.js',
        require: './browser/index.cjs.js',
      },
      './node': {
        types: './node/index.d.ts',
        import: './node/index.esm.js',
        require: './node/index.cjs.js',
      },
    },
  }
  // Suppress unused variable warnings
  void main
  void module
  void types
  writeFileSync(join(outputPath, 'package.json'), JSON.stringify(distPkg, null, 2))
}

/**
 * Builds a standard library (single entry point).
 *
 * @param projectRoot - Absolute path to the project root
 * @param outputPath - Absolute path to output directory
 * @param tsConfigPath - Absolute path to tsconfig file
 * @param external - External dependencies to exclude from bundle
 */
async function buildStandardLibrary(
  projectRoot: string,
  outputPath: string,
  tsConfigPath: string,
  external: string[]
): Promise<void> {
  logger.info('Building standard library...')

  const inputFile = join(projectRoot, 'src/index.ts')

  const rollupConfig: RollupOptions = {
    input: inputFile,
    external,
    plugins: [
      nodeResolve({ extensions: ['.ts', '.js'] }),
      typescript({
        tsconfig: tsConfigPath,
        declaration: true,
        declarationDir: outputPath,
        rootDir: join(projectRoot, 'src'),
        outDir: outputPath,
      }),
    ],
  }

  const outputConfigs: OutputOptions[] = [
    {
      file: join(outputPath, 'index.esm.js'),
      format: 'esm',
      sourcemap: true,
    },
    {
      file: join(outputPath, 'index.cjs.js'),
      format: 'cjs',
      sourcemap: true,
    },
  ]

  const bundle = await rollup(rollupConfig)

  for (const output of outputConfigs) {
    await bundle.write(output)
  }

  await bundle.close()

  // Generate package.json
  const srcPkg = readPackageJson(projectRoot)
  generateStandardPackageJson(srcPkg, outputPath)

  logger.info('Standard library build complete')
}

/**
 * Builds an isomorphic library (browser + node entry points).
 *
 * @param projectRoot - Absolute path to the project root
 * @param outputPath - Absolute path to output directory
 * @param tsConfigPath - Absolute path to tsconfig file
 * @param external - External dependencies to exclude from bundle
 */
async function buildIsomorphicLibrary(
  projectRoot: string,
  outputPath: string,
  tsConfigPath: string,
  external: string[]
): Promise<void> {
  logger.info('Building isomorphic library...')

  const entryPoints = ['browser', 'node']

  // Build each entry point with Babel
  for (const entry of entryPoints) {
    const inputFile = join(projectRoot, `src/${entry}/index.ts`)
    const entryOutputPath = join(outputPath, entry)

    mkdirSync(entryOutputPath, { recursive: true })

    const rollupConfig: RollupOptions = {
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

    const outputConfigs: OutputOptions[] = [
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

    const bundle = await rollup(rollupConfig)

    for (const output of outputConfigs) {
      await bundle.write(output)
    }

    await bundle.close()
    logger.info(`Built ${entry} entry point`)
  }

  // Generate TypeScript declarations using tsc
  logger.info('Generating TypeScript declarations...')
  execSync(
    `npx tsc --project ${tsConfigPath} --emitDeclarationOnly --declaration --declarationMap --outDir ${outputPath}`,
    {
      stdio: 'inherit',
      cwd: projectRoot,
    }
  )

  // Flatten declaration paths (tsc outputs nested structure due to rootDir)
  const nestedDeclarations = join(outputPath, relative(workspaceRoot, join(projectRoot, 'src')))
  if (existsSync(nestedDeclarations)) {
    // Copy lib declarations (shared code)
    const libSrc = join(nestedDeclarations, 'lib')
    const libDest = join(outputPath, 'lib')
    if (existsSync(libSrc)) {
      cpSync(libSrc, libDest, { recursive: true, force: true })
    }

    // Move browser declarations
    const browserSrc = join(nestedDeclarations, 'browser')
    const browserDest = join(outputPath, 'browser')
    if (existsSync(browserSrc)) {
      cpSync(browserSrc, browserDest, { recursive: true, force: true })
    }

    // Move node declarations
    const nodeSrc = join(nestedDeclarations, 'node')
    const nodeDest = join(outputPath, 'node')
    if (existsSync(nodeSrc)) {
      cpSync(nodeSrc, nodeDest, { recursive: true, force: true })
    }

    // Clean up nested directory structure
    // Find the top-level generated folder and remove it
    const parts = relative(workspaceRoot, projectRoot).split('/')
    const topLevel = parts[0]
    if (topLevel) {
      const topLevelNested = join(outputPath, topLevel)
      if (existsSync(topLevelNested)) {
        rmSync(topLevelNested, { recursive: true, force: true })
      }
    }
  }

  // Generate package.json
  const srcPkg = readPackageJson(projectRoot)
  generateIsomorphicPackageJson(srcPkg, outputPath)

  logger.info('Isomorphic library build complete')
}

/**
 * Main executor function.
 *
 * @param options - Build executor options
 * @param context - Nx executor context
 * @returns Success status
 */
export default async function runExecutor(
  options: BuildExecutorOptions,
  context: ExecutorContext
): Promise<{ success: boolean }> {
  const { projectName, root: workspaceRootPath } = context

  if (!projectName) {
    logger.error('Project name is required')
    return { success: false }
  }

  const projectConfig = context.projectsConfigurations?.projects[projectName]
  if (!projectConfig) {
    logger.error(`Could not find project configuration for ${projectName}`)
    return { success: false }
  }

  const projectRoot = join(workspaceRootPath, projectConfig.root)

  // Resolve options with defaults
  const outputPath = resolveOutputPath(
    options.outputPath ?? `dist/${projectConfig.root}`,
    projectRoot
  )
  const tsConfigPath = resolveTsConfigPath(
    options.tsConfig ?? `${projectConfig.root}/tsconfig.lib.json`,
    projectRoot
  )
  const assets = options.assets ?? []
  const external = options.external ?? []

  logger.info(`Building ${projectName}...`)
  logger.info(`  Project root: ${projectRoot}`)
  logger.info(`  Output path: ${outputPath}`)
  logger.info(`  TS config: ${tsConfigPath}`)

  // Detect library type
  const libraryType = detectLibraryType(projectRoot)
  logger.info(`  Library type: ${libraryType}`)

  // Ensure output directory exists and is clean
  if (existsSync(outputPath)) {
    rmSync(outputPath, { recursive: true, force: true })
  }
  mkdirSync(outputPath, { recursive: true })

  try {
    // Build based on library type
    if (libraryType === 'isomorphic') {
      await buildIsomorphicLibrary(projectRoot, outputPath, tsConfigPath, external)
    } else {
      await buildStandardLibrary(projectRoot, outputPath, tsConfigPath, external)
    }

    // Copy default assets
    copyDefaultAssets(projectRoot, outputPath)

    // Copy additional assets
    if (assets.length > 0) {
      await copyAssets(assets, projectRoot, outputPath)
    }

    logger.info(`Successfully built ${projectName}`)
    return { success: true }
  } catch (error) {
    logger.error(`Failed to build ${projectName}`)
    logger.error(error instanceof Error ? error.message : String(error))
    return { success: false }
  }
}
