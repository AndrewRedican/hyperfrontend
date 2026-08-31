import { pathToFileURL } from 'node:url'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { readJsonFile } from '@hyperfrontend/project-scope/core/fs'

// note: The single tiered loader shared by `build` and `dev`; mirrors the native-import precedent in libs/versioning.
const JSON_EXTENSION = '.json'

/** Importable (non-JSON) config extensions resolved through native `await import()`. */
const IMPORTABLE_EXTENSIONS: readonly string[] = ['.js', '.mjs', '.cjs', '.ts', '.cts', '.mts']

/** Module namespace returned by `await import()`: ESM shape with optional CJS-interop default. */
interface ImportedModule {
  /** Default export when the config uses `export default` (or `module.exports` via interop). */
  readonly default?: unknown
}

/**
 * Loads a `feature.config.*` / `hf-dev.config.*` / `*.contract.*` file regardless of source format.
 *
 * JSON files parse through `@hyperfrontend/project-scope`; `.js`/`.cjs`/`.mjs`
 * and `.ts`/`.cts`/`.mts` resolve through native `await import()` (Node strips
 * TypeScript types on supported runtimes), returning the module's `default`
 * export when present. The caller is responsible for validating the shape.
 *
 * @param absolutePath - Absolute path to the config or contract file.
 * @returns The resolved configuration value (object, array, or primitive).
 * @throws {Error} When the extension is unsupported or the import fails.
 *
 * @example Loading a TypeScript feature config
 * ```typescript
 * const config = await loadModuleFile('/abs/feature.config.ts')
 * ```
 */
export async function loadModuleFile(absolutePath: string): Promise<unknown> {
  if (absolutePath.endsWith(JSON_EXTENSION)) {
    return readJsonFile(absolutePath)
  }
  if (!IMPORTABLE_EXTENSIONS.some((extension) => absolutePath.endsWith(extension))) {
    throw createError(`Unsupported config extension: ${absolutePath} (expected .json, .js, .mjs, .cjs, .ts, .cts, or .mts).`)
  }
  const imported = await importModule(absolutePath)
  return imported.default
}

/**
 * Dynamically imports a JS/TS config module, normalizing failures into one
 * actionable error that names the Node version TypeScript configs require.
 *
 * @param absolutePath - Absolute path to the importable config module.
 * @returns The imported module namespace.
 * @throws {Error} When the runtime cannot import or type-strip the module.
 */
async function importModule(absolutePath: string): Promise<ImportedModule> {
  try {
    return (await import(pathToFileURL(absolutePath).href)) as ImportedModule
  } catch (error) {
    throw createError(
      `Failed to load config ${absolutePath}: ${String(error)}. ` +
        'TypeScript configs need Node >= 23.6 (or >= 22.6 with --experimental-strip-types) and erasable syntax only (no enums, namespaces, or parameter properties).'
    )
  }
}
