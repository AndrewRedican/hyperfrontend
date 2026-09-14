import type { TempWorkspace } from '../testing'
import { utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { after as afterAll } from 'node:test'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempWorkspaceManager } from '../testing'
import {
  entryOfFile,
  entryOfRoute,
  getDocsTargetIndex,
  markdownOfRoute,
  packageOfFile,
  packageRoute,
  readRepositoryUrl,
  resetDocsTargetIndex,
  routeExists,
} from './docs-targets'

const manager = createTempWorkspaceManager()

afterAll(() => {
  manager.cleanupAll()
})

/** A publishable library manifest. */
const PUBLISHABLE = { projectType: 'library', targets: { build: {}, publish: {} } }

/** The entry file of the example package's root entry. */
const ROOT_ENTRY = `/**
 * Root.
 *
 * @module @acme/alpha
 */
export type { Options, Mode, Handle } from './shared/types'
export { CODES } from './shared/codes'
export { open, Widget } from './lib/widget'
export { external } from 'somewhere-else'
export * from './lib/extras'
`

/** The shared type declarations the root entry re-exports. */
const SHARED_TYPES = `export interface Options {
  /** The label. */
  label: string
  /** Fired on drop. */
  onDrop?: (reason: string) => void
  /** A method signature, which is not a property. */
  send(payload: unknown): void
}
export type Mode = 'v3' | 'v4' | ('none' | undefined)
export type Handle = Options & { close(): void }
`

/**
 * Lays out a workspace with one publishable package, one private one, and a
 * documentation site publishing pages for the package and its entry.
 *
 * @returns The temporary workspace, cleaned up after the file's tests.
 */
function createWorkspace(): TempWorkspace {
  return manager.create({
    files: {
      'nx.json': '{}',
      'package.json': stringify({ name: 'workspace', repository: { url: 'git+https://github.com/acme/repo.git' } }),
      'libs/alpha/project.json': stringify(PUBLISHABLE),
      'libs/alpha/package.json': stringify({
        name: '@acme/alpha',
        exports: {
          '.': './src/index.js',
          './sub': { import: './src/sub/index.js', require: './src/sub/index.cjs' },
          './package.json': './package.json',
          './internal/*': './src/internal/*.js',
          './data': './data.json',
        },
      }),
      'libs/alpha/src/index.ts': ROOT_ENTRY,
      'libs/alpha/src/shared/types.ts': SHARED_TYPES,
      'libs/alpha/src/shared/codes.ts': "export const CODES = freeze({ Replayed: 'replayed', Malformed: 'malformed' } as const)\n",
      'libs/alpha/src/lib/widget.ts': `export function open(): void {}
export class Widget {
  public readonly size = 1
  private readonly secret = 2
  #hidden = 3
  public render(): void {}
}
function helper(): void {}
interface Internal { a: number }
const CONSTANT = 1
`,
      'libs/alpha/src/lib/extras.ts': "export const extra = 1\nexport enum Level { Low = 'low', High = 'high' }\n",
      'libs/alpha/src/sub/index.ts': "export { open } from '../lib/widget'\nexport { sub } from './sub'\n",
      'libs/alpha/src/sub/sub.ts': 'export function sub(): void {}\n',
      'libs/alpha/src/sub/README.md': '# sub\n',
      'libs/alpha/src/lib/widget.spec.ts': 'export function specOnly(): void {}\n',
      'libs/alpha/README.md': '# @acme/alpha\n',
      'libs/alpha/ARCHITECTURE.md': '# Architecture\n',
      'libs/utils/beta/project.json': stringify(PUBLISHABLE),
      'libs/utils/beta/package.json': stringify({ name: '@acme/beta-utils', exports: { '.': './src/index.js' } }),
      'libs/utils/beta/src/index.ts': 'export function beta(): void {}\n',
      'libs/private/project.json': stringify({ projectType: 'library', targets: { build: {} } }),
      'libs/private/package.json': stringify({ name: '@acme/private', exports: { '.': './src/index.js' } }),
      'libs/private/src/index.ts': 'export function hidden(): void {}\n',
      'apps/docs-site/src/app/docs/libraries/alpha/page.tsx': '',
      'apps/docs-site/src/app/docs/libraries/alpha/sub/page.tsx': '',
      'apps/docs-site/src/app/docs/libraries/alpha/architecture/page.tsx': '',
      'apps/docs-site/src/app/docs/libraries/utils/beta/page.tsx': '',
      'apps/docs-site/src/app/docs/guides/[slug]/page.tsx': '',
      'apps/docs-site/src/app/articles/[slug]/page.tsx': '',
      'apps/docs-site/src/app/docs/core-concepts/page.tsx': '',
      'apps/docs-site/content/guides/first-steps/guide.md': '# First steps\n',
      'apps/docs-site/content/articles/why.md': '# Why\n',
    },
  })
}

/** Project manifest of the example package with bundle globals declared. */
const BUNDLED_PROJECT = {
  ...PUBLISHABLE,
  targets: {
    ...PUBLISHABLE.targets,
    build: { options: { iife: [{ entry: './sub', globalName: 'AcmeAlphaSub' }], umd: { entry: '.', globalName: 'AcmeAlpha' } } },
  },
}

/** A moment well past any file the tests write, so a rewrite is seen as newer than the read that preceded it. */
const LATER = 4102444800

describe('docs-targets', () => {
  describe('packageRoute', () => {
    it('routes a top-level package under the libraries index', () => {
      expect(packageRoute('/ws', '/ws/libs/alpha')).toBe('/docs/libraries/alpha/')
    })

    it('routes a utility package under the utils umbrella', () => {
      expect(packageRoute('/ws', '/ws/libs/utils/beta')).toBe('/docs/libraries/utils/beta/')
    })
  })

  describe('getDocsTargetIndex', () => {
    it('indexes every publishable package and none of the private ones', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const index = getDocsTargetIndex(workspace.root, join(workspace.root, 'apps/docs-site'))

      expect([...index.packages.keys()].sort()).toEqual(['@acme/alpha', '@acme/beta-utils'])
      expect(index.packages.get('@acme/beta-utils')?.route).toBe('/docs/libraries/utils/beta/')
    })

    it('reads concrete entry points from the manifest and skips wildcards and package.json', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const alpha = getDocsTargetIndex(workspace.root, join(workspace.root, 'apps/docs-site')).packages.get('@acme/alpha')

      expect([...(alpha?.entries.keys() ?? [])]).toEqual(['', 'sub'])
      expect(alpha?.entries.get('sub')?.route).toBe('/docs/libraries/alpha/sub/')
    })

    it('collects named re-exports, local exports and star re-exports of an entry', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const root = getDocsTargetIndex(workspace.root, join(workspace.root, 'apps/docs-site')).packages.get('@acme/alpha')?.entries.get('')

      expect([...(root?.symbols.keys() ?? [])].sort()).toEqual([
        'CODES',
        'Handle',
        'Level',
        'Mode',
        'Options',
        'Widget',
        'external',
        'extra',
        'open',
      ])
      expect(root?.symbols.get('external')).toEqual({ name: 'external', kind: 'unknown', members: [], properties: [] })
    })

    it('records the kind, members and anchored properties of each declaration', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const root = getDocsTargetIndex(workspace.root, join(workspace.root, 'apps/docs-site')).packages.get('@acme/alpha')?.entries.get('')

      expect(root?.symbols.get('Options')).toEqual({
        name: 'Options',
        kind: 'interface',
        members: ['label', 'onDrop', 'send'],
        properties: ['label', 'onDrop'],
      })
      expect(root?.symbols.get('Mode')).toEqual({ name: 'Mode', kind: 'type', members: ['v3', 'v4', 'none'], properties: [] })
      expect(root?.symbols.get('Handle')).toEqual({ name: 'Handle', kind: 'type', members: ['close'], properties: [] })
      expect(root?.symbols.get('Widget')).toEqual({ name: 'Widget', kind: 'class', members: ['size', 'render'], properties: ['size'] })
      expect(root?.symbols.get('Level')).toEqual({ name: 'Level', kind: 'enum', members: ['Low', 'low', 'High', 'high'], properties: [] })
      expect(root?.symbols.get('open')).toEqual({ name: 'open', kind: 'function', members: [], properties: [] })
    })

    it('reads a frozen code map by its keys and its string values', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const root = getDocsTargetIndex(workspace.root, join(workspace.root, 'apps/docs-site')).packages.get('@acme/alpha')?.entries.get('')

      expect(root?.symbols.get('CODES')).toEqual({
        name: 'CODES',
        kind: 'variable',
        members: ['Replayed', 'replayed', 'Malformed', 'malformed'],
        properties: [],
      })
    })

    it('maps every symbol and member name to the entries carrying it', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const index = getDocsTargetIndex(workspace.root, join(workspace.root, 'apps/docs-site'))

      expect(index.symbols.get('open')?.map((hit) => hit.entry.subpath)).toEqual(['', 'sub'])
      expect(index.members.get('onDrop')?.map((hit) => `${hit.parent.name}.${hit.member}`)).toEqual(['Options.onDrop'])
    })

    it('indexes declared functions, classes, interfaces, types and enums but not variables or tests', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const alpha = getDocsTargetIndex(workspace.root, join(workspace.root, 'apps/docs-site')).packages.get('@acme/alpha')

      expect(alpha?.declarations.get('helper')).toEqual([join(workspace.root, 'libs/alpha/src/lib/widget.ts')])
      expect(alpha?.declarations.get('Internal')).toEqual([join(workspace.root, 'libs/alpha/src/lib/widget.ts')])
      expect(alpha?.declarations.get('CONSTANT')).toBeUndefined()
      expect(alpha?.declarations.get('specOnly')).toBeUndefined()
    })

    it('reads bundle globals from the project manifest', () => {
      const workspace = createWorkspace()
      workspace.writeJsonFile('libs/alpha/project.json', BUNDLED_PROJECT)
      resetDocsTargetIndex()
      const alpha = getDocsTargetIndex(workspace.root, join(workspace.root, 'apps/docs-site')).packages.get('@acme/alpha')

      expect([...(alpha?.globals.entries() ?? [])]).toEqual([
        ['AcmeAlphaSub', 'sub'],
        ['AcmeAlpha', ''],
      ])
    })

    it('rebuilds when a source it read changes, and not otherwise', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const siteRoot = join(workspace.root, 'apps/docs-site')
      const first = getDocsTargetIndex(workspace.root, siteRoot)

      expect(getDocsTargetIndex(workspace.root, siteRoot)).toBe(first)

      const entry = join(workspace.root, 'libs/alpha/src/sub/index.ts')
      writeFileSync(entry, "export { open } from '../lib/widget'\nexport { sub, added } from './sub'\n")
      writeFileSync(join(workspace.root, 'libs/alpha/src/sub/sub.ts'), 'export function sub(): void {}\nexport function added(): void {}\n')
      // why: a rewrite within the same millisecond keeps the mtime the fingerprint reads, so the file is stamped as plainly newer
      utimesSync(entry, LATER, LATER)

      const second = getDocsTargetIndex(workspace.root, siteRoot)
      expect(second).not.toBe(first)
      expect(second.packages.get('@acme/alpha')?.entries.get('sub')?.symbols.has('added')).toBe(true)
    })
  })

  describe('packageOfFile', () => {
    it('finds the package a file sits under and null for a file outside every package', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const index = getDocsTargetIndex(workspace.root, join(workspace.root, 'apps/docs-site'))

      expect(packageOfFile(index, join(workspace.root, 'libs/alpha/src/sub/README.md'))?.name).toBe('@acme/alpha')
      expect(packageOfFile(index, join(workspace.root, 'libs/private/README.md'))).toBeNull()
    })
  })

  describe('entryOfFile', () => {
    it('names the entry whose directory holds the file and null for a package-level document', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const alpha = getDocsTargetIndex(workspace.root, join(workspace.root, 'apps/docs-site')).packages.get('@acme/alpha')

      expect(alpha && entryOfFile(alpha, join(workspace.root, 'libs/alpha/src/sub/README.md'))?.subpath).toBe('sub')
      expect(alpha && entryOfFile(alpha, join(workspace.root, 'libs/alpha/README.md'))).toBeNull()
    })
  })

  describe('routeExists', () => {
    it('accepts the root, static pages, guides and articles with content, and nothing else', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const index = getDocsTargetIndex(workspace.root, join(workspace.root, 'apps/docs-site'))

      expect(routeExists(index, '/')).toBe(true)
      expect(routeExists(index, '/docs/libraries/alpha/')).toBe(true)
      expect(routeExists(index, '/docs/libraries/alpha/sub')).toBe(true)
      expect(routeExists(index, '/docs/core-concepts/')).toBe(true)
      expect(routeExists(index, '/docs/guides/first-steps/')).toBe(true)
      expect(routeExists(index, '/docs/guides/missing/')).toBe(false)
      expect(routeExists(index, '/articles/why/')).toBe(true)
      expect(routeExists(index, '/articles/missing/')).toBe(false)
      expect(routeExists(index, '/docs/libraries/gamma/')).toBe(false)
    })
  })

  describe('markdownOfRoute', () => {
    it('maps package, architecture, entry, guide, article and root document routes to their markdown', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const index = getDocsTargetIndex(workspace.root, join(workspace.root, 'apps/docs-site'))

      expect(markdownOfRoute(index, '/docs/libraries/alpha/')).toBe(join(workspace.root, 'libs/alpha/README.md'))
      expect(markdownOfRoute(index, '/docs/libraries/alpha/architecture/')).toBe(join(workspace.root, 'libs/alpha/ARCHITECTURE.md'))
      expect(markdownOfRoute(index, '/docs/libraries/alpha/sub/')).toBe(join(workspace.root, 'libs/alpha/src/sub/README.md'))
      expect(markdownOfRoute(index, '/docs/guides/first-steps/')).toBe(
        join(workspace.root, 'apps/docs-site/content/guides/first-steps/guide.md')
      )
      expect(markdownOfRoute(index, '/articles/why')).toBe(join(workspace.root, 'apps/docs-site/content/articles/why.md'))
      expect(markdownOfRoute(index, '/architecture')).toBe(join(workspace.root, 'ARCHITECTURE.md'))
      expect(markdownOfRoute(index, '/docs/core-concepts/')).toBeNull()
      expect(markdownOfRoute(index, '/docs/libraries/alpha/nowhere/')).toBeNull()
    })
  })

  describe('entryOfRoute', () => {
    it('resolves a landing page to its package and an entry page to its entry', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const index = getDocsTargetIndex(workspace.root, join(workspace.root, 'apps/docs-site'))

      expect(entryOfRoute(index, '/docs/libraries/alpha/')?.entry).toBeNull()
      expect(entryOfRoute(index, '/docs/libraries/alpha/sub/')?.entry?.subpath).toBe('sub')
      expect(entryOfRoute(index, '/docs/libraries/alpha/architecture/')?.entry).toBeNull()
      expect(entryOfRoute(index, '/docs/core-concepts/')).toBeNull()
    })
  })

  describe('readRepositoryUrl', () => {
    it('normalises the manifest clone URL to a browsable one', () => {
      const workspace = createWorkspace()

      expect(readRepositoryUrl(workspace.root)).toBe('https://github.com/acme/repo')
    })

    it('reads a string repository field and returns null for a manifest without one', () => {
      const workspace = manager.create({ files: { 'package.json': stringify({ repository: 'https://github.com/acme/other/' }) } })
      const bare = manager.create({ files: { 'package.json': stringify({ name: 'bare' }) } })
      const none = manager.create({})

      expect(readRepositoryUrl(workspace.root)).toBe('https://github.com/acme/other')
      expect(readRepositoryUrl(bare.root)).toBeNull()
      expect(readRepositoryUrl(none.root)).toBeNull()
    })
  })
})
