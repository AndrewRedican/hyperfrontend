import type { Plugin } from 'rollup'
import nodeResolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from '@rollup/plugin-typescript'
import json from '@rollup/plugin-json'
import terser from '@rollup/plugin-terser'

/**
 * Creates a node-resolve plugin for entry point builds.
 *
 * @param bundleWorkspaceDeps - When true, resolves \@hyperfrontend/* packages for bundling.
 *                              When false, excludes them so they remain external.
 * @returns Configured node-resolve plugin
 */
export function createNodeResolvePlugin(bundleWorkspaceDeps: boolean): Plugin {
  const config: Parameters<typeof nodeResolve>[0] = {
    extensions: ['.ts', '.js'],
  }

  // When not bundling workspace deps, exclude @hyperfrontend/* from resolution
  if (!bundleWorkspaceDeps) {
    config.resolveOnly = [/^(?!@hyperfrontend\/)/]
  }

  return <Plugin>nodeResolve(config)
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
 *
 * Declaration files are NOT emitted by rollup - they are generated separately
 * via tsc in the generateDeclarations function. This ensures consistent
 * declaration output structure regardless of bundleWorkspaceDeps setting.
 *
 * @param tsConfigPath - Absolute path to tsconfig file
 * @param projectRoot - Absolute path to project root
 * @param outputPath - Absolute path to output directory
 * @param sourcemap - Whether to emit sourcemaps
 * @param bundleWorkspaceDeps - When true, enables workspace path resolution for bundling.
 *                              When false, uses paths: {} to prevent following workspace imports.
 * @param workspaceRoot - Absolute path to workspace root (required when bundleWorkspaceDeps is true)
 * @returns Configured typescript plugin
 */
export function createTypescriptPlugin(
  tsConfigPath: string,
  projectRoot: string,
  outputPath: string,
  sourcemap: boolean,
  bundleWorkspaceDeps: boolean,
  workspaceRoot?: string
): Plugin {
  // When bundling workspace deps, use workspace-level configuration
  // similar to bundle builds (IIFE/UMD) to allow compiling files from
  // multiple workspace packages. Declarations are generated separately via tsc.
  if (bundleWorkspaceDeps) {
    if (!workspaceRoot) {
      throw new Error('workspaceRoot is required when bundleWorkspaceDeps is true')
    }
    return <Plugin>typescript({
      tsconfig: tsConfigPath,
      declaration: false,
      declarationMap: false,
      sourceMap: sourcemap,
      compilerOptions: {
        baseUrl: workspaceRoot,
        outDir: outputPath,
      },
    })
  }

  // When not bundling workspace deps, use project-level configuration
  // with empty paths to prevent TypeScript from following workspace imports.
  // Declarations are generated separately via tsc.
  return <Plugin>typescript({
    tsconfig: tsConfigPath,
    declaration: false,
    declarationMap: false,
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
