import type { ResolverContext } from './resolver'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { pathToFileURL } from 'node:url'
import { advanceGeneration, currentGeneration } from './generation'
import { loadAliases } from './paths'
import { compileModuleMappings, parentDirectory, resolveSpecifier, toModuleUrl } from './resolver'

const WORKSPACE_ROOT = process.env['HF_TEST_WORKSPACE_ROOT'] ?? process.cwd()
const HOOKS_DIR = `${WORKSPACE_ROOT}/tools/testing/src/hooks`
const HOOKS_URL = pathToFileURL(`${HOOKS_DIR}/resolver.ts`).href

/**
 * Builds a resolver context anchored at the workspace root.
 *
 * @param mappings - Serialised `moduleNameMapper` pairs, if any.
 * @returns The context `resolveSpecifier` consults.
 */
function createContext(mappings?: string): ResolverContext {
  return {
    workspaceRoot: WORKSPACE_ROOT,
    aliases: loadAliases(WORKSPACE_ROOT),
    mappings: compileModuleMappings(mappings, HOOKS_DIR),
    entryDirectory: HOOKS_DIR,
  }
}

describe('compileModuleMappings', () => {
  it('returns nothing when no mapping is supplied', () => {
    assert.deepEqual(compileModuleMappings(undefined, '/project'), [])
  })

  it('compiles the pattern into a regular expression', () => {
    assert.deepEqual(compileModuleMappings('[["^a$","/b.ts"]]', '/project')[0]?.pattern, /^a$/)
  })

  it('substitutes the project root for the rootDir token', () => {
    assert.equal(compileModuleMappings('[["^a$","<rootDir>/b.ts"]]', '/project')[0]?.replacement, '/project/b.ts')
  })
})

describe('parentDirectory', () => {
  it('reads the directory from a file URL', () => {
    assert.equal(parentDirectory(HOOKS_URL, '/fallback'), HOOKS_DIR)
  })

  it('strips a generation query before reading the directory', () => {
    assert.equal(parentDirectory(`${HOOKS_URL}?__hfGeneration=2`, '/fallback'), HOOKS_DIR)
  })

  it('falls back when the importer has no URL', () => {
    assert.equal(parentDirectory(undefined, '/fallback'), '/fallback')
  })

  it('falls back for a non-file importer', () => {
    assert.equal(parentDirectory('data:text/javascript,', '/fallback'), '/fallback')
  })
})

describe('resolveSpecifier', () => {
  it('adds the extension a relative specifier omits', () => {
    assert.equal(resolveSpecifier('./paths', HOOKS_URL, createContext()), pathToFileURL(`${HOOKS_DIR}/paths.ts`).href)
  })

  it('keeps an extension a relative specifier already carries', () => {
    assert.equal(resolveSpecifier('./paths.ts', HOOKS_URL, createContext()), pathToFileURL(`${HOOKS_DIR}/paths.ts`).href)
  })

  it('resolves a relative specifier against the entry directory when there is no importer', () => {
    assert.equal(resolveSpecifier('./paths', undefined, createContext()), pathToFileURL(`${HOOKS_DIR}/paths.ts`).href)
  })

  it('resolves an absolute specifier', () => {
    assert.equal(resolveSpecifier(`${HOOKS_DIR}/paths`, HOOKS_URL, createContext()), pathToFileURL(`${HOOKS_DIR}/paths.ts`).href)
  })

  it('defers a relative specifier that matches no file', () => {
    assert.equal(resolveSpecifier('./absent', HOOKS_URL, createContext()), null)
  })

  it('resolves a workspace path alias', () => {
    assert.equal(
      resolveSpecifier('@hyperfrontend/testing', HOOKS_URL, createContext()),
      pathToFileURL(`${WORKSPACE_ROOT}/tools/testing/src/index.ts`).href
    )
  })

  it('defers a bare specifier no alias covers', () => {
    assert.equal(resolveSpecifier('node:fs', HOOKS_URL, createContext()), null)
  })

  it('applies a module redirect before anything else', () => {
    assert.equal(
      resolveSpecifier('./paths', HOOKS_URL, createContext('[["^\\\\./paths$","<rootDir>/generation.ts"]]')),
      pathToFileURL(`${HOOKS_DIR}/generation.ts`).href
    )
  })

  it('ignores a redirect whose target does not exist', () => {
    assert.equal(
      resolveSpecifier('./paths', HOOKS_URL, createContext('[["^\\\\./paths$","<rootDir>/absent.ts"]]')),
      pathToFileURL(`${HOOKS_DIR}/paths.ts`).href
    )
  })

  it('ignores a redirect whose pattern does not match', () => {
    assert.equal(
      resolveSpecifier('./paths', HOOKS_URL, createContext('[["^\\\\./other$","<rootDir>/generation.ts"]]')),
      pathToFileURL(`${HOOKS_DIR}/paths.ts`).href
    )
  })
})

describe('toModuleUrl and the module generation', () => {
  it('returns a plain URL at generation zero', () => {
    assert.equal(currentGeneration(), 0)
    assert.equal(toModuleUrl(`${HOOKS_DIR}/paths.ts`), pathToFileURL(`${HOOKS_DIR}/paths.ts`).href)
  })

  it('appends the generation once it advances', () => {
    const generation = advanceGeneration()
    const url = toModuleUrl(`${HOOKS_DIR}/paths.ts`)
    assert.equal(url, `${pathToFileURL(`${HOOKS_DIR}/paths.ts`).href}?__hfGeneration=${generation}`)
  })

  it('advances by one each time', () => {
    const before = currentGeneration()
    assert.equal(advanceGeneration(), before + 1)
  })
})
