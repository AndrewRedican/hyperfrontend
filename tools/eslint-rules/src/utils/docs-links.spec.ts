import type { TempWorkspace } from '../testing'
import type { LinkOrigins } from './docs-links'
import type { DocsTargetIndex } from './docs-targets'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { after as afterAll } from 'node:test'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempWorkspaceManager } from '../testing'
import { headingAnchors, headingSlug, validateLink } from './docs-link-validation'
import { exemptionOf } from './docs-link-values'
import { resolveCodeMention } from './docs-links'
import { getDocsTargetIndex, resetDocsTargetIndex } from './docs-targets'

const manager = createTempWorkspaceManager()

afterAll(() => {
  manager.cleanupAll()
})

/** A publishable library manifest. */
const PUBLISHABLE = { projectType: 'library', targets: { build: {}, publish: {} } }

/** The site and repository every expected URL is published under. */
const ORIGINS: LinkOrigins = { siteUrl: 'https://docs.example', repoUrl: 'https://github.com/acme/repo' }

/** The site root under the workspace. */
const SITE = '/docs/libraries'

/**
 * Lays out two packages whose exports overlap in the ways the resolver has to
 * tell apart: a root entry, a secondary entry, browser and node twins, a
 * defaults constant beside its interface, and a sibling package with names
 * of its own.
 *
 * @returns The temporary workspace, cleaned up after the file's tests.
 */
function createWorkspace(): TempWorkspace {
  return manager.create({
    files: {
      'nx.json': '{}',
      'package.json': stringify({ name: 'workspace' }),
      'libs/alpha/project.json': stringify({
        ...PUBLISHABLE,
        targets: { ...PUBLISHABLE.targets, build: { options: { umd: { entry: './host', globalName: 'AlphaHost' } } } },
      }),
      'libs/alpha/package.json': stringify({
        name: '@acme/alpha',
        exports: {
          '.': './src/index.js',
          './host': './src/host/index.js',
          './browser/channel': './src/browser/channel/index.js',
          './node/channel': './src/node/channel/index.js',
          './deep/nested': './src/deep/nested/index.js',
        },
      }),
      'libs/alpha/src/index.ts': `export type { Options, Mode } from './shared/types'
export { DEFAULT_OPTIONS } from './shared/types'
export { Store } from './shared/store'
export { validate } from './shared/validate'
export { nested } from './deep/nested/index'
`,
      'libs/alpha/src/shared/types.ts': `export interface Options {
  onDrop?: () => void
  send(payload: unknown): void
  status: string
}
export type Mode = 'v3' | 'v4'
export const DEFAULT_OPTIONS = { onDrop: undefined, status: 'idle' }
`,
      'libs/alpha/src/shared/validate.ts': 'export function validate(): void {}\n',
      'libs/alpha/src/shared/store.ts': `export class Store {
  readonly subscribe = (listener: () => void): (() => void) => listener
  state = 'idle'
  dispatch(): void {}
}
`,
      'libs/alpha/src/host/index.ts': "export { createShell } from './create-shell'\nexport type { ShellHandle } from './create-shell'\n",
      'libs/alpha/src/host/create-shell.ts': `export interface ShellHandle {
  open(): void
  readonly isOpen: boolean
}
export function createShell(): ShellHandle {
  return { open() {}, isOpen: false }
}
function handleRequest(): void {}
`,
      'libs/alpha/src/host/README.md': '# Host\n\n## Usage\n',
      'libs/alpha/src/browser/channel/index.ts':
        "export { createChannel } from '../../lib/channel'\nexport type { Channel } from '../../lib/channel'\n",
      'libs/alpha/src/node/channel/index.ts':
        "export { createChannel } from '../../lib/channel'\nexport type { Channel } from '../../lib/channel'\n",
      'libs/alpha/src/lib/channel.ts': `export interface Channel {
  readonly outbound: number
}
export function createChannel(): Channel {
  return { outbound: 0 }
}
`,
      'libs/alpha/src/lib/channel/README.md': '# Channel module\n',
      'libs/alpha/src/lib/server/twice.ts': 'export function twice(): void {}\n',
      'libs/alpha/src/lib/other/twice.ts': 'export function twice(): void {}\n',
      'libs/alpha/src/deep/nested/index.ts': 'export function nested(): void {}\n',
      'libs/alpha/README.md': '# @acme/alpha\n\n## Quick Start\n\n## Quick Start\n\n```bash\n# not a heading\n```\n',
      'libs/alpha/ARCHITECTURE.md': '# Architecture\n\n## Data Flow\n',
      'libs/beta/project.json': stringify(PUBLISHABLE),
      'libs/beta/package.json': stringify({ name: '@acme/beta', exports: { '.': './src/index.js' } }),
      'libs/beta/src/index.ts': "export { logger, validate } from './logger'\nexport type { Logger } from './logger'\n",
      'libs/beta/src/logger.ts': `export interface Logger {
  channel: string
}
export const logger: Logger = { channel: 'root' }
export function validate(): void {}
`,
      'libs/beta/README.md': '# @acme/beta\n',
      'apps/docs-site/src/app/docs/libraries/alpha/page.tsx': '',
      'apps/docs-site/src/app/docs/libraries/alpha/host/page.tsx': '',
      'apps/docs-site/src/app/docs/libraries/alpha/channel/page.tsx': '',
      'apps/docs-site/src/app/docs/libraries/alpha/browser/channel/page.tsx': '',
      'apps/docs-site/src/app/docs/libraries/alpha/node/channel/page.tsx': '',
      'apps/docs-site/src/app/docs/libraries/alpha/deep/nested/page.tsx': '',
      'apps/docs-site/src/app/docs/libraries/alpha/architecture/page.tsx': '',
      'apps/docs-site/src/app/docs/libraries/beta/page.tsx': '',
      'apps/docs-site/src/app/docs/core-concepts/page.tsx': '',
      'apps/docs-site/src/app/docs/guides/[slug]/page.tsx': '',
      'apps/docs-site/content/guides/first-steps/guide.md': '# First steps\n\n## Install it\n',
    },
  })
}

/**
 * Builds the index of a fresh workspace.
 *
 * @returns The workspace and its index.
 */
function setUp(): { workspace: TempWorkspace; index: DocsTargetIndex; readme: string; hostReadme: string } {
  const workspace = createWorkspace()
  resetDocsTargetIndex()
  const index = getDocsTargetIndex(workspace.root, join(workspace.root, 'apps/docs-site'))
  return {
    workspace,
    index,
    readme: join(workspace.root, 'libs/alpha/README.md'),
    hostReadme: join(workspace.root, 'libs/alpha/src/host/README.md'),
  }
}

describe('docs-links', () => {
  describe('exemptionOf', () => {
    it('leaves values and syntax alone', () => {
      const cases: Array<[string, string]> = [
        ['true', 'keyword'],
        ['string', 'keyword'],
        ['_', 'character'],
        ['42', 'number'],
        ['-1.5', 'number'],
        ["'v3'", 'quoted'],
        ['"x"', 'quoted'],
        ['--root', 'flag'],
        ['-h', 'flag'],
        ['npx cz', 'command'],
        ['hf', 'command'],
        ['index.mjs', 'file'],
        ['feature.config.json', 'file'],
        ['./src', 'path'],
        ['src/', 'path'],
        ['lib/channel', 'path'],
        ['~/.npmrc', 'path'],
        ['ready()', 'expression'],
        ['required: true', 'expression'],
        ['Data<T>', 'expression'],
        ['a | b', 'expression'],
        ['__hf:present', 'reserved'],
        ['security-error', 'value'],
        ['Uint8Array', 'platform'],
        ['crypto.subtle', 'platform'],
        ['postMessage', 'platform'],
        ['1abc', 'number'],
      ]
      for (const [text, reason] of cases) {
        expect([text, exemptionOf(text)]).toEqual([text, reason])
      }
    })

    it('treats identifiers, dotted members, workspace packages and subpaths as names', () => {
      for (const text of [
        'createShell',
        'ShellHandle',
        'channel.outbound',
        'MIN_KEY',
        '@acme/alpha',
        '@acme/alpha/host',
        '@nx/devkit',
        '/host',
      ]) {
        expect([text, exemptionOf(text)]).toEqual([text, null])
      }
    })

    it('calls a span that is not a name and not a known value not-a-name', () => {
      expect(exemptionOf('über')).toBe('not-a-name')
    })
  })

  describe('resolveCodeMention', () => {
    it('resolves a package name to its landing page', () => {
      const { index, readme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, '@acme/alpha', readme)).toEqual({
        kind: 'resolved',
        target: 'package',
        url: `https://docs.example${SITE}/alpha/`,
      })
    })

    it('resolves a package subpath to its entry page', () => {
      const { index, readme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, '@acme/alpha/host', readme)).toEqual({
        kind: 'resolved',
        target: 'entry',
        url: `https://docs.example${SITE}/alpha/host/`,
      })
    })

    it('resolves a bare subpath against the package of the mentioning document', () => {
      const { index, readme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, '/host', readme)).toEqual({
        kind: 'resolved',
        target: 'entry',
        url: `https://docs.example${SITE}/alpha/host/`,
      })
    })

    it('reports a subpath the package does not export as unknown', () => {
      const { index, readme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, '@acme/alpha/nowhere', readme)).toEqual({ kind: 'unknown' })
    })

    it.each(['@acme/gamma', '@nx/devkit'])('exempts %s as a package the workspace does not publish', (mention: string) => {
      const { index, readme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, mention, readme)).toEqual({ kind: 'exempt', reason: 'external-package' })
    })

    it('resolves a subpath the site publishes a page for even when nothing exports it', () => {
      const { index, readme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, '/channel', readme)).toEqual({
        kind: 'resolved',
        target: 'entry',
        url: `https://docs.example${SITE}/alpha/channel/`,
      })
    })

    it('treats a leading slash that names neither an entry nor a page as a path', () => {
      const { index, readme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, '/api/apps', readme)).toEqual({ kind: 'exempt', reason: 'path' })
    })

    it('treats a leading slash mentioned outside every package as a path', () => {
      const { index, workspace } = setUp()

      expect(resolveCodeMention(index, ORIGINS, '/host', join(workspace.root, 'README.md'))).toEqual({ kind: 'exempt', reason: 'path' })
    })

    it('anchors a symbol on the one entry exporting it', () => {
      const { index, readme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, 'createShell', readme)).toEqual({
        kind: 'resolved',
        target: 'symbol',
        url: `https://docs.example${SITE}/alpha/host/#api-createShell`,
      })
    })

    it('anchors a symbol on the root entry when only that entry of the package exports it', () => {
      const { index, readme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, 'validate', readme)).toEqual({
        kind: 'resolved',
        target: 'symbol',
        url: `https://docs.example${SITE}/alpha/#api-validate`,
      })
    })

    it('anchors a symbol two entries export at the same depth on the landing page', () => {
      const { index, readme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, 'createChannel', readme)).toEqual({
        kind: 'resolved',
        target: 'symbol',
        url: `https://docs.example${SITE}/alpha/#api-createChannel`,
      })
    })

    it('anchors a symbol the root re-exports from a deeper entry on that deeper entry', () => {
      const { index, readme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, 'nested', readme)).toEqual({
        kind: 'resolved',
        target: 'symbol',
        url: `https://docs.example${SITE}/alpha/deep/nested/#api-nested`,
      })
    })

    it('anchors an interface property on its own line', () => {
      const { index, readme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, 'onDrop', readme)).toEqual({
        kind: 'resolved',
        target: 'member',
        url: `https://docs.example${SITE}/alpha/#api-Options-prop-onDrop`,
        via: 'Options',
      })
    })

    it('anchors an interface method signature on its parent', () => {
      const { index, readme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, 'send', readme)).toEqual({
        kind: 'resolved',
        target: 'member',
        url: `https://docs.example${SITE}/alpha/#api-Options`,
        via: 'Options',
      })
    })

    it('anchors a union member on its parent type', () => {
      const { index, readme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, 'v4', readme)).toEqual({
        kind: 'resolved',
        target: 'member',
        url: `https://docs.example${SITE}/alpha/#api-Mode`,
        via: 'Mode',
      })
    })

    it('anchors a class method on its own line', () => {
      const { index, readme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, 'dispatch', readme)).toEqual({
        kind: 'resolved',
        target: 'member',
        url: `https://docs.example${SITE}/alpha/#api-Store-method-dispatch`,
        via: 'Store',
      })
    })

    it('anchors a function-valued class property among the methods', () => {
      const { index, readme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, 'subscribe', readme)).toEqual({
        kind: 'resolved',
        target: 'member',
        url: `https://docs.example${SITE}/alpha/#api-Store-method-subscribe`,
        via: 'Store',
      })
    })

    it('anchors a plain class property on its own line', () => {
      const { index, readme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, 'state', readme)).toEqual({
        kind: 'resolved',
        target: 'member',
        url: `https://docs.example${SITE}/alpha/#api-Store-prop-state`,
        via: 'Store',
      })
    })

    it('prefers the interface to the defaults constant that mirrors it', () => {
      const { index, readme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, 'status', readme)).toEqual({
        kind: 'resolved',
        target: 'member',
        url: `https://docs.example${SITE}/alpha/#api-Options-prop-status`,
        via: 'Options',
      })
    })

    it('resolves a dotted mention by its head symbol', () => {
      const { index, readme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, 'Options.onDrop', readme)).toMatchObject({ kind: 'resolved', target: 'symbol' })
    })

    it('resolves a dotted mention by the type its variable is named after', () => {
      const { index, readme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, 'channel.outbound', readme)).toEqual({
        kind: 'resolved',
        target: 'member',
        url: `https://docs.example${SITE}/alpha/#api-Channel-prop-outbound`,
        via: 'Channel',
      })
    })

    it('resolves a dotted mention by its member', () => {
      const { index, readme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, 'shell.status', readme)).toMatchObject({ kind: 'resolved', via: 'Options' })
    })

    it('resolves a bundle global to the page of the entry it exposes', () => {
      const { index, readme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, 'AlphaHost', readme)).toEqual({
        kind: 'resolved',
        target: 'global',
        url: `https://docs.example${SITE}/alpha/host/`,
      })
    })

    it("offers a sibling entry's lowercase word rather than applying it", () => {
      const { index, hostReadme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, 'status', hostReadme)).toEqual({
        kind: 'elsewhere',
        candidates: [`Options (@acme/alpha): https://docs.example${SITE}/alpha/#api-Options`],
      })
    })

    it('trusts a multi-word member identifier a sibling entry declares', () => {
      const { index, hostReadme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, 'onDrop', hostReadme)).toMatchObject({ kind: 'resolved', via: 'Options' })
    })

    it('trusts a multi-word symbol identifier a sibling entry exports', () => {
      const { index, hostReadme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, 'createChannel', hostReadme)).toMatchObject({ kind: 'resolved', target: 'symbol' })
    })

    it('resolves a symbol the mentioning entry exports itself', () => {
      const { index, hostReadme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, 'createShell', hostReadme)).toMatchObject({ kind: 'resolved', target: 'symbol' })
    })

    it('offers a symbol another package exports without applying it', () => {
      const { index, readme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, 'logger', readme)).toEqual({
        kind: 'elsewhere',
        candidates: [`@acme/beta: https://docs.example${SITE}/beta/#api-logger`],
      })
    })

    it('offers a member another package declares without applying it', () => {
      const { index, readme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, 'channel', readme)).toEqual({
        kind: 'elsewhere',
        candidates: [`Logger (@acme/beta): https://docs.example${SITE}/beta/#api-Logger`],
      })
    })

    it('groups the entries of one other package into a single candidate', () => {
      const { workspace } = setUp()
      workspace.writeJsonFile('libs/beta/package.json', {
        name: '@acme/beta',
        exports: { '.': './src/index.js', './extra': './src/extra/index.js' },
      })
      workspace.writeFile('libs/beta/src/extra/index.ts', "export { logger } from '../logger'\n")
      resetDocsTargetIndex()
      const fresh = getDocsTargetIndex(workspace.root, join(workspace.root, 'apps/docs-site'))

      expect(resolveCodeMention(fresh, ORIGINS, 'logger', join(workspace.root, 'libs/alpha/README.md'))).toEqual({
        kind: 'elsewhere',
        candidates: [`@acme/beta: https://docs.example${SITE}/beta/extra/#api-logger`],
      })
    })

    it('reports a member several own types declare as ambiguous', () => {
      const { workspace } = setUp()
      workspace.writeFile(
        'libs/alpha/src/shared/validate.ts',
        'export interface Other {\n  status: number\n}\nexport function validate(): void {}\n'
      )
      workspace.writeFile(
        'libs/alpha/src/index.ts',
        "export type { Options, Mode } from './shared/types'\nexport type { Other } from './shared/validate'\nexport { validate } from './shared/validate'\n"
      )
      resetDocsTargetIndex()
      const fresh = getDocsTargetIndex(workspace.root, join(workspace.root, 'apps/docs-site'))

      expect(resolveCodeMention(fresh, ORIGINS, 'status', join(workspace.root, 'libs/alpha/README.md'))).toEqual({
        kind: 'ambiguous',
        candidates: [`Options: https://docs.example${SITE}/alpha/#api-Options`, `Other: https://docs.example${SITE}/alpha/#api-Other`],
      })
    })

    it('falls back to the declaring source file for a name the package declares but does not export', () => {
      const { index, readme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, 'handleRequest', readme)).toEqual({
        kind: 'resolved',
        target: 'declaration',
        url: 'https://github.com/acme/repo/blob/main/libs/alpha/src/host/create-shell.ts',
      })
    })

    it('reports a name declared in several source files as ambiguous between them', () => {
      const { index, readme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, 'twice', readme)).toEqual({
        kind: 'ambiguous',
        candidates: [
          'https://github.com/acme/repo/blob/main/libs/alpha/src/lib/other/twice.ts',
          'https://github.com/acme/repo/blob/main/libs/alpha/src/lib/server/twice.ts',
        ],
      })
    })

    it('reports a declared-only name as unknown when no repository URL is configured', () => {
      const { index, readme } = setUp()

      expect(resolveCodeMention(index, { ...ORIGINS, repoUrl: '' }, 'handleRequest', readme)).toEqual({ kind: 'unknown' })
    })

    it('reports a declared-only name as unknown when mentioned outside every package', () => {
      const { index, workspace } = setUp()

      expect(resolveCodeMention(index, ORIGINS, 'handleRequest', join(workspace.root, 'README.md'))).toEqual({ kind: 'unknown' })
    })

    it('exempts a keyword value', () => {
      const { index, readme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, 'true', readme)).toEqual({ kind: 'exempt', reason: 'keyword' })
    })

    it('reports a name nothing declares as unknown', () => {
      const { index, readme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, 'nothingHere', readme)).toEqual({ kind: 'unknown' })
    })
  })

  describe('headingSlug', () => {
    it.each([
      ['Quick Start', 'quick-start'],
      ['1. `build` orchestrates; phases compose', '1-build-orchestrates-phases-compose'],
      ['The <em>tag</em> and [a link](https://x) **bold** *em* ![img](x.png)', 'the-tag-and-a-link-bold-em-img'],
      ['---', ''],
    ])('slugs %p the way the site does, as %p', (heading: string, slug: string) => {
      expect(headingSlug(heading)).toBe(slug)
    })
  })

  describe('headingAnchors', () => {
    it('numbers duplicate headings and skips fences', () => {
      expect([
        ...headingAnchors('# T\n\n## Quick Start\n\n## Quick Start\n\n```bash\n# not a heading\n```\n\n## Quick Start\n\n## ---\n'),
      ]).toEqual(['t', 'quick-start', 'quick-start-1', 'quick-start-2'])
    })
  })

  describe('validateLink', () => {
    it.each([
      'https://docs.example/docs/libraries/alpha/host/',
      'https://www.docs.example/docs/libraries/alpha/host/',
      'https://docs.example/docs/guides/first-steps/#install-it',
    ])('accepts the site page %s', (link: string) => {
      const { index, readme } = setUp()

      expect(validateLink(index, ORIGINS, link, readme)).toEqual({ ok: true })
    })

    it('rejects a route the site does not publish', () => {
      const { index, readme } = setUp()

      expect(validateLink(index, ORIGINS, 'https://docs.example/docs/libraries/gamma/', readme)).toEqual({
        ok: false,
        reason: 'the site has no page at /docs/libraries/gamma/',
      })
    })

    it.each([
      'https://docs.example/docs/libraries/alpha/host/#api-createShell',
      'https://docs.example/docs/libraries/alpha/#api-createShell',
      'https://docs.example/docs/libraries/alpha/#api-reference',
      'https://docs.example/docs/libraries/alpha/#api-Options-prop-onDrop',
      'https://docs.example/docs/libraries/alpha/#api-Store-method-subscribe',
    ])('accepts the api anchor %s, which the page lists', (link: string) => {
      const { index, readme } = setUp()

      expect(validateLink(index, ORIGINS, link, readme)).toEqual({ ok: true })
    })

    it('rejects a property anchor for a method signature, which has no anchor of its own', () => {
      const { index, readme } = setUp()

      expect(validateLink(index, ORIGINS, 'https://docs.example/docs/libraries/alpha/#api-Options-prop-send', readme)).toEqual({
        ok: false,
        reason: "Options has no property 'send' with an anchor of its own",
      })
    })

    it('rejects a property anchor for a function-valued class property', () => {
      const { index, readme } = setUp()

      expect(validateLink(index, ORIGINS, 'https://docs.example/docs/libraries/alpha/#api-Store-prop-subscribe', readme)).toEqual({
        ok: false,
        reason: "Store has no property 'subscribe' with an anchor of its own",
      })
    })

    it('rejects a method anchor for a plain class property', () => {
      const { index, readme } = setUp()

      expect(validateLink(index, ORIGINS, 'https://docs.example/docs/libraries/alpha/#api-Store-method-state', readme)).toEqual({
        ok: false,
        reason: "Store has no method 'state' with an anchor of its own",
      })
    })

    it('rejects a symbol anchor on an entry that does not export it, naming the entry that does', () => {
      const { index, readme } = setUp()

      expect(validateLink(index, ORIGINS, 'https://docs.example/docs/libraries/alpha/host/#api-validate', readme)).toEqual({
        ok: false,
        reason: "@acme/alpha does not export 'validate' from /docs/libraries/alpha/host/; it is exported by /docs/libraries/alpha/",
      })
    })

    it('rejects a symbol anchor for a name the package does not export', () => {
      const { index, readme } = setUp()

      expect(validateLink(index, ORIGINS, 'https://docs.example/docs/libraries/alpha/#api-nothing', readme)).toEqual({
        ok: false,
        reason: "@acme/alpha does not export 'nothing' from /docs/libraries/alpha/",
      })
    })

    it('rejects an api anchor on a page that is not a package page', () => {
      const { index, readme } = setUp()

      expect(validateLink(index, ORIGINS, 'https://docs.example/docs/core-concepts/#api-x', readme)).toEqual({
        ok: false,
        reason: '/docs/core-concepts/ is not a package page, so it has no api-* anchors',
      })
    })

    it.each([
      'https://docs.example/docs/libraries/alpha/#quick-start-1',
      'https://docs.example/docs/libraries/alpha/architecture/#data-flow',
    ])('accepts the anchor %s, a heading of the document the page renders', (link: string) => {
      const { index, readme } = setUp()

      expect(validateLink(index, ORIGINS, link, readme)).toEqual({ ok: true })
    })

    it.each([
      ['https://docs.example/docs/libraries/alpha/architecture/#nope', 'libs/alpha/ARCHITECTURE.md', 'nope'],
      ['https://docs.example/docs/libraries/beta/#missing', 'libs/beta/README.md', 'missing'],
    ])('rejects the anchor %s because %s has no heading for it', (link: string, document: string, anchor: string) => {
      const { index, readme } = setUp()

      expect(validateLink(index, ORIGINS, link, readme)).toEqual({
        ok: false,
        reason: `${document} has no heading with the anchor '${anchor}'`,
      })
    })

    it('accepts any anchor on a static page that renders no markdown', () => {
      const { index, readme } = setUp()

      expect(validateLink(index, ORIGINS, 'https://docs.example/docs/core-concepts/#anything', readme)).toEqual({ ok: true })
    })

    it('accepts any anchor on a package page that renders no markdown', () => {
      const { index, readme, workspace } = setUp()
      workspace.writeFile('apps/docs-site/src/app/docs/libraries/alpha/ghost/page.tsx', '')

      expect(validateLink(index, ORIGINS, 'https://docs.example/docs/libraries/alpha/ghost/#top', readme)).toEqual({ ok: true })
    })

    it('reports a page whose document is gone', () => {
      const { index, readme, workspace } = setUp()
      rmSync(join(workspace.root, 'libs/alpha/ARCHITECTURE.md'))

      expect(validateLink(index, ORIGINS, 'https://docs.example/docs/libraries/alpha/architecture/#data-flow', readme)).toEqual({
        ok: false,
        reason: '/docs/libraries/alpha/architecture/ renders libs/alpha/ARCHITECTURE.md, which does not exist',
      })
    })

    it.each([
      'https://github.com/acme/repo/blob/main/libs/alpha/src/host/create-shell.ts#L3',
      'https://github.com/acme/repo/tree/main/libs/alpha/src',
      'https://github.com/acme/repo/issues/1',
      'https://github.com/acme/repo/blob/main',
      'https://github.com/other/repo/blob/main/x',
    ])('accepts the repository link %s', (link: string) => {
      const { index, readme } = setUp()

      expect(validateLink(index, ORIGINS, link, readme)).toEqual({ ok: true })
    })

    it('rejects a blob link to a directory', () => {
      const { index, readme } = setUp()

      expect(validateLink(index, ORIGINS, 'https://github.com/acme/repo/blob/main/libs/alpha/src', readme)).toEqual({
        ok: false,
        reason: 'libs/alpha/src is a directory; link it with /tree/ rather than /blob/',
      })
    })

    it('rejects a blob link to a file the repository does not have', () => {
      const { index, readme } = setUp()

      expect(validateLink(index, ORIGINS, 'https://github.com/acme/repo/blob/main/libs/alpha/src/missing.ts', readme)).toEqual({
        ok: false,
        reason: 'the repository has no file at libs/alpha/src/missing.ts',
      })
    })

    it('trusts a repository link when no repository URL is configured', () => {
      const { index, readme } = setUp()

      expect(validateLink(index, { ...ORIGINS, repoUrl: '' }, 'https://github.com/acme/repo/blob/main/nope', readme)).toEqual({ ok: true })
    })

    it.each(['../../README.md', '../../README.md#quick-start', '../../src#x'])(
      'accepts the relative link %s against the document',
      (link: string) => {
        const { index, hostReadme } = setUp()

        expect(validateLink(index, ORIGINS, link, hostReadme)).toEqual({ ok: true })
      }
    )

    it('rejects a relative link whose anchor no heading of the target carries', () => {
      const { index, hostReadme } = setUp()

      expect(validateLink(index, ORIGINS, '../../README.md#nope', hostReadme)).toEqual({
        ok: false,
        reason: "libs/alpha/README.md has no heading with the anchor 'nope'",
      })
    })

    it('rejects a relative link to a file that does not exist', () => {
      const { index, hostReadme } = setUp()

      expect(validateLink(index, ORIGINS, './missing.md', hostReadme)).toEqual({
        ok: false,
        reason: 'libs/alpha/src/host/missing.md does not exist',
      })
    })

    it('accepts a bare anchor of a heading in the document', () => {
      const { index, readme } = setUp()

      expect(validateLink(index, ORIGINS, '#quick-start', readme)).toEqual({ ok: true })
    })

    it('rejects a bare anchor no heading in the document carries', () => {
      const { index, readme } = setUp()

      expect(validateLink(index, ORIGINS, '#nope', readme)).toEqual({
        ok: false,
        reason: "this document has no heading with the anchor 'nope'",
      })
    })

    it.each(['https://developer.mozilla.org/x', 'mailto:someone@example.com'])('trusts the external link %s', (link: string) => {
      const { index, readme } = setUp()

      expect(validateLink(index, ORIGINS, link, readme)).toEqual({ ok: true })
    })

    it('rejects a malformed URL', () => {
      const { index, readme } = setUp()

      expect(validateLink(index, ORIGINS, 'https://', readme)).toEqual({ ok: false, reason: "'https://' is not a valid URL" })
    })
  })
})
