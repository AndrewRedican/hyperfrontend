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
  public readonly draw = (): void => {}
  public readonly paint: () => void = () => {}
  private readonly hide = (): void => {}
  public render(): void {}
  private conceal(): void {}
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

/**
 * Rewrites the sub entry and its module so the entry exports one more symbol, stamped later than the read that preceded it.
 *
 * @param workspace - The workspace whose sub entry gains the export.
 */
function addSubExport(workspace: TempWorkspace): void {
  const entry = join(workspace.root, 'libs/alpha/src/sub/index.ts')
  writeFileSync(entry, "export { open } from '../lib/widget'\nexport { sub, added } from './sub'\n")
  writeFileSync(join(workspace.root, 'libs/alpha/src/sub/sub.ts'), 'export function sub(): void {}\nexport function added(): void {}\n')
  // why: a rewrite within the same millisecond keeps the mtime the fingerprint reads, so the file is stamped as plainly newer
  utimesSync(entry, LATER, LATER)
}

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
    })

    it('records the route of a package nested under the utils umbrella', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const index = getDocsTargetIndex(workspace.root, join(workspace.root, 'apps/docs-site'))

      expect(index.packages.get('@acme/beta-utils')?.route).toBe('/docs/libraries/utils/beta/')
    })

    it('reads concrete entry points from the manifest and skips wildcards and package.json', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const alpha = getDocsTargetIndex(workspace.root, join(workspace.root, 'apps/docs-site')).packages.get('@acme/alpha')

      expect([...(alpha?.entries.keys() ?? [])]).toEqual(['', 'sub'])
    })

    it('routes a secondary entry under the package page', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const alpha = getDocsTargetIndex(workspace.root, join(workspace.root, 'apps/docs-site')).packages.get('@acme/alpha')

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
    })

    it('records a name re-exported from outside the package with an unknown kind', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const root = getDocsTargetIndex(workspace.root, join(workspace.root, 'apps/docs-site')).packages.get('@acme/alpha')?.entries.get('')

      expect(root?.symbols.get('external')).toEqual({ name: 'external', kind: 'unknown', members: [], properties: [], methods: [] })
    })

    it.each([
      [
        'Options',
        { name: 'Options', kind: 'interface', members: ['label', 'onDrop', 'send'], properties: ['label', 'onDrop'], methods: [] },
      ],
      ['Mode', { name: 'Mode', kind: 'type', members: ['v3', 'v4', 'none'], properties: [], methods: [] }],
      ['Handle', { name: 'Handle', kind: 'type', members: ['close'], properties: [], methods: [] }],
      [
        'Widget',
        {
          name: 'Widget',
          kind: 'class',
          members: ['size', 'draw', 'paint', 'render'],
          properties: ['size', 'paint'],
          methods: ['draw', 'render'],
        },
      ],
      ['Level', { name: 'Level', kind: 'enum', members: ['Low', 'low', 'High', 'high'], properties: [], methods: [] }],
      ['open', { name: 'open', kind: 'function', members: [], properties: [], methods: [] }],
    ])('records the kind, members and anchored properties of the %s declaration', (name: string, symbol: object) => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const root = getDocsTargetIndex(workspace.root, join(workspace.root, 'apps/docs-site')).packages.get('@acme/alpha')?.entries.get('')

      expect(root?.symbols.get(name)).toEqual(symbol)
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
        methods: [],
      })
    })

    it('maps a symbol name to every entry exporting it', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const index = getDocsTargetIndex(workspace.root, join(workspace.root, 'apps/docs-site'))

      expect(index.symbols.get('open')?.map((hit) => hit.entry.subpath)).toEqual(['', 'sub'])
    })

    it('maps a member name to the declaration carrying it', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const index = getDocsTargetIndex(workspace.root, join(workspace.root, 'apps/docs-site'))

      expect(index.members.get('onDrop')?.map((hit) => `${hit.parent.name}.${hit.member}`)).toEqual(['Options.onDrop'])
    })

    it('indexes a declared function by its source file', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const alpha = getDocsTargetIndex(workspace.root, join(workspace.root, 'apps/docs-site')).packages.get('@acme/alpha')

      expect(alpha?.declarations.get('helper')).toEqual([join(workspace.root, 'libs/alpha/src/lib/widget.ts')])
    })

    it('indexes a declared interface by its source file', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const alpha = getDocsTargetIndex(workspace.root, join(workspace.root, 'apps/docs-site')).packages.get('@acme/alpha')

      expect(alpha?.declarations.get('Internal')).toEqual([join(workspace.root, 'libs/alpha/src/lib/widget.ts')])
    })

    it('leaves a variable out of the declaration index', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const alpha = getDocsTargetIndex(workspace.root, join(workspace.root, 'apps/docs-site')).packages.get('@acme/alpha')

      expect(alpha?.declarations.get('CONSTANT')).toBeUndefined()
    })

    it('leaves a declaration in a spec file out of the declaration index', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const alpha = getDocsTargetIndex(workspace.root, join(workspace.root, 'apps/docs-site')).packages.get('@acme/alpha')

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

    it('returns the same index while nothing it read has changed', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const siteRoot = join(workspace.root, 'apps/docs-site')
      const first = getDocsTargetIndex(workspace.root, siteRoot)

      expect(getDocsTargetIndex(workspace.root, siteRoot)).toBe(first)
    })

    it('rebuilds when a source it read changes', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const siteRoot = join(workspace.root, 'apps/docs-site')
      const first = getDocsTargetIndex(workspace.root, siteRoot)
      addSubExport(workspace)

      expect(getDocsTargetIndex(workspace.root, siteRoot)).not.toBe(first)
    })

    it('indexes the symbol a changed source adds', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const siteRoot = join(workspace.root, 'apps/docs-site')
      getDocsTargetIndex(workspace.root, siteRoot)
      addSubExport(workspace)

      expect(getDocsTargetIndex(workspace.root, siteRoot).packages.get('@acme/alpha')?.entries.get('sub')?.symbols.has('added')).toBe(true)
    })
  })

  describe('packageOfFile', () => {
    it('finds the package a file sits under', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const index = getDocsTargetIndex(workspace.root, join(workspace.root, 'apps/docs-site'))

      expect(packageOfFile(index, join(workspace.root, 'libs/alpha/src/sub/README.md'))?.name).toBe('@acme/alpha')
    })

    it('returns null for a file outside every package', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const index = getDocsTargetIndex(workspace.root, join(workspace.root, 'apps/docs-site'))

      expect(packageOfFile(index, join(workspace.root, 'libs/private/README.md'))).toBeNull()
    })
  })

  describe('entryOfFile', () => {
    it('names the entry whose directory holds the file', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const alpha = getDocsTargetIndex(workspace.root, join(workspace.root, 'apps/docs-site')).packages.get('@acme/alpha')

      expect(alpha && entryOfFile(alpha, join(workspace.root, 'libs/alpha/src/sub/README.md'))?.subpath).toBe('sub')
    })

    it('returns null for a package-level document', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const alpha = getDocsTargetIndex(workspace.root, join(workspace.root, 'apps/docs-site')).packages.get('@acme/alpha')

      expect(alpha && entryOfFile(alpha, join(workspace.root, 'libs/alpha/README.md'))).toBeNull()
    })
  })

  describe('routeExists', () => {
    it.each([
      '/',
      '/docs/libraries/alpha/',
      '/docs/libraries/alpha/sub',
      '/docs/core-concepts/',
      '/docs/guides/first-steps/',
      '/articles/why/',
    ])('accepts the route %s', (route: string) => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const index = getDocsTargetIndex(workspace.root, join(workspace.root, 'apps/docs-site'))

      expect(routeExists(index, route)).toBe(true)
    })

    it.each(['/docs/guides/missing/', '/articles/missing/', '/docs/libraries/gamma/'])('rejects the route %s', (route: string) => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const index = getDocsTargetIndex(workspace.root, join(workspace.root, 'apps/docs-site'))

      expect(routeExists(index, route)).toBe(false)
    })
  })

  describe('markdownOfRoute', () => {
    it.each([
      ['/docs/libraries/alpha/', 'libs/alpha/README.md'],
      ['/docs/libraries/alpha/architecture/', 'libs/alpha/ARCHITECTURE.md'],
      ['/docs/libraries/alpha/sub/', 'libs/alpha/src/sub/README.md'],
      ['/docs/guides/first-steps/', 'apps/docs-site/content/guides/first-steps/guide.md'],
      ['/articles/why', 'apps/docs-site/content/articles/why.md'],
      ['/architecture', 'ARCHITECTURE.md'],
    ])('maps the route %s to %s', (route: string, markdown: string) => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const index = getDocsTargetIndex(workspace.root, join(workspace.root, 'apps/docs-site'))

      expect(markdownOfRoute(index, route)).toBe(join(workspace.root, markdown))
    })

    it.each(['/docs/core-concepts/', '/docs/libraries/alpha/nowhere/'])('maps the route %s to no markdown', (route: string) => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const index = getDocsTargetIndex(workspace.root, join(workspace.root, 'apps/docs-site'))

      expect(markdownOfRoute(index, route)).toBeNull()
    })
  })

  describe('entryOfRoute', () => {
    it('resolves a landing page to its package with no entry', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const index = getDocsTargetIndex(workspace.root, join(workspace.root, 'apps/docs-site'))

      expect(entryOfRoute(index, '/docs/libraries/alpha/')?.entry).toBeNull()
    })

    it('resolves an entry page to its entry', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const index = getDocsTargetIndex(workspace.root, join(workspace.root, 'apps/docs-site'))

      expect(entryOfRoute(index, '/docs/libraries/alpha/sub/')?.entry?.subpath).toBe('sub')
    })

    it('resolves an architecture page to its package with no entry', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const index = getDocsTargetIndex(workspace.root, join(workspace.root, 'apps/docs-site'))

      expect(entryOfRoute(index, '/docs/libraries/alpha/architecture/')?.entry).toBeNull()
    })

    it('returns null for a page outside every package', () => {
      const workspace = createWorkspace()
      resetDocsTargetIndex()
      const index = getDocsTargetIndex(workspace.root, join(workspace.root, 'apps/docs-site'))

      expect(entryOfRoute(index, '/docs/core-concepts/')).toBeNull()
    })
  })

  describe('readRepositoryUrl', () => {
    it('normalises the manifest clone URL to a browsable one', () => {
      const workspace = createWorkspace()

      expect(readRepositoryUrl(workspace.root)).toBe('https://github.com/acme/repo')
    })

    it('reads a string repository field', () => {
      const workspace = manager.create({ files: { 'package.json': stringify({ repository: 'https://github.com/acme/other/' }) } })

      expect(readRepositoryUrl(workspace.root)).toBe('https://github.com/acme/other')
    })

    it('returns null for a manifest without a repository field', () => {
      const bare = manager.create({ files: { 'package.json': stringify({ name: 'bare' }) } })

      expect(readRepositoryUrl(bare.root)).toBeNull()
    })

    it('returns null for a workspace without a manifest', () => {
      const none = manager.create({})

      expect(readRepositoryUrl(none.root)).toBeNull()
    })
  })
})
