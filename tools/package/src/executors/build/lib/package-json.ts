/**
 * Package.json generation utilities for the build executor.
 *
 * Uses Nx devkit's readJsonFile and writeJsonFile for JSON operations.
 */
import { readJsonFile, writeJsonFile } from '@nx/devkit'
import { join } from 'node:path'
import type { LibraryType } from './types'

/** Package.json type with standard fields */
interface PackageJson {
  name?: string
  version?: string
  main?: string
  module?: string
  types?: string
  exports?: Record<string, unknown>
  [key: string]: unknown
}

/**
 * Reads and parses the source package.json using Nx devkit.
 *
 * @param projectRoot - Absolute path to the project root
 * @returns Parsed package.json contents
 */
export function readProjectPackageJson(projectRoot: string): PackageJson {
  const pkgPath = join(projectRoot, 'package.json')
  return readJsonFile<PackageJson>(pkgPath)
}

/**
 * Writes package.json to the output directory using Nx devkit.
 *
 * @param outputPath - Absolute path to output directory
 * @param packageJson - Package.json contents to write
 */
export function writeOutputPackageJson(outputPath: string, packageJson: PackageJson): void {
  const pkgPath = join(outputPath, 'package.json')
  writeJsonFile(pkgPath, packageJson)
}

/**
 * Generates package.json for standard library output.
 *
 * @param srcPkg - Source package.json contents
 * @param outputPath - Absolute path to output directory
 */
export function generateStandardPackageJson(srcPkg: PackageJson, outputPath: string): void {
  const distPkg: PackageJson = {
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
  writeOutputPackageJson(outputPath, distPkg)
}

/**
 * Generates package.json for isomorphic library output.
 *
 * @param srcPkg - Source package.json contents
 * @param outputPath - Absolute path to output directory
 */
export function generateIsomorphicPackageJson(srcPkg: PackageJson, outputPath: string): void {
  // Remove main/module/types since there's no root export
  const { main, module, types, ...rest } = srcPkg
  void main
  void module
  void types

  const distPkg: PackageJson = {
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
  writeOutputPackageJson(outputPath, distPkg)
}

/**
 * Generates the appropriate package.json based on library type.
 *
 * @param projectRoot - Absolute path to the project root
 * @param outputPath - Absolute path to output directory
 * @param libraryType - Type of library ('standard' or 'isomorphic')
 */
export function generateDistPackageJson(
  projectRoot: string,
  outputPath: string,
  libraryType: LibraryType
): void {
  const srcPkg = readProjectPackageJson(projectRoot)

  if (libraryType === 'isomorphic') {
    generateIsomorphicPackageJson(srcPkg, outputPath)
  } else {
    generateStandardPackageJson(srcPkg, outputPath)
  }
}

/**
 * Gets the export configuration for standard libraries.
 *
 * @returns Standard library export configuration
 */
export function getStandardExports(): Record<string, unknown> {
  return {
    './package.json': './package.json',
    '.': {
      types: './index.d.ts',
      import: './index.esm.js',
      require: './index.cjs.js',
    },
  }
}

/**
 * Gets the export configuration for isomorphic libraries.
 *
 * @returns Isomorphic library export configuration
 */
export function getIsomorphicExports(): Record<string, unknown> {
  return {
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
  }
}
