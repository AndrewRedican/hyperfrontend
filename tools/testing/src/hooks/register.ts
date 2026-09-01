import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'
import { currentGeneration } from './generation.ts'
import {
  MOCK_SCHEME,
  isMocked,
  mockTarget,
  mockedSource,
  registerSetupMocks,
  registerSpecMocks,
  setSpecifierResolver,
} from './mock-registry.ts'
import { loadAliases } from './paths.ts'
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
 * Installs the synchronous resolution hooks the workspace's tests rely on: workspace path
 * aliases, `moduleNameMapper` redirects, extensionless TypeScript specifiers, and the
 * module generation that backs `jest.resetModules`. Node resolves none of these itself.
 *
 * This module is the `--import` entry, so it runs before any test code and imports its
 * own dependencies by explicit path: the hooks it is about to install are not available
 * to it yet.
 */
export function registerResolutionHooks(): void {
  const workspaceRoot = process.env[WORKSPACE_ROOT_VAR] ?? process.cwd()
  const setupFiles = new Set(JSON.parse(process.env[SETUP_FILES_VAR] ?? '[]') as string[])
  const context = {
    workspaceRoot,
    aliases: loadAliases(workspaceRoot),
    mappings: compileModuleMappings(process.env[MODULE_MAP_VAR], process.cwd()),
    entryDirectory: process.cwd(),
  }

  // why: the registry has to resolve a specifier exactly as this hook will, or a mock naming a workspace library would register against a url nothing ever asks for.
  setSpecifierResolver((specifier, parentUrl) => resolveSpecifier(specifier, parentUrl, context))

  const runtimeUrl = new URL('../mock/jest-api.ts', import.meta.url).href

  registerHooks({
    resolve(specifier, resolveContext, nextResolve) {
      const url = resolveSpecifier(specifier, resolveContext.parentURL, context) ?? nextResolve(specifier, resolveContext).url

      // why: a replacement reaches the module it stands in for by importing it, so its own imports must not be replaced in turn.
      if (resolveContext.parentURL?.startsWith(MOCK_SCHEME)) return { url, shortCircuit: true }

      // why: substituting here rather than at load is what lets a built-in be replaced at all, since one this loader has already imported would never be loaded again.
      // why: `jest.resetModules` must reach replacements too, or a `jest.doMock` declared after the first one would be served the cached replacement.
      if (isMocked(url)) return { url: `${MOCK_SCHEME}${encodeURIComponent(url)}?g=${currentGeneration()}`, shortCircuit: true }

      return { url, shortCircuit: true }
    },

    load(url, loadContext, nextLoad) {
      if (url.startsWith(MOCK_SCHEME)) {
        // why: the factory is carried through verbatim from a TypeScript spec, so the replacement has to be stripped the same way its source file was.
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
 * Reports whether a URL names a spec file.
 *
 * @param url - The URL being loaded.
 * @returns True when the file is a spec.
 */
function isSpecFile(url: string): boolean {
  const path = url.split('?')[0] ?? url
  return path.endsWith('.spec.ts') || path.endsWith('.spec.tsx')
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
