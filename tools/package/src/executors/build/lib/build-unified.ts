/**
 * Unified library build utilities for the build executor.
 *
 * Handles any library structure by building all discovered entry points.
 *
 * ARCHITECTURE OVERVIEW:
 * -----------------------
 * This module uses Rollup to build TypeScript libraries with multiple entry points.
 * Each entry point (., ./browser, ./node, ./feature, etc.) is built separately to
 * produce both ESM and CJS outputs, enabling consumers to import specific subpaths
 * like `import { x } from '@hyperfrontend/lib/browser'`.
 *
 * WHY ROLLUP?
 * Rollup produces smaller, cleaner bundles than webpack for library publishing.
 * It tree-shakes effectively and preserves ES module semantics, which is critical
 * for libraries that need to work in both bundler and native ESM environments.
 */
import { logger } from '@nx/devkit'
import { existsSync, mkdirSync, cpSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, relative } from 'node:path'
import { rollup, type RollupOptions, type OutputOptions, type RollupLog } from 'rollup'

/*
 * PLUGIN SELECTION:
 *
 * @rollup/plugin-node-resolve:
 *   Resolves node_modules imports. Without this, Rollup can't find third-party packages.
 *   We configure it to NOT resolve @hyperfrontend/* packages since those are peer dependencies.
 *
 * @rollup/plugin-commonjs:
 *   Converts CommonJS modules to ES6. Required for packages like `jsonschema` that only
 *   export CommonJS. Without this, named imports from CJS packages fail with:
 *   "X is not exported by node_modules/package/index.js"
 *
 * @rollup/plugin-typescript:
 *   Compiles TypeScript and optionally generates declaration files. We generate
 *   declarations only for the root entry via this plugin; sub-entries use a separate
 *   tsc invocation to avoid complex per-entry declaration routing.
 *
 * @rollup/plugin-json:
 *   Allows importing .json files directly (e.g., JSON schemas). Without this,
 *   Rollup fails with "Expected ';' or '}' or <eof>" when encountering JSON syntax.
 */
import nodeResolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from '@rollup/plugin-typescript'
import json from '@rollup/plugin-json'
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
  /*
   * EXTERNAL DEPENDENCY HANDLING:
   *
   * For library builds, we must NOT bundle dependencies into the output.
   * Consumers will install these dependencies themselves. If we bundled them:
   * 1. Bundle size would explode (duplicating shared deps across packages)
   * 2. Version conflicts could occur (consumer might need different version)
   * 3. Tree-shaking would be impossible for the bundled code
   *
   * We mark as external:
   * - All dependencies from package.json (passed via `external` array)
   * - All @hyperfrontend/* packages (always peer dependencies in this monorepo)
   *
   * The function approach (vs array) is needed because Rollup resolves imports
   * BEFORE checking externals. By using a function, we can catch @hyperfrontend/*
   * imports before they're resolved to source paths (which would cause TS6059).
   */
  const isExternal = (id: string): boolean => {
    if (external.includes(id)) return true
    if (id.startsWith('@hyperfrontend/')) return true
    return false
  }

  return {
    input: inputFile,
    external: isExternal,

    /*
     * WARNING SUPPRESSION:
     *
     * We suppress specific warnings that are expected and noisy:
     *
     * TS2307 ("Cannot find module '@hyperfrontend/...'")
     *   This fires because we clear tsconfig paths to prevent source resolution.
     *   TypeScript can't find type declarations for external packages at build time,
     *   but that's fine - the runtime output correctly references them as bare imports.
     *
     * EMPTY_BUNDLE
     *   Barrel files that only re-export from other files produce "empty" chunks.
     *   This is expected behavior - the re-exports are handled by the module system.
     *   The ESM/CJS outputs are still generated correctly.
     */
    onwarn(warning: RollupLog, defaultHandler: (warning: RollupLog) => void) {
      if (warning.plugin === 'typescript' && warning.message?.includes('TS2307')) {
        return
      }
      if (warning.code === 'EMPTY_BUNDLE') {
        return
      }
      defaultHandler(warning)
    },

    plugins: [
      /*
       * Plugin order matters!
       * 1. json() - Must come early to transform JSON before other plugins see it
       * 2. nodeResolve() - Resolves bare imports to node_modules paths
       * 3. commonjs() - Converts CJS to ESM (must come after nodeResolve)
       * 4. typescript() - Compiles TS (runs last on resolved, converted code)
       */
      json(),

      nodeResolve({
        extensions: ['.ts', '.js'],
        /*
         * resolveOnly with negative lookahead regex:
         * Only resolve packages that DON'T start with @hyperfrontend/
         * This prevents Rollup from resolving internal packages to their source,
         * which would cause TS6059 rootDir errors and incorrect bundling.
         */
        resolveOnly: [/^(?!@hyperfrontend\/)/],
      }),

      commonjs(),

      typescript({
        tsconfig: tsConfigPath,

        /*
         * DECLARATION GENERATION STRATEGY:
         *
         * For root entry: Generate declarations via rollup-plugin-typescript.
         * For sub-entries: Skip here, generate all at once via separate tsc call.
         *
         * Why this split approach?
         * - Rollup's TS plugin generates declarations relative to each entry's output
         * - For sub-entries, this creates complex nested paths that don't match exports
         * - A single tsc invocation with --emitDeclarationOnly produces correct structure
         *
         * declarationMap must match declaration to avoid TS5069:
         * "Option 'declarationMap' cannot be specified without 'declaration'"
         */
        declaration: isRootEntry,
        declarationMap: isRootEntry,
        declarationDir: isRootEntry ? outputPath : undefined,

        rootDir: join(projectRoot, 'src'),
        outDir: outputPath,
        sourceMap: true,

        /*
         * PATH CLEARING - CRITICAL FOR MONOREPO BUILDS:
         *
         * The workspace tsconfig.base.json defines paths like:
         *   "@hyperfrontend/data-utils": ["libs/utils/data/src/index.ts"]
         *
         * Without clearing these, TypeScript would:
         * 1. Resolve @hyperfrontend/data-utils to libs/utils/data/src/index.ts
         * 2. Try to compile that source file
         * 3. Fail with TS6059: rootDir must contain all source files
         *
         * By setting paths: {}, we force TypeScript to leave @hyperfrontend/*
         * imports as-is. They become external references in the output:
         *   import { x } from '@hyperfrontend/data-utils'
         *
         * Consumers resolve these via their own node_modules.
         */
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
 * WHY DUAL FORMAT OUTPUT:
 * -----------------------
 * Modern JavaScript has two module systems that libraries must support:
 *
 * ESM (ES Modules) - index.esm.js:
 *   - Native browser support via <script type="module">
 *   - Used by modern bundlers (Vite, esbuild, Rollup)
 *   - Enables tree-shaking and static analysis
 *   - Syntax: import/export
 *
 * CJS (CommonJS) - index.cjs.js:
 *   - Required for Node.js (especially older versions)
 *   - Used by Jest, older tooling, and require() calls
 *   - Syntax: require/module.exports
 *
 * Package.json "exports" field routes consumers to the right format:
 *   "import": "./index.esm.js" (for import statements)
 *   "require": "./index.cjs.js" (for require calls)
 *
 * Source maps (.js.map) enable debugging with original TypeScript source.
 *
 * @param outputPath - Absolute path to the output directory
 * @param entryName - Name for the output files (default: 'index')
 * @returns Array of Rollup output configurations
 */
export function createOutputConfigs(outputPath: string, entryName = 'index'): OutputOptions[] {
  return [
    {
      file: join(outputPath, `${entryName}.esm.js`),
      format: 'esm',
      sourcemap: true,
    },
    {
      file: join(outputPath, `${entryName}.cjs.js`),
      format: 'cjs',
      sourcemap: true,
    },
  ]
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
  const entryOutputPath = entry.srcPath
    ? join(outputBasePath, entry.srcPath)
    : outputBasePath

  // Ensure output directory exists
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
 *
 * WHY A SEPARATE TSC CALL FOR DECLARATIONS:\n * -----------------------------------------
 * For libraries with multiple entry points, declaration generation is tricky.
 *
 * Problem with Rollup's TypeScript plugin for sub-entries:
 * Each entry is built independently, and declarations are generated relative to
 * that entry's output directory. This creates mismatched declaration paths:
 *   - Entry ./browser outputs to dist/browser/
 *   - Its declarations reference types from dist/browser/ perspective
 *   - But the root entry's types reference dist/ perspective
 *   - Import resolution breaks when types don't align
 *
 * Solution: Use Rollup's TS plugin only for the root entry, then run a single
 * tsc --emitDeclarationOnly pass that generates ALL declarations in one shot.
 * This ensures consistent type resolution paths across all entry points.
 *
 * The --declarationMap flag generates .d.ts.map files that map declarations
 * back to original .ts source, enabling "Go to Definition" in IDEs.
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
  /*
   * Root-only libraries (single entry at src/index.ts) don't need this.
   * Their declarations are generated by rollup-plugin-typescript during build.
   */
  if (discovery.category === 'root') {
    return
  }

  logger.info('Generating TypeScript declarations...')

  execFileSync('npx', [
    'tsc',
    '--project', tsConfigPath,
    '--emitDeclarationOnly',
    '--declaration',
    '--declarationMap',
    '--outDir', outputPath
  ], {
    stdio: 'inherit',
    cwd: projectRoot,
  })

  flattenDeclarationPaths(projectRoot, outputPath, workspaceRoot, discovery)
}

/**
 * Flattens declaration paths from nested structure to flat output.
 *
 * WHY FLATTENING IS NEEDED:
 * -------------------------
 * TypeScript's tsc outputs declarations mirroring the source directory structure
 * relative to the workspace root. For a library at libs/utils/data/:
 *
 * tsc outputs:        dist/libs/utils/data/src/browser/index.d.ts
 * We need:            dist/browser/index.d.ts
 *
 * This happens because tsc calculates paths from rootDir, and in a monorepo,
 * rootDir is often the workspace root to allow cross-project imports.
 *
 * This function copies declarations from the nested structure to the expected
 * flat output locations, then cleans up the nested directories.
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
  /*
   * Calculate where tsc put the declarations.
   * For libs/utils/data/, this would be dist/libs/utils/data/src/
   */
  const nestedDeclarations = join(outputPath, relative(workspaceRoot, join(projectRoot, 'src')))

  if (!existsSync(nestedDeclarations)) {
    return
  }

  // Copy each entry point's declarations to its output location
  for (const entry of discovery.entryPoints) {
    if (entry.isRoot) continue // Root declarations are in the right place

    const srcDir = entry.srcPath
    const declSrc = join(nestedDeclarations, srcDir)
    const declDest = join(outputPath, srcDir)

    if (existsSync(declSrc)) {
      mkdirSync(dirname(declDest), { recursive: true })
      cpSync(declSrc, declDest, { recursive: true, force: true })
    }
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
 * Builds a library with any entry point configuration.
 *
 * BUILD PROCESS OVERVIEW:
 * -----------------------
 * 1. BUILD ENTRY POINTS: Each entry (., ./browser, ./node, etc.) is built
 *    separately via Rollup. This produces:
 *    - dist/index.esm.js + dist/index.cjs.js (root entry)
 *    - dist/browser/index.esm.js + dist/browser/index.cjs.js
 *    - etc.
 *
 * 2. GENERATE DECLARATIONS: A single tsc --emitDeclarationOnly pass creates
 *    all .d.ts files. These are then flattened from tsc's nested output
 *    structure to match the JavaScript output locations.
 *
 * 3. GENERATE PACKAGE.JSON: Creates a package.json with:
 *    - \"exports\" field mapping each entry point to its files
 *    - \"types\" fields pointing to .d.ts files
 *    - \"main\" and \"module\" for backward compatibility
 *
 * This unified approach handles all library patterns:\n * - Standard: Simple libraries with src/index.ts only
 * - Platform-specific: Libraries with browser/ and node/ variants
 * - Feature-based: Libraries with multiple domain modules
 * - Complex: Deep nested structures combining the above
 *
 * @param projectRoot - Absolute path to the project root
 * @param outputPath - Absolute path to output directory
 * @param tsConfigPath - Absolute path to tsconfig file
 * @param external - External dependencies to exclude from bundle
 * @param workspaceRoot - Absolute path to workspace root
 * @param discovery - Entry point discovery result
 */
export async function buildUnifiedLibrary(
  projectRoot: string,
  outputPath: string,
  tsConfigPath: string,
  external: string[],
  workspaceRoot: string,
  discovery: EntryPointDiscovery
): Promise<void> {
  logger.info(`Building library (${discovery.category} structure, ${discovery.entryPoints.length} entry points)...`)

  /*
   * STEP 1: Build each entry point to ESM + CJS
   * Sequential execution ensures consistent output and clear error messages.
   * Parallel builds could be faster but make debugging harder.
   */
  for (const entry of discovery.entryPoints) {
    await buildSingleEntryPoint(entry, outputPath, tsConfigPath, projectRoot, external)
  }

  /*
   * STEP 2: Generate TypeScript declarations
   * Only runs for multi-entry libraries; root-only libs get declarations from Rollup.
   * This ensures all declaration paths are consistent across entry points.
   */
  generateDeclarationsUnified(projectRoot, outputPath, tsConfigPath, workspaceRoot, discovery)

  /*
   * STEP 3: Generate package.json with exports map
   * This is what enables import '@hyperfrontend/lib/browser' to work.
   * The exports field maps subpaths to their ESM/CJS/types files.
   */
  const srcPkg = readProjectPackageJson(projectRoot)
  generatePackageJsonFromDiscovery(srcPkg, outputPath, discovery)

  logger.info('Library build complete')
}
