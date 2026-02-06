/**
 * Standard library build utilities for the build executor.
 *
 * Builds libraries with a single entry point (src/index.ts).
 */
import { logger } from '@nx/devkit'
import { join } from 'node:path'
import { rollup, type RollupOptions, type OutputOptions } from 'rollup'
import nodeResolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import { generateStandardPackageJson, readProjectPackageJson } from './package-json'

/**
 * Creates Rollup configuration for a standard library.
 *
 * @param inputFile - Absolute path to the entry file
 * @param tsConfigPath - Absolute path to the tsconfig file
 * @param outputPath - Absolute path to the output directory
 * @param projectRoot - Absolute path to the project root
 * @param external - External dependencies to exclude from bundle
 * @returns Rollup configuration
 */
export function createStandardRollupConfig(
  inputFile: string,
  tsConfigPath: string,
  outputPath: string,
  projectRoot: string,
  external: string[]
): RollupOptions {
  return {
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
}

/**
 * Creates output configurations for ESM and CJS formats.
 *
 * @param outputPath - Absolute path to the output directory
 * @returns Array of Rollup output configurations
 */
export function createStandardOutputConfigs(outputPath: string): OutputOptions[] {
  return [
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
}

/**
 * Builds a standard library (single entry point).
 *
 * @param projectRoot - Absolute path to the project root
 * @param outputPath - Absolute path to output directory
 * @param tsConfigPath - Absolute path to tsconfig file
 * @param external - External dependencies to exclude from bundle
 */
export async function buildStandardLibrary(
  projectRoot: string,
  outputPath: string,
  tsConfigPath: string,
  external: string[]
): Promise<void> {
  logger.info('Building standard library...')

  const inputFile = join(projectRoot, 'src', 'index.ts')
  const rollupConfig = createStandardRollupConfig(
    inputFile,
    tsConfigPath,
    outputPath,
    projectRoot,
    external
  )
  const outputConfigs = createStandardOutputConfigs(outputPath)

  const bundle = await rollup(rollupConfig)

  try {
    for (const output of outputConfigs) {
      await bundle.write(output)
    }
  } finally {
    await bundle.close()
  }

  // Generate package.json
  const srcPkg = readProjectPackageJson(projectRoot)
  generateStandardPackageJson(srcPkg, outputPath)

  logger.info('Standard library build complete')
}

/**
 * Gets the entry file path for a standard library.
 *
 * @param projectRoot - Absolute path to the project root
 * @returns Absolute path to the entry file
 */
export function getStandardEntryFile(projectRoot: string): string {
  return join(projectRoot, 'src', 'index.ts')
}
