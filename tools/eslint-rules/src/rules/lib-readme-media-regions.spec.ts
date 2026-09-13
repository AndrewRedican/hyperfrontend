import type { TempWorkspace } from '../testing'
import { readFileSync } from 'node:fs'
import { after as afterAll } from 'node:test'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { entries, keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createTempWorkspaceManager } from '../testing'
import { resetDocsTargetIndex } from '../utils/docs-targets'
import rule, { DEFAULT_ASSET_ROOT, hasPortableAsset, isWellPlaced, REQUIRED_REGIONS, RULE_NAME } from './lib-readme-media-regions'

const manager = createTempWorkspaceManager()

afterAll(() => manager.cleanupAll())

const PUBLISHABLE = { projectType: 'library', targets: { build: {}, publish: {} } }

const BANNER = [
  '<!-- hf:media start id="banner" scene="banner-alpha" asset="banner" alt="@hyperfrontend/alpha" -->',
  '<!-- hf:media end -->',
]

const RUNTIMES = [
  '<!-- hf:media start id="runtimes" scene="runtimes-alpha" asset="runtimes" docs="#compatibility" alt="Runs everywhere" -->',
  '| Environment | Supported |',
  '| --- | :-: |',
  '| Node.js >= 18 | ✅ |',
  '<!-- hf:media end -->',
]

/**
 * A package readme with the given top matter and Compatibility section.
 *
 * @param top - Lines placed below the badges and above the first section.
 * @param compatibility - Lines placed inside the Compatibility section.
 * @param tail - Lines placed after the Compatibility section.
 * @returns Markdown.
 */
function readme(top: readonly string[], compatibility: readonly string[], tail: readonly string[] = []): string {
  return [
    '# @hyperfrontend/alpha',
    '',
    '<p align="center"><img src="https://img.shields.io/npm/v/x" alt="npm"></p>',
    '',
    ...top,
    '',
    'Prose.',
    '',
    '## Quick Start',
    '',
    'Text.',
    '',
    '## Compatibility',
    '',
    ...compatibility,
    '',
    '### Output Formats',
    '',
    'Formats.',
    ...tail,
  ].join('\n')
}

/**
 * Lays out a workspace with one publishable package, its committed media and
 * the site page that documents it.
 *
 * @param content - The package readme.
 * @param overrides - Files that replace or extend the defaults, by path; null removes one.
 * @returns The temporary workspace.
 */
function createWorkspace(content: string, overrides: Record<string, string | null> = {}): TempWorkspace {
  const files: Record<string, string> = {
    'nx.json': '{}',
    'package.json': stringify({ name: 'workspace', repository: { url: 'git+https://github.com/acme/repo.git' } }),
    'libs/alpha/project.json': stringify(PUBLISHABLE),
    'libs/alpha/package.json': stringify({ name: '@hyperfrontend/alpha', exports: { '.': './src/index.js' } }),
    'libs/alpha/src/index.ts': 'export function alpha(): void {}\n',
    'libs/alpha/README.md': content,
    'assets/media/banner-alpha/banner.gif': 'GIF',
    'assets/media/runtimes-alpha/runtimes.png': 'PNG',
    'apps/docs-site/src/app/docs/libraries/alpha/page.tsx': '',
  }
  for (const [path, value] of entries(overrides)) {
    if (value === null) {
      delete files[path]
    } else {
      files[path] = value
    }
  }
  resetDocsTargetIndex()
  return manager.create({ files })
}

/**
 * Runs the rule over the package readme of a workspace.
 *
 * @param workspace - Where the package and its readme were laid out.
 * @param file - The readme's path within it.
 * @returns Every report, as its message id and data.
 */
function lint(workspace: TempWorkspace, file = 'libs/alpha/README.md'): Array<{ messageId: string; data?: Record<string, string> }> {
  const filename = workspace.getPath(file)
  const report = jest.fn()
  const context = { filename, options: [], sourceCode: { getText: () => readFileSync(workspace.getPath(file), 'utf8') }, report }
  // @ts-expect-error - partial mock
  rule.create(context).root?.({ type: 'root' })
  return report.mock.calls.map(([call]) => ({ messageId: call.messageId, data: call.data }))
}

describe('lib-readme-media-regions', () => {
  describe('rule metadata', () => {
    it('exports the rule name', () => {
      expect(RULE_NAME).toBe('lib-readme-media-regions')
    })

    it('is a problem rule with the documented messages', () => {
      expect({ type: rule.meta?.type, messages: keys(rule.meta?.messages ?? {}) }).toEqual({
        type: 'problem',
        messages: [
          'unreadable',
          'missingScene',
          'missingAsset',
          'brokenDocs',
          'missingRegion',
          'wrongRegion',
          'misplacedRegion',
          'missingBanner',
          'bannerRegion',
        ],
      })
    })

    it('requires the runtime strip and nothing else', () => {
      expect(REQUIRED_REGIONS.map((region) => [region.id, region.scenePrefix, region.asset])).toEqual([
        ['runtimes', 'runtimes-', 'runtimes'],
      ])
    })
  })

  describe('isWellPlaced', () => {
    it('accepts a runtime strip inside the Compatibility section, and leaves a document without one alone', () => {
      expect([
        isWellPlaced(['## Compatibility', 'x', '### Output Formats'], 1),
        isWellPlaced(['## Compatibility', 'x'], 1),
        isWellPlaced(['## Other', 'x'], 1),
      ]).toEqual([true, true, true])
    })

    it('rejects a runtime strip outside the Compatibility section', () => {
      expect([
        isWellPlaced(['x', '## Compatibility', 'y'], 0),
        isWellPlaced(['## Compatibility', 'y', '### Output Formats', 'x'], 3),
      ]).toEqual([false, false])
    })
  })

  describe('hasPortableAsset', () => {
    it('finds the animation or a still under the bare stem, and nothing under a themed one', () => {
      const workspace = manager.create({ files: { 'scene/hero.webp': '', 'scene/poster.dark.png': '' } })
      expect([hasPortableAsset(workspace.getPath('scene'), 'hero'), hasPortableAsset(workspace.getPath('scene'), 'poster')]).toEqual([
        true,
        false,
      ])
    })
  })

  describe('scope', () => {
    it('skips a markdown file that is not a readme', () => {
      const workspace = createWorkspace(readme([], []), { 'libs/alpha/GUIDE.md': '# x' })
      expect(lint(workspace, 'libs/alpha/GUIDE.md')).toEqual([])
    })

    it('skips a readme outside a publishable library', () => {
      const workspace = createWorkspace(readme([], []), { 'libs/alpha/project.json': stringify({ projectType: 'library' }) })
      expect(lint(workspace)).toEqual([])
    })

    it('skips a readme outside a workspace', () => {
      const workspace = createWorkspace(readme([], []), { 'nx.json': null })
      expect(lint(workspace)).toEqual([])
    })

    it('skips a package with no name', () => {
      const workspace = createWorkspace(readme([], []), { 'libs/alpha/package.json': stringify({ exports: { '.': './src/index.js' } }) })
      expect(lint(workspace)).toEqual([])
    })

    it('skips a package the documentation index does not know', () => {
      const workspace = createWorkspace(readme([], []), {
        'packages/beta/project.json': stringify(PUBLISHABLE),
        'packages/beta/package.json': stringify({ name: '@hyperfrontend/beta' }),
        'packages/beta/README.md': readme([], []),
      })
      expect(lint(workspace, 'packages/beta/README.md')).toEqual([])
    })
  })

  describe('a well-formed readme', () => {
    it('reports nothing', () => {
      expect(lint(createWorkspace(readme([], RUNTIMES)))).toEqual([])
    })

    it('accepts a region that names no docs', () => {
      const strip = RUNTIMES.map((line) => line.replace(' docs="#compatibility"', ''))
      expect(lint(createWorkspace(readme([], strip)))).toEqual([])
    })

    it('accepts a docs path to a published page and an absolute site URL', () => {
      const region = (docs: string): string[] => [
        `<!-- hf:media start id="runtimes" scene="runtimes-alpha" asset="runtimes" docs="${docs}" alt="x" -->`,
        '<!-- hf:media end -->',
      ]
      const workspace = createWorkspace(readme([], region('architecture/')), {
        'apps/docs-site/src/app/docs/libraries/alpha/architecture/page.tsx': '',
        'libs/alpha/ARCHITECTURE.md': '# Architecture\n',
      })
      const absolute = createWorkspace(readme([], region('https://www.hyperfrontend.dev/docs/libraries/alpha/#quick-start')))
      expect([lint(workspace), lint(absolute)]).toEqual([[], []])
    })
  })

  describe('reports', () => {
    it('reports a region that cannot be read, on its line', () => {
      const workspace = createWorkspace(
        readme([], ['<!-- hf:media start id="runtimes" scene="runtimes-alpha" -->', '<!-- hf:media end -->'])
      )
      expect(lint(workspace)).toEqual([
        { messageId: 'unreadable', data: { reason: 'a directive needs alt="..."' } },
        expect.objectContaining({ messageId: 'missingRegion', data: expect.objectContaining({ id: 'runtimes' }) }),
      ])
    })

    it('reports a scene that has not been recorded', () => {
      const workspace = createWorkspace(readme([], RUNTIMES), { 'assets/media/runtimes-alpha/runtimes.png': null })
      expect(lint(workspace)).toEqual([{ messageId: 'missingScene', data: { scene: 'runtimes-alpha', assetRoot: DEFAULT_ASSET_ROOT } }])
    })

    it('reports a scene with no portable file for the asset', () => {
      const workspace = createWorkspace(readme([], RUNTIMES), {
        'assets/media/runtimes-alpha/runtimes.png': null,
        'assets/media/runtimes-alpha/runtimes.dark.png': 'PNG',
      })
      expect(lint(workspace)).toEqual([{ messageId: 'missingAsset', data: { scene: 'runtimes-alpha', asset: 'runtimes' } }])
    })

    it('reports a docs anchor the landing page does not have', () => {
      const strip = RUNTIMES.map((line) => line.replace('#compatibility', '#nowhere'))
      expect(lint(createWorkspace(readme([], strip)))).toEqual([
        {
          messageId: 'brokenDocs',
          data: expect.objectContaining({ id: 'runtimes', href: 'https://www.hyperfrontend.dev/docs/libraries/alpha/#nowhere' }),
        },
      ])
    })

    it('reports a missing runtime strip, naming the scene and place it takes', () => {
      expect(lint(createWorkspace(readme([], [])))).toEqual([
        {
          messageId: 'missingRegion',
          data: { id: 'runtimes', scene: 'runtimes-alpha', asset: 'runtimes', place: REQUIRED_REGIONS[0]?.place ?? '' },
        },
      ])
    })

    it('reports a runtime strip that names another scene', () => {
      const strip = RUNTIMES.map((line) => line.replace('runtimes-alpha', 'runtimes-beta'))
      const workspace = createWorkspace(readme([], strip), { 'assets/media/runtimes-beta/runtimes.png': 'PNG' })
      expect(lint(workspace)).toEqual([{ messageId: 'wrongRegion', data: { id: 'runtimes', scene: 'runtimes-alpha', asset: 'runtimes' } }])
    })

    it('reports a runtime strip outside Compatibility', () => {
      const workspace = createWorkspace(readme([], [], ['', ...RUNTIMES]))
      expect(lint(workspace)).toEqual([{ messageId: 'misplacedRegion', data: { id: 'runtimes', place: REQUIRED_REGIONS[0]?.place ?? '' } }])
    })

    it('reports a banner that has not been recorded, on the title line', () => {
      const workspace = createWorkspace(readme([], RUNTIMES), { 'assets/media/banner-alpha/banner.gif': null })
      expect(lint(workspace)).toEqual([
        { messageId: 'missingBanner', data: { scene: 'banner-alpha', asset: 'banner', assetRoot: DEFAULT_ASSET_ROOT } },
      ])
    })

    it('reports an unrecorded banner on the first line of a readme with no title', () => {
      const workspace = createWorkspace(['Prose.', '', '## Compatibility', '', ...RUNTIMES].join('\n'), {
        'assets/media/banner-alpha/banner.gif': null,
      })
      const report = jest.fn()
      const context = {
        filename: workspace.getPath('libs/alpha/README.md'),
        options: [],
        sourceCode: { getText: () => readFileSync(workspace.getPath('libs/alpha/README.md'), 'utf8') },
        report,
      }
      // @ts-expect-error - partial mock
      rule.create(context).root?.({ type: 'root' })
      expect(report.mock.calls.map(([call]) => [call.messageId, call.loc.start.line])).toEqual([['missingBanner', 1]])
    })

    it('reports a leftover banner region and checks nothing else about it', () => {
      const banner = BANNER.map((line) => line.replace('banner-alpha', 'banner-beta'))
      expect(lint(createWorkspace(readme(banner, RUNTIMES)))).toEqual([{ messageId: 'bannerRegion', data: {} }])
    })
  })
})
