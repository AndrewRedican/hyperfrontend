import { resolve } from 'node:path'
import { beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { discoverEntryPoints, clearEntryPointCache, ENTRY_POINT_PATTERNS } from './discover'

const FIXTURES_DIR = resolve(import.meta.dirname, '../../../__fixtures__')
const MINIMAL_PROJECT = resolve(FIXTURES_DIR, 'minimal-project')
const LIBRARY_WITH_EXPORTS = resolve(FIXTURES_DIR, 'library-with-exports')
const LIBRARY_WITH_BIN_STRING = resolve(FIXTURES_DIR, 'library-with-bin-string')
const NEXTJS_APP = resolve(FIXTURES_DIR, 'nextjs-app')
const NEXTJS_APP_ROUTER = resolve(FIXTURES_DIR, 'nextjs-app-router')
const ANGULAR_APP = resolve(FIXTURES_DIR, 'angular-app')
const SVELTEKIT_APP = resolve(FIXTURES_DIR, 'sveltekit-app')
const ENTRY_FILE_ONLY = resolve(FIXTURES_DIR, 'entry-file-only')

describe('discoverEntryPoints', () => {
  beforeEach(() => {
    clearEntryPointCache()
  })

  describe('with non-existent path', () => {
    it('returns empty array', () => {
      const result = discoverEntryPoints('/non/existent/path')

      expect(result).toEqual([])
    })
  })

  describe('with minimal-project fixture', () => {
    it('discovers entry points', () => {
      const result = discoverEntryPoints(MINIMAL_PROJECT)

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
    })

    it('returns entry points with correct structure', () => {
      const result = discoverEntryPoints(MINIMAL_PROJECT)

      for (const entry of result) {
        expect(typeof entry.path).toBe('string')
        expect(['main', 'app', 'server', 'cli', 'test']).toContain(entry.type)
        expect(typeof entry.confidence).toBe('number')
        expect(entry.confidence).toBeGreaterThanOrEqual(0)
        expect(entry.confidence).toBeLessThanOrEqual(100)
      }
    })

    it('sorts by confidence descending', () => {
      const result = discoverEntryPoints(MINIMAL_PROJECT)

      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].confidence).toBeGreaterThanOrEqual(result[i].confidence)
      }
    })

    it('detects src/index.ts as main entry', () => {
      const result = discoverEntryPoints(MINIMAL_PROJECT)

      const indexEntry = result.find((e) => e.path === 'src/index.ts')
      expect(indexEntry).toBeDefined()
      expect(indexEntry?.type).toBe('main')
    })

    it('detects main field from package.json', () => {
      const result = discoverEntryPoints(MINIMAL_PROJECT)

      const mainEntry = result.find((e) => e.path === 'src/main.js')
      expect(mainEntry).toBeDefined()
      expect(mainEntry?.type).toBe('main')
      expect(mainEntry?.confidence).toBe(100)
    })
  })

  describe('options', () => {
    it('respects includeFrameworkEntries option', () => {
      const withFramework = discoverEntryPoints(MINIMAL_PROJECT, { includeFrameworkEntries: true })
      const withoutFramework = discoverEntryPoints(MINIMAL_PROJECT, { includeFrameworkEntries: false })

      expect(Array.isArray(withFramework)).toBe(true)
      expect(Array.isArray(withoutFramework)).toBe(true)
    })

    it('respects maxDepth option', () => {
      const shallow = discoverEntryPoints(MINIMAL_PROJECT, { maxDepth: 1 })
      const deep = discoverEntryPoints(MINIMAL_PROJECT, { maxDepth: 10 })

      expect(Array.isArray(shallow)).toBe(true)
      expect(Array.isArray(deep)).toBe(true)
    })

    it('respects skipCache option', () => {
      const result1 = discoverEntryPoints(MINIMAL_PROJECT)
      const result2 = discoverEntryPoints(MINIMAL_PROJECT)
      const result3 = discoverEntryPoints(MINIMAL_PROJECT, { skipCache: true })

      expect(result1).toEqual(result2)
      expect(result1).toEqual(result3)
    })

    it('uses cached results on subsequent calls', () => {
      const result1 = discoverEntryPoints(MINIMAL_PROJECT)
      const result2 = discoverEntryPoints(MINIMAL_PROJECT)

      expect(result1).toEqual(result2)
    })
  })

  describe('deduplication', () => {
    it('does not return duplicate paths', () => {
      const result = discoverEntryPoints(MINIMAL_PROJECT)

      const paths = result.map((e) => e.path)
      const uniquePaths = [...new Set(paths)]
      expect(paths.length).toBe(uniquePaths.length)
    })
  })

  describe('with library-with-exports fixture', () => {
    it('detects module field from package.json', () => {
      const result = discoverEntryPoints(LIBRARY_WITH_EXPORTS)

      const moduleEntry = result.find((e) => e.path === 'dist/index.mjs')
      expect(moduleEntry).toBeDefined()
      expect(moduleEntry?.type).toBe('main')
      expect(moduleEntry?.confidence).toBe(100)
    })

    it('detects browser field from package.json', () => {
      const result = discoverEntryPoints(LIBRARY_WITH_EXPORTS)

      const browserEntry = result.find((e) => e.path === 'dist/browser.js')
      expect(browserEntry).toBeDefined()
      expect(browserEntry?.type).toBe('main')
      expect(browserEntry?.confidence).toBe(95)
    })

    it('detects bin field entries from package.json (object format)', () => {
      const result = discoverEntryPoints(LIBRARY_WITH_EXPORTS)

      const cliEntry = result.find((e) => e.path === 'bin/cli.js')
      const toolEntry = result.find((e) => e.path === 'bin/tool.js')
      expect(cliEntry).toBeDefined()
      expect(cliEntry?.type).toBe('cli')
      expect(toolEntry).toBeDefined()
      expect(toolEntry?.type).toBe('cli')
    })

    it('detects exports field with string values', () => {
      const result = discoverEntryPoints(LIBRARY_WITH_EXPORTS)

      const utilsEntry = result.find((e) => e.path === './dist/utils.js')
      expect(utilsEntry).toBeDefined()
      expect(utilsEntry?.type).toBe('main')
    })

    it('detects exports field with conditional exports', () => {
      const result = discoverEntryPoints(LIBRARY_WITH_EXPORTS)

      const helpersEntry = result.find((e) => e.path === './dist/helpers.mjs')
      expect(helpersEntry).toBeDefined()
      expect(helpersEntry?.type).toBe('main')
    })
  })

  describe('with library-with-bin-string fixture', () => {
    it('detects bin field as string from package.json', () => {
      const result = discoverEntryPoints(LIBRARY_WITH_BIN_STRING)

      const cliEntry = result.find((e) => e.path === './bin/cli.js')
      expect(cliEntry).toBeDefined()
      expect(cliEntry?.type).toBe('cli')
      expect(cliEntry?.confidence).toBe(100)
    })
  })

  describe('with entry-file-only fixture', () => {
    it('discovers convention-based entry points at root', () => {
      const result = discoverEntryPoints(ENTRY_FILE_ONLY)

      const indexEntry = result.find((e) => e.path === 'index.ts')
      expect(indexEntry).toBeDefined()
      expect(indexEntry?.type).toBe('main')
    })
  })

  describe('framework-specific entries', () => {
    describe('Next.js pages directory', () => {
      it('discovers page entries excluding _app, _document, and api routes', () => {
        const result = discoverEntryPoints(NEXTJS_APP, { includeFrameworkEntries: true })

        const pageEntries = result.filter((e) => e.path.includes('pages/'))
        const appEntry = pageEntries.find((e) => e.path.includes('_app'))
        const apiEntry = pageEntries.find((e) => e.path.includes('api/'))

        expect(pageEntries.length).toBeGreaterThan(0)
        expect(appEntry).toBeUndefined()
        expect(apiEntry).toBeUndefined()
      })
    })

    describe('Next.js app directory', () => {
      it('discovers page.tsx entries in app directory', () => {
        const result = discoverEntryPoints(NEXTJS_APP_ROUTER, { includeFrameworkEntries: true })

        const pageEntries = result.filter((e) => e.path.includes('page.tsx'))
        expect(pageEntries.length).toBeGreaterThan(0)
      })
    })

    describe('Angular app', () => {
      it('discovers Angular main.ts entry point', () => {
        const result = discoverEntryPoints(ANGULAR_APP, { includeFrameworkEntries: true })

        const angularEntry = result.find((e) => e.path === 'src/main.ts')
        expect(angularEntry).toBeDefined()
        expect(angularEntry?.type).toBe('app')
      })
    })

    describe('SvelteKit app', () => {
      it('discovers SvelteKit route entries', () => {
        const result = discoverEntryPoints(SVELTEKIT_APP, { includeFrameworkEntries: true })

        const routeEntries = result.filter((e) => e.path.includes('+page.svelte'))
        expect(routeEntries.length).toBeGreaterThan(0)
      })
    })

    describe('with framework entries disabled', () => {
      it('does not include framework-specific entries', () => {
        const result = discoverEntryPoints(NEXTJS_APP, { includeFrameworkEntries: false })

        const pageEntries = result.filter((e) => e.path.includes('pages/'))
        expect(pageEntries.length).toBe(0)
      })
    })
  })
})

describe('ENTRY_POINT_PATTERNS', () => {
  it('has library patterns', () => {
    expect(ENTRY_POINT_PATTERNS.library).toContain('src/index.ts')
    expect(ENTRY_POINT_PATTERNS.library).toContain('src/index.js')
    expect(ENTRY_POINT_PATTERNS.library).toContain('index.ts')
  })

  it('has application patterns', () => {
    expect(ENTRY_POINT_PATTERNS.application).toContain('src/main.ts')
    expect(ENTRY_POINT_PATTERNS.application).toContain('src/main.tsx')
  })

  it('has server patterns', () => {
    expect(ENTRY_POINT_PATTERNS.server).toContain('src/server.ts')
    expect(ENTRY_POINT_PATTERNS.server).toContain('server.ts')
  })

  it('has cli patterns', () => {
    expect(ENTRY_POINT_PATTERNS.cli).toContain('src/cli.ts')
    expect(ENTRY_POINT_PATTERNS.cli).toContain('bin/cli.ts')
    expect(ENTRY_POINT_PATTERNS.cli).toContain('cli.ts')
  })
})
