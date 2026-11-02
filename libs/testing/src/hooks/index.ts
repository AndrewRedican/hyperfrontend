/**
 * The preload that makes a Jest-style spec loadable by Node's test runner: path aliases,
 * extensionless specifiers, `moduleNameMapper` redirects and `jest.mock` replacements.
 *
 * @module @hyperfrontend/testing/hooks
 */
import { readFileSync, realpathSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { locateRuntimeEntry } from '../lib/locate.ts'
import { currentGeneration } from './generation.ts'
import { MOCK_LIFECYCLE_VAR, registerMockLifecycle } from './mock-lifecycle.ts'
import {
  MOCK_SCHEME,
  isMocked,
  isReplacementRequest,
  mockTarget,
  mockedSource,
  registerSetupMocks,
  registerSpecMocks,
  setSpecifierResolver,
} from './mock-registry.ts'
import { aliasTable, loadAliases } from './paths.ts'
import { compileModuleMappings, resolveSpecifier } from './resolver.ts'

/**
 * Environment variable naming the workspace root. The runner always sets it; the fallback
 * keeps a hand-run `node --import` usable from inside a project directory.
 */
const WORKSPACE_ROOT_VAR = 'HF_TEST_WORKSPACE_ROOT'

/**
 * Environment variable holding a JSON array of `[pattern, replacement]` pairs, the
 * equivalent of Jest's `moduleNameMapper`. `<rootDir>` in a replacement is substituted
 * with the project root the runner was invoked from.
 */
const MODULE_MAP_VAR = 'HF_TEST_MODULE_MAP'

/**
 * Environment variable holding a JSON array of absolute paths naming the environment's
 * setup modules. A setup module is not recognisable from its name the way a spec is, so
 * the runner has to say which files they are for their `jest.mock` calls to be read.
 */
const SETUP_FILES_VAR = 'HF_TEST_SETUP_FILES'

/**
 * Environment variable holding an explicit alias map, `paths`-style, that replaces the
 * workspace's `tsconfig.base.json` aliases outright. The e2e runner sets it so a packed
 * tarball's own name resolves from the test project's `node_modules` instead of being
 * hijacked to workspace source, while the test runtime stays reachable by alias.
 */
const ALIASES_VAR = 'HF_TEST_ALIASES'

/**
 * Installs the synchronous resolution hooks a Jest-style spec relies on under native ES
 * modules: tsconfig path aliases, `moduleNameMapper` redirects, extensionless TypeScript
 * specifiers, and the module generation that backs `jest.resetModules`. Node resolves none
 * of these itself.
 *
 * This module is the `--import` entry, so it runs before any test code and imports its
 * own dependencies by explicit path: the hooks it is about to install are not available
 * to it yet.
 *
 * @example Installing the hooks for a hand-run `node --test`
 * ```bash
 * HF_TEST_WORKSPACE_ROOT=/repo node --import @hyperfrontend/testing/hooks --test src/double.spec.ts
 * ```
 */
export function registerResolutionHooks(): void {
  const workspaceRoot = process.env[WORKSPACE_ROOT_VAR] ?? process.cwd()
  // why: Node resolves a module's symbolic links before this hook sees its URL, so a setup file named through one, as the macOS temporary directory is, is matched by its real path.
  const setupFiles = new Set((JSON.parse(process.env[SETUP_FILES_VAR] ?? '[]') as string[]).map((file) => realpathSync(file)))
  const declaredAliases = process.env[ALIASES_VAR]
  const context = {
    workspaceRoot,
    aliases: declaredAliases ? aliasTable(JSON.parse(declaredAliases) as Record<string, string[]>) : loadAliases(workspaceRoot),
    mappings: compileModuleMappings(process.env[MODULE_MAP_VAR], process.cwd()),
    entryDirectory: process.cwd(),
  }

  // why: the registry has to resolve a specifier exactly as this hook will, or a mock naming a workspace library would register against a url nothing ever asks for.
  setSpecifierResolver((specifier, parentUrl) => resolveSpecifier(specifier, parentUrl, context))

  // why: a replacement imports `jest` from the main entry by URL, and the file that entry is served from depends on whether the package runs from its source or from its build.
  // why: `__dirname` is read first so the CommonJS build locates the entry too; under ES modules the identifier is absent and the URL is used instead.
  const ownDirectory = typeof __dirname === 'undefined' ? dirname(fileURLToPath(import.meta.url)) : __dirname
  const runtimeUrl = pathToFileURL(locateRuntimeEntry('main', ownDirectory)).href

  registerHooks({
    resolve(specifier, resolveContext, nextResolve) {
      const url = resolveSpecifier(specifier, resolveContext.parentURL, context) ?? nextResolve(specifier, resolveContext).url

      // why: a replacement reaches the module it stands in for by importing it, so its own imports must not be replaced in turn.
      if (isReplacementRequest(specifier, resolveContext.parentURL)) return { url, shortCircuit: true }

      // why: substituting here rather than at load is what lets a built-in be replaced at all, since one this loader has already imported would never be loaded again.
      // why: `jest.resetModules` must reach replacements too, or a `jest.doMock` declared after the first one would be served the cached replacement.
      if (isMocked(url)) return { url: `${MOCK_SCHEME}${encodeURIComponent(url)}?g=${currentGeneration()}`, shortCircuit: true }

      return { url, shortCircuit: true }
    },

    load(url, loadContext, nextLoad) {
      if (url.startsWith(MOCK_SCHEME)) {
        // why: the factory is carried through verbatim from the spec, so the replacement is loaded as TypeScript the way a spec is; plain JavaScript passes through stripping untouched.
        return { format: 'module-typescript', source: mockedSource(mockTarget(url), runtimeUrl), shortCircuit: true }
      }

      // why: the sources import JSON without the attribute native ES modules require, since the bundler inlines it and Jest's CommonJS runtime never asked. Supplying it here keeps that spelling working at test time.
      const context = url.endsWith('.json') ? { ...loadContext, importAttributes: { type: 'json' } } : loadContext

      const result = nextLoad(url, context)
      // how: a spec's own load runs before Node resolves the spec's imports, so declarations read here are registered before any mocked module is asked for.
      // how: a setup module is preloaded ahead of every spec, so the declarations it makes for the whole project are registered before any of them.
      if (isSpecFile(url)) registerSpecMocks(url, sourceOf(url))
      else if (isSetupFile(url, setupFiles)) registerSetupMocks(url, sourceOf(url))
      return result
    },
  })
}

/**
 * Reads the text of the file a URL names, ignoring any generation query on it.
 *
 * @param url - The URL being loaded.
 * @returns The file's contents.
 */
function sourceOf(url: string): string {
  return readFileSync(fileURLToPath(url.split('?')[0] ?? url), 'utf8')
}

/**
 * The infixes that mark a file as a spec, as Jest's default `testMatch` recognises them.
 */
const SPEC_INFIXES: readonly string[] = ['.spec', '.test']

/**
 * The extensions a spec may carry, TypeScript and JavaScript alike.
 */
const SPEC_EXTENSIONS: readonly string[] = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']

/**
 * Reports whether a URL names a spec file.
 *
 * A spec is recognised by its name, the way Jest's default `testMatch` recognises it, so a
 * `jest.mock` call is read out of a `.test.js` file as readily as out of a `.spec.ts` one.
 *
 * @param url - The URL being loaded.
 * @returns True when the file is a spec.
 */
function isSpecFile(url: string): boolean {
  const path = url.split('?')[0] ?? url
  return SPEC_INFIXES.some((infix) => SPEC_EXTENSIONS.some((extension) => path.endsWith(`${infix}${extension}`)))
}

/**
 * Reports whether a URL names one of the environment's setup modules.
 *
 * @param url - The URL being loaded.
 * @param setupFiles - Absolute paths of the declared setup modules.
 * @returns True when the file is a setup module.
 */
function isSetupFile(url: string, setupFiles: ReadonlySet<string>): boolean {
  if (setupFiles.size === 0 || !url.startsWith('file:')) return false
  return setupFiles.has(fileURLToPath(url.split('?')[0] ?? url))
}

registerResolutionHooks()
registerMockLifecycle(process.env[MOCK_LIFECYCLE_VAR])
