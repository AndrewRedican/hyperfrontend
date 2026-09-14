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
        ['index.esm.js', 'file'],
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
    it('resolves a package and its entry points to their pages', () => {
      const { index, readme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, '@acme/alpha', readme)).toEqual({
        kind: 'resolved',
        target: 'package',
        url: `https://docs.example${SITE}/alpha/`,
      })
      expect(resolveCodeMention(index, ORIGINS, '@acme/alpha/host', readme)).toEqual({
        kind: 'resolved',
        target: 'entry',
        url: `https://docs.example${SITE}/alpha/host/`,
      })
      expect(resolveCodeMention(index, ORIGINS, '/host', readme)).toEqual({
        kind: 'resolved',
        target: 'entry',
        url: `https://docs.example${SITE}/alpha/host/`,
      })
      expect(resolveCodeMention(index, ORIGINS, '@acme/alpha/nowhere', readme)).toEqual({ kind: 'unknown' })
      expect(resolveCodeMention(index, ORIGINS, '@acme/gamma', readme)).toEqual({ kind: 'exempt', reason: 'external-package' })
      expect(resolveCodeMention(index, ORIGINS, '@nx/devkit', readme)).toEqual({ kind: 'exempt', reason: 'external-package' })
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
      const { index, readme, workspace } = setUp()

      expect(resolveCodeMention(index, ORIGINS, '/api/apps', readme)).toEqual({ kind: 'exempt', reason: 'path' })
      expect(resolveCodeMention(index, ORIGINS, '/host', join(workspace.root, 'README.md'))).toEqual({ kind: 'exempt', reason: 'path' })
    })

    it('anchors a symbol on the one entry exporting it', () => {
      const { index, readme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, 'createShell', readme)).toEqual({
        kind: 'resolved',
        target: 'symbol',
        url: `https://docs.example${SITE}/alpha/host/#api-createShell`,
      })
      expect(resolveCodeMention(index, ORIGINS, 'validate', readme)).toEqual({
        kind: 'resolved',
        target: 'symbol',
        url: `https://docs.example${SITE}/alpha/#api-validate`,
      })
    })

    it('anchors a symbol two entries export at the same depth on the landing page, and one re-exported from a deeper entry there', () => {
      const { index, readme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, 'createChannel', readme)).toEqual({
        kind: 'resolved',
        target: 'symbol',
        url: `https://docs.example${SITE}/alpha/#api-createChannel`,
      })
      expect(resolveCodeMention(index, ORIGINS, 'nested', readme)).toEqual({
        kind: 'resolved',
        target: 'symbol',
        url: `https://docs.example${SITE}/alpha/deep/nested/#api-nested`,
      })
    })

    it('anchors a property on its own line and any other member on its parent', () => {
      const { index, readme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, 'onDrop', readme)).toEqual({
        kind: 'resolved',
        target: 'member',
        url: `https://docs.example${SITE}/alpha/#api-Options-prop-onDrop`,
        via: 'Options',
      })
      expect(resolveCodeMention(index, ORIGINS, 'send', readme)).toEqual({
        kind: 'resolved',
        target: 'member',
        url: `https://docs.example${SITE}/alpha/#api-Options`,
        via: 'Options',
      })
      expect(resolveCodeMention(index, ORIGINS, 'v4', readme)).toEqual({
        kind: 'resolved',
        target: 'member',
        url: `https://docs.example${SITE}/alpha/#api-Mode`,
        via: 'Mode',
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

    it('resolves a dotted mention by its head symbol, by the type its variable is named after, or by its member', () => {
      const { index, readme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, 'Options.onDrop', readme)).toMatchObject({ kind: 'resolved', target: 'symbol' })
      expect(resolveCodeMention(index, ORIGINS, 'channel.outbound', readme)).toEqual({
        kind: 'resolved',
        target: 'member',
        url: `https://docs.example${SITE}/alpha/#api-Channel-prop-outbound`,
        via: 'Channel',
      })
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

    it("offers a sibling entry's lowercase word rather than applying it, but trusts a multi-word identifier", () => {
      const { index, hostReadme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, 'status', hostReadme)).toEqual({
        kind: 'elsewhere',
        candidates: [`Options (@acme/alpha): https://docs.example${SITE}/alpha/#api-Options`],
      })
      expect(resolveCodeMention(index, ORIGINS, 'onDrop', hostReadme)).toMatchObject({ kind: 'resolved', via: 'Options' })
      expect(resolveCodeMention(index, ORIGINS, 'createChannel', hostReadme)).toMatchObject({ kind: 'resolved', target: 'symbol' })
      expect(resolveCodeMention(index, ORIGINS, 'createShell', hostReadme)).toMatchObject({ kind: 'resolved', target: 'symbol' })
    })

    it('offers what another package documents and never applies it', () => {
      const { index, readme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, 'logger', readme)).toEqual({
        kind: 'elsewhere',
        candidates: [`@acme/beta: https://docs.example${SITE}/beta/#api-logger`],
      })
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
      const { index, readme, workspace } = setUp()

      expect(resolveCodeMention(index, ORIGINS, 'handleRequest', readme)).toEqual({
        kind: 'resolved',
        target: 'declaration',
        url: 'https://github.com/acme/repo/blob/main/libs/alpha/src/host/create-shell.ts',
      })
      expect(resolveCodeMention(index, ORIGINS, 'twice', readme)).toEqual({
        kind: 'ambiguous',
        candidates: [
          'https://github.com/acme/repo/blob/main/libs/alpha/src/lib/other/twice.ts',
          'https://github.com/acme/repo/blob/main/libs/alpha/src/lib/server/twice.ts',
        ],
      })
      expect(resolveCodeMention(index, { ...ORIGINS, repoUrl: '' }, 'handleRequest', readme)).toEqual({ kind: 'unknown' })
      expect(resolveCodeMention(index, ORIGINS, 'handleRequest', join(workspace.root, 'README.md'))).toEqual({ kind: 'unknown' })
    })

    it('returns exempt for values and unknown for a name nothing declares', () => {
      const { index, readme } = setUp()

      expect(resolveCodeMention(index, ORIGINS, 'true', readme)).toEqual({ kind: 'exempt', reason: 'keyword' })
      expect(resolveCodeMention(index, ORIGINS, 'nothingHere', readme)).toEqual({ kind: 'unknown' })
    })
  })

  describe('headingSlug', () => {
    it('slugs the way the site does, inline markdown and tags stripped', () => {
      expect(headingSlug('Quick Start')).toBe('quick-start')
      expect(headingSlug('1. `build` orchestrates; phases compose')).toBe('1-build-orchestrates-phases-compose')
      expect(headingSlug('The <em>tag</em> and [a link](https://x) **bold** *em* ![img](x.png)')).toBe('the-tag-and-a-link-bold-em-img')
      expect(headingSlug('---')).toBe('')
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
    it('accepts site pages and rejects routes the site does not publish', () => {
      const { index, readme } = setUp()

      expect(validateLink(index, ORIGINS, 'https://docs.example/docs/libraries/alpha/host/', readme)).toEqual({ ok: true })
      expect(validateLink(index, ORIGINS, 'https://www.docs.example/docs/libraries/alpha/host/', readme)).toEqual({ ok: true })
      expect(validateLink(index, ORIGINS, 'https://docs.example/docs/guides/first-steps/#install-it', readme)).toEqual({ ok: true })
      expect(validateLink(index, ORIGINS, 'https://docs.example/docs/libraries/gamma/', readme)).toEqual({
        ok: false,
        reason: 'the site has no page at /docs/libraries/gamma/',
      })
    })

    it('checks api anchors against the entries a page lists', () => {
      const { index, readme } = setUp()

      expect(validateLink(index, ORIGINS, 'https://docs.example/docs/libraries/alpha/host/#api-createShell', readme)).toEqual({ ok: true })
      expect(validateLink(index, ORIGINS, 'https://docs.example/docs/libraries/alpha/#api-createShell', readme)).toEqual({ ok: true })
      expect(validateLink(index, ORIGINS, 'https://docs.example/docs/libraries/alpha/#api-reference', readme)).toEqual({ ok: true })
      expect(validateLink(index, ORIGINS, 'https://docs.example/docs/libraries/alpha/#api-Options-prop-onDrop', readme)).toEqual({
        ok: true,
      })
      expect(validateLink(index, ORIGINS, 'https://docs.example/docs/libraries/alpha/#api-Options-prop-send', readme)).toEqual({
        ok: false,
        reason: "Options has no property 'send' with an anchor of its own",
      })
      expect(validateLink(index, ORIGINS, 'https://docs.example/docs/libraries/alpha/host/#api-validate', readme)).toEqual({
        ok: false,
        reason: "@acme/alpha does not export 'validate' from /docs/libraries/alpha/host/; it is exported by /docs/libraries/alpha/",
      })
      expect(validateLink(index, ORIGINS, 'https://docs.example/docs/libraries/alpha/#api-nothing', readme)).toEqual({
        ok: false,
        reason: "@acme/alpha does not export 'nothing' from /docs/libraries/alpha/",
      })
      expect(validateLink(index, ORIGINS, 'https://docs.example/docs/core-concepts/#api-x', readme)).toEqual({
        ok: false,
        reason: '/docs/core-concepts/ is not a package page, so it has no api-* anchors',
      })
    })

    it('checks other anchors against the headings of the document a page renders', () => {
      const { index, readme } = setUp()

      expect(validateLink(index, ORIGINS, 'https://docs.example/docs/libraries/alpha/#quick-start-1', readme)).toEqual({ ok: true })
      expect(validateLink(index, ORIGINS, 'https://docs.example/docs/libraries/alpha/architecture/#data-flow', readme)).toEqual({
        ok: true,
      })
      expect(validateLink(index, ORIGINS, 'https://docs.example/docs/libraries/alpha/architecture/#nope', readme)).toEqual({
        ok: false,
        reason: "libs/alpha/ARCHITECTURE.md has no heading with the anchor 'nope'",
      })
      expect(validateLink(index, ORIGINS, 'https://docs.example/docs/core-concepts/#anything', readme)).toEqual({ ok: true })
      expect(validateLink(index, ORIGINS, 'https://docs.example/docs/libraries/beta/#missing', readme)).toEqual({
        ok: false,
        reason: "libs/beta/README.md has no heading with the anchor 'missing'",
      })
    })

    it('accepts any anchor on a page that renders no markdown, and reports a page whose document is gone', () => {
      const { index, readme, workspace } = setUp()
      workspace.writeFile('apps/docs-site/src/app/docs/libraries/alpha/ghost/page.tsx', '')
      rmSync(join(workspace.root, 'libs/alpha/ARCHITECTURE.md'))

      expect(validateLink(index, ORIGINS, 'https://docs.example/docs/libraries/alpha/ghost/#top', readme)).toEqual({ ok: true })
      expect(validateLink(index, ORIGINS, 'https://docs.example/docs/libraries/alpha/architecture/#data-flow', readme)).toEqual({
        ok: false,
        reason: '/docs/libraries/alpha/architecture/ renders libs/alpha/ARCHITECTURE.md, which does not exist',
      })
    })

    it('checks repository links against the workspace', () => {
      const { index, readme } = setUp()

      expect(validateLink(index, ORIGINS, 'https://github.com/acme/repo/blob/main/libs/alpha/src/host/create-shell.ts#L3', readme)).toEqual(
        { ok: true }
      )
      expect(validateLink(index, ORIGINS, 'https://github.com/acme/repo/tree/main/libs/alpha/src', readme)).toEqual({ ok: true })
      expect(validateLink(index, ORIGINS, 'https://github.com/acme/repo/blob/main/libs/alpha/src', readme)).toEqual({
        ok: false,
        reason: 'libs/alpha/src is a directory; link it with /tree/ rather than /blob/',
      })
      expect(validateLink(index, ORIGINS, 'https://github.com/acme/repo/blob/main/libs/alpha/src/missing.ts', readme)).toEqual({
        ok: false,
        reason: 'the repository has no file at libs/alpha/src/missing.ts',
      })
      expect(validateLink(index, ORIGINS, 'https://github.com/acme/repo/issues/1', readme)).toEqual({ ok: true })
      expect(validateLink(index, ORIGINS, 'https://github.com/acme/repo/blob/main', readme)).toEqual({ ok: true })
      expect(validateLink(index, ORIGINS, 'https://github.com/other/repo/blob/main/x', readme)).toEqual({ ok: true })
      expect(validateLink(index, { ...ORIGINS, repoUrl: '' }, 'https://github.com/acme/repo/blob/main/nope', readme)).toEqual({ ok: true })
    })

    it('resolves relative links and bare anchors against the document', () => {
      const { index, hostReadme, readme } = setUp()

      expect(validateLink(index, ORIGINS, '../../README.md', hostReadme)).toEqual({ ok: true })
      expect(validateLink(index, ORIGINS, '../../README.md#quick-start', hostReadme)).toEqual({ ok: true })
      expect(validateLink(index, ORIGINS, '../../README.md#nope', hostReadme)).toEqual({
        ok: false,
        reason: "libs/alpha/README.md has no heading with the anchor 'nope'",
      })
      expect(validateLink(index, ORIGINS, '../../src#x', hostReadme)).toEqual({ ok: true })
      expect(validateLink(index, ORIGINS, './missing.md', hostReadme)).toEqual({
        ok: false,
        reason: 'libs/alpha/src/host/missing.md does not exist',
      })
      expect(validateLink(index, ORIGINS, '#quick-start', readme)).toEqual({ ok: true })
      expect(validateLink(index, ORIGINS, '#nope', readme)).toEqual({
        ok: false,
        reason: "this document has no heading with the anchor 'nope'",
      })
    })

    it('trusts other external links and rejects a malformed URL', () => {
      const { index, readme } = setUp()

      expect(validateLink(index, ORIGINS, 'https://developer.mozilla.org/x', readme)).toEqual({ ok: true })
      expect(validateLink(index, ORIGINS, 'mailto:someone@example.com', readme)).toEqual({ ok: true })
      expect(validateLink(index, ORIGINS, 'https://', readme)).toEqual({ ok: false, reason: "'https://' is not a valid URL" })
    })
  })
})
