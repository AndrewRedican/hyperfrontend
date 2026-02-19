import type { Plugin } from 'rollup'
import nodeResolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from '@rollup/plugin-typescript'
import json from '@rollup/plugin-json'
import terser from '@rollup/plugin-terser'

/**
 * Creates a node-resolve plugin for entry point builds.
 * Resolves only non-\@hyperfrontend/* packages.
 *
 * @returns Configured node-resolve plugin
 */
export function createNodeResolvePlugin(): Plugin {
  return <Plugin>nodeResolve({
    extensions: ['.ts', '.js'],
    resolveOnly: [/^(?!@hyperfrontend\/)/],
  })
}

/**
 * Creates a node-resolve plugin for browser bundle builds (IIFE/UMD).
 * Resolves all packages including \@hyperfrontend/* dependencies.
 *
 * @returns Configured node-resolve plugin for browsers
 */
export function createBrowserNodeResolvePlugin(): Plugin {
  return <Plugin>nodeResolve({
    extensions: ['.ts', '.js'],
    browser: true,
    preferBuiltins: false,
  })
}

/**
 * Creates a commonjs plugin for Rollup.
 *
 * @returns Configured commonjs plugin
 */
export function createCommonJsPlugin(): Plugin {
  return <Plugin>commonjs()
}

/**
 * Creates a typescript plugin for entry point builds.
 * Uses paths: {} to prevent TypeScript from following workspace imports -
 * \@hyperfrontend/* packages are external and should not be compiled.
 *
 * @param tsConfigPath - Absolute path to tsconfig file
 * @param projectRoot - Absolute path to project root
 * @param outputPath - Absolute path to output directory
 * @param emitDeclarations - Whether to emit declaration files
 * @param sourcemap - Whether to emit sourcemaps
 * @returns Configured typescript plugin
 */
export function createTypescriptPlugin(
  tsConfigPath: string,
  projectRoot: string,
  outputPath: string,
  emitDeclarations: boolean,
  sourcemap: boolean
): Plugin {
  return <Plugin>typescript({
    tsconfig: tsConfigPath,
    declaration: emitDeclarations,
    declarationMap: emitDeclarations,
    declarationDir: emitDeclarations ? outputPath : undefined,
    rootDir: `${projectRoot}/src`,
    outDir: outputPath,
    sourceMap: sourcemap,
    compilerOptions: {
      paths: {},
    },
  })
}

/**
 * Creates a typescript plugin for bundle builds (IIFE/UMD).
 * Does not emit declarations.
 *
 * @param tsConfigPath - Absolute path to tsconfig file
 * @param workspaceRoot - Absolute path to workspace root
 * @param bundlePath - Absolute path to bundle output directory
 * @param sourcemap - Whether to emit sourcemaps
 * @returns Configured typescript plugin for bundles
 */
export function createBundleTypescriptPlugin(tsConfigPath: string, workspaceRoot: string, bundlePath: string, sourcemap: boolean): Plugin {
  return <Plugin>typescript({
    tsconfig: tsConfigPath,
    declaration: false,
    declarationMap: false,
    sourceMap: sourcemap,
    compilerOptions: {
      baseUrl: workspaceRoot,
      outDir: bundlePath,
    },
  })
}

/**
 * Creates a json plugin for Rollup.
 *
 * @returns Configured json plugin
 */
export function createJsonPlugin(): Plugin {
  return <Plugin>json()
}

/**
 * Creates a terser plugin for minification.
 *
 * @returns Configured terser plugin
 */
export function createTerserPlugin(): Plugin {
  return terser()
}
