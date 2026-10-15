import { posix, resolve } from 'node:path'
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

      expect(result.length).toBeGreaterThan(0)
    })

    it('returns entry points with correct structure', () => {
      const result = discoverEntryPoints(MINIMAL_PROJECT)

      for (const entry of result) {
        expect(entry).toEqual({
          path: expect.any(String),
          type: expect.stringMatching(/^(?:main|app|server|cli|test)$/),
          confidence: expect.any(Number),
        })
      }
    })

    it('keeps every confidence between 0 and 100', () => {
      const result = discoverEntryPoints(MINIMAL_PROJECT)

      const outOfRange = result.map((e) => e.confidence).filter((confidence) => confidence < 0 || confidence > 100)
      expect(outOfRange).toEqual([])
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
      expect(indexEntry?.type).toBe('main')
    })

    it('detects main field from package.json', () => {
      const result = discoverEntryPoints(MINIMAL_PROJECT)

      expect(result.find((e) => e.path === 'src/main.js')).toEqual({ path: 'src/main.js', type: 'main', confidence: 100 })
    })
  })

  describe('options', () => {
    it('respects includeFrameworkEntries option', () => {
      for (const includeFrameworkEntries of [true, false]) {
        expect(discoverEntryPoints(MINIMAL_PROJECT, { includeFrameworkEntries })).toEqual(expect.any(Array))
      }
    })

    it('respects maxDepth option', () => {
      for (const maxDepth of [1, 10]) {
        expect(discoverEntryPoints(MINIMAL_PROJECT, { maxDepth })).toEqual(expect.any(Array))
      }
    })

    it('respects skipCache option', () => {
      const result1 = discoverEntryPoints(MINIMAL_PROJECT)
      const result2 = discoverEntryPoints(MINIMAL_PROJECT)
      const result3 = discoverEntryPoints(MINIMAL_PROJECT, { skipCache: true })

      expect({ cached: result2, fresh: result3 }).toEqual({ cached: result1, fresh: result1 })
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

      expect(result.find((e) => e.path === 'dist/index.mjs')).toEqual({ path: 'dist/index.mjs', type: 'main', confidence: 100 })
    })

    it('detects browser field from package.json', () => {
      const result = discoverEntryPoints(LIBRARY_WITH_EXPORTS)

      expect(result.find((e) => e.path === 'dist/browser.js')).toEqual({ path: 'dist/browser.js', type: 'main', confidence: 95 })
    })

    it('detects bin field entries from package.json (object format)', () => {
      const result = discoverEntryPoints(LIBRARY_WITH_EXPORTS)

      const cliEntry = result.find((e) => e.path === 'bin/cli.js')
      const toolEntry = result.find((e) => e.path === 'bin/tool.js')
      expect([cliEntry, toolEntry]).toEqual([expect.objectContaining({ type: 'cli' }), expect.objectContaining({ type: 'cli' })])
    })

    it('detects exports field with string values', () => {
      const result = discoverEntryPoints(LIBRARY_WITH_EXPORTS)

      const utilsEntry = result.find((e) => e.path === './dist/utils.js')
      expect(utilsEntry?.type).toBe('main')
    })

    it('detects exports field with conditional exports', () => {
      const result = discoverEntryPoints(LIBRARY_WITH_EXPORTS)

      const helpersEntry = result.find((e) => e.path === './dist/helpers.mjs')
      expect(helpersEntry?.type).toBe('main')
    })
  })

  describe('with library-with-bin-string fixture', () => {
    it('detects bin field as string from package.json', () => {
      const result = discoverEntryPoints(LIBRARY_WITH_BIN_STRING)

      expect(result.find((e) => e.path === './bin/cli.js')).toEqual({ path: './bin/cli.js', type: 'cli', confidence: 100 })
    })
  })

  describe('with entry-file-only fixture', () => {
    it('discovers convention-based entry points at root', () => {
      const result = discoverEntryPoints(ENTRY_FILE_ONLY)

      const indexEntry = result.find((e) => e.path === 'index.ts')
      expect(indexEntry?.type).toBe('main')
    })
  })

  describe('framework-specific entries', () => {
    describe('Next.js pages directory', () => {
      it('discovers page entries', () => {
        const result = discoverEntryPoints(NEXTJS_APP, { includeFrameworkEntries: true })

        const pageEntries = result.filter((e) => e.path.includes(`pages${posix.sep}`))
        expect(pageEntries.length).toBeGreaterThan(0)
      })

      it('excludes _app from page entries', () => {
        const result = discoverEntryPoints(NEXTJS_APP, { includeFrameworkEntries: true })

        const pageEntries = result.filter((e) => e.path.includes(`pages${posix.sep}`))
        expect(pageEntries.find((e) => e.path.includes('_app'))).toBeUndefined()
      })

      it('excludes api routes from page entries', () => {
        const result = discoverEntryPoints(NEXTJS_APP, { includeFrameworkEntries: true })

        const pageEntries = result.filter((e) => e.path.includes(`pages${posix.sep}`))
        expect(pageEntries.find((e) => e.path.includes(`api${posix.sep}`))).toBeUndefined()
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

        const pageEntries = result.filter((e) => e.path.includes(`pages${posix.sep}`))
        expect(pageEntries.length).toBe(0)
      })
    })
  })
})

describe('ENTRY_POINT_PATTERNS', () => {
  it('has library patterns', () => {
    expect(ENTRY_POINT_PATTERNS.library).toEqual(expect.arrayContaining(['src/index.ts', 'src/index.js', 'index.ts']))
  })

  it('has application patterns', () => {
    expect(ENTRY_POINT_PATTERNS.application).toEqual(expect.arrayContaining(['src/main.ts', 'src/main.tsx']))
  })

  it('has server patterns', () => {
    expect(ENTRY_POINT_PATTERNS.server).toEqual(expect.arrayContaining(['src/server.ts', 'server.ts']))
  })

  it('has cli patterns', () => {
    expect(ENTRY_POINT_PATTERNS.cli).toEqual(expect.arrayContaining(['src/cli.ts', 'bin/cli.ts', 'cli.ts']))
  })
})
