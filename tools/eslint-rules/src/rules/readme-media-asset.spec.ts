import { after as afterAll } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createTempWorkspaceManager } from '../testing'
import rule, { detectMediaReferences, isBadgeUrl, isMediaUrl, RULE_NAME, shouldApplyRule } from './readme-media-asset'

const manager = createTempWorkspaceManager()

afterAll(() => manager.cleanupAll())

const OPTIONS = [{ baseUrl: 'https://www.hyperfrontend.dev/media/', assetRoot: 'assets/media' }]

/**
 * Builds a README that centres a hero image.
 *
 * @param url - The image URL to reference.
 * @returns Markdown content with a centered hero.
 */
function readmeWithHero(url: string): string {
  return `# @hyperfrontend/thing\n\n<p align="center">\n  <img width="560" src="${url}" alt="A capture">\n</p>\n\nProse.\n`
}

describe('readme-media-asset', () => {
  describe('rule metadata', () => {
    it('exports the correct rule name', () => {
      expect(RULE_NAME).toBe('readme-media-asset')
    })

    it('has correct meta type', () => {
      expect(rule.meta?.type).toBe('problem')
    })

    it('has all required message IDs', () => {
      expect(rule.meta?.messages).toEqual(expect.objectContaining({ notSiteUrl: expect.any(String), missingAsset: expect.any(String) }))
    })

    it('accepts baseUrl and assetRoot options', () => {
      expect(rule.meta?.schema).toEqual([
        expect.objectContaining({ properties: { baseUrl: { type: 'string' }, assetRoot: { type: 'string' } } }),
      ])
    })
  })

  describe('isBadgeUrl', () => {
    it('recognises a shields badge', () => {
      expect(isBadgeUrl('https://img.shields.io/npm/v/x.svg')).toBe(true)
    })

    it('recognises a codecov badge', () => {
      expect(isBadgeUrl('https://codecov.io/gh/x/graph/badge.svg')).toBe(true)
    })

    it('does not treat a site asset as a badge', () => {
      expect(isBadgeUrl('https://www.hyperfrontend.dev/media/koi-pond/hero.gif')).toBe(false)
    })
  })

  describe('isMediaUrl', () => {
    it('recognises a gif', () => {
      expect(isMediaUrl('https://example.com/a/hero.gif')).toBe(true)
    })

    it('recognises a media file behind a query string', () => {
      expect(isMediaUrl('https://example.com/a/hero.png?raw=true')).toBe(true)
    })

    it('ignores a markdown link target', () => {
      expect(isMediaUrl('./ARCHITECTURE.md')).toBe(false)
    })
  })

  describe('detectMediaReferences', () => {
    it('finds a markdown image', () => {
      expect(detectMediaReferences('![alt](/media/a/hero.gif)')).toEqual([expect.objectContaining({ url: '/media/a/hero.gif', line: 1 })])
    })

    it('finds an html image', () => {
      expect(detectMediaReferences('<img src="/media/a/hero.gif" alt="x">')).toEqual([
        expect.objectContaining({ url: '/media/a/hero.gif' }),
      ])
    })

    it('finds a source srcset', () => {
      expect(detectMediaReferences('<source srcset="/media/a/dark.gif">')).toEqual([expect.objectContaining({ url: '/media/a/dark.gif' })])
    })

    it('ignores references inside fenced code blocks', () => {
      expect(detectMediaReferences('```html\n<img src="/media/a/hero.gif">\n```\n')).toEqual([])
    })

    it('records the line a reference sits on', () => {
      expect(detectMediaReferences('# Title\n\n![alt](/media/a/hero.gif)\n')).toEqual([expect.objectContaining({ line: 3 })])
    })
  })

  describe('shouldApplyRule', () => {
    it('applies to a library README', () => {
      const workspace = manager.create({ files: { 'nx.json': '{}', 'libs/thing/README.md': '# x' } })

      expect(shouldApplyRule(workspace.getPath('libs/thing/README.md'))).toBe(true)
    })

    it('skips the workspace root README', () => {
      const workspace = manager.create({ files: { 'nx.json': '{}', 'README.md': '# x' } })

      expect(shouldApplyRule(workspace.getPath('README.md'))).toBe(false)
    })

    it('skips a markdown file that is not a README', () => {
      const workspace = manager.create({ files: { 'nx.json': '{}', 'libs/thing/GUIDE.md': '# x' } })

      expect(shouldApplyRule(workspace.getPath('libs/thing/GUIDE.md'))).toBe(false)
    })

    it('skips a file outside any workspace', () => {
      expect(shouldApplyRule('/definitely/not/a/workspace/README.md')).toBe(false)
    })
  })

  describe('rule.create', () => {
    it('does nothing without options', () => {
      const workspace = manager.create({ files: { 'nx.json': '{}', 'libs/thing/README.md': '# x' } })
      const context = { filename: workspace.getPath('libs/thing/README.md'), options: [], sourceCode: { getText: () => '' } }

      // @ts-expect-error - partial mock
      expect(rule.create(context)).toEqual({})
    })

    it('does nothing for the workspace root README', () => {
      const workspace = manager.create({ files: { 'nx.json': '{}', 'README.md': '# x' } })
      const context = { filename: workspace.getPath('README.md'), options: OPTIONS, sourceCode: { getText: () => '' } }

      // @ts-expect-error - partial mock
      expect(rule.create(context)).toEqual({})
    })

    it('accepts a site URL backed by a committed asset', () => {
      const content = readmeWithHero('https://www.hyperfrontend.dev/media/koi-pond/hero.gif')
      const workspace = manager.create({
        files: { 'nx.json': '{}', 'assets/media/koi-pond/hero.gif': 'GIF', 'libs/thing/README.md': content },
      })
      const report = jest.fn()
      const context = {
        filename: workspace.getPath('libs/thing/README.md'),
        options: OPTIONS,
        sourceCode: { getText: () => content },
        report,
      }

      // @ts-expect-error - partial mock
      rule.create(context).root?.({ type: 'root' })

      expect(report).not.toHaveBeenCalled()
    })

    it('rejects a media reference that is not a site URL', () => {
      const content = readmeWithHero('https://github.com/AndrewRedican/hyperfrontend/blob/main/assets/media/koi-pond/hero.gif?raw=true')
      const workspace = manager.create({ files: { 'nx.json': '{}', 'libs/thing/README.md': content } })
      const report = jest.fn()
      const context = {
        filename: workspace.getPath('libs/thing/README.md'),
        options: OPTIONS,
        sourceCode: { getText: () => content },
        report,
      }

      // @ts-expect-error - partial mock
      rule.create(context).root?.({ type: 'root' })

      expect(report).toHaveBeenCalledWith(expect.objectContaining({ messageId: 'notSiteUrl' }))
    })

    it('rejects a site URL with no committed asset behind it', () => {
      const content = readmeWithHero('https://www.hyperfrontend.dev/media/koi-pond/missing.gif')
      const workspace = manager.create({ files: { 'nx.json': '{}', 'libs/thing/README.md': content } })
      const report = jest.fn()
      const context = {
        filename: workspace.getPath('libs/thing/README.md'),
        options: OPTIONS,
        sourceCode: { getText: () => content },
        report,
      }

      // @ts-expect-error - partial mock
      rule.create(context).root?.({ type: 'root' })

      expect(report).toHaveBeenCalledWith(expect.objectContaining({ messageId: 'missingAsset' }))
    })

    it('ignores badge images', () => {
      const content = readmeWithHero('https://img.shields.io/npm/v/x.svg')
      const workspace = manager.create({ files: { 'nx.json': '{}', 'libs/thing/README.md': content } })
      const report = jest.fn()
      const context = {
        filename: workspace.getPath('libs/thing/README.md'),
        options: OPTIONS,
        sourceCode: { getText: () => content },
        report,
      }

      // @ts-expect-error - partial mock
      rule.create(context).root?.({ type: 'root' })

      expect(report).not.toHaveBeenCalled()
    })

    it('ignores a link that is not media', () => {
      const content = '# Title\n\n[Architecture](./ARCHITECTURE.md)\n'
      const workspace = manager.create({ files: { 'nx.json': '{}', 'libs/thing/README.md': content } })
      const report = jest.fn()
      const context = {
        filename: workspace.getPath('libs/thing/README.md'),
        options: OPTIONS,
        sourceCode: { getText: () => content },
        report,
      }

      // @ts-expect-error - partial mock
      rule.create(context).root?.({ type: 'root' })

      expect(report).not.toHaveBeenCalled()
    })
  })
})
