import type { MediaCatalog, ResolvedMedia } from './transform'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { describe, expect, it } from '@hyperfrontend/testing'
import { transformReadme } from './transform'

const LANDING = 'https://www.hyperfrontend.dev/docs/libraries/builder/'

/** A catalog that knows one scene, with an animation for every stem, and nothing else. */
const catalog: MediaCatalog = {
  resolve(scene, asset): ResolvedMedia {
    if (scene !== 'builder-manifest') {
      throw createError(`no scene named "${scene}"`)
    }
    return { url: `https://www.hyperfrontend.dev/media/${scene}/${asset}.gif`, width: 640, height: 360 }
  },
}

const SOURCE = [
  '# @hyperfrontend/builder',
  '',
  'Intro prose.',
  '',
  '## Layout',
  '',
  'Lead-in that stays.',
  '',
  '<!-- hf:media start id="layout" scene="builder-manifest" docs="architecture/" alt="The manifest the build writes" -->',
  '| Field | Written from |',
  '| --- | --- |',
  '| exports | what landed |',
  '<!-- hf:media end -->',
  '',
  '```bash',
  'npm install @hyperfrontend/builder',
  '```',
].join('\n')

describe('transformReadme', () => {
  it('replaces the region with a linked, sized visual and keeps everything else byte for byte', () => {
    const { markdown } = transformReadme(SOURCE, { docsLanding: LANDING, catalog })
    expect(markdown).toBe(
      [
        '# @hyperfrontend/builder',
        '',
        'Intro prose.',
        '',
        '## Layout',
        '',
        'Lead-in that stays.',
        '',
        '<p align="center">',
        '  <a href="https://www.hyperfrontend.dev/docs/libraries/builder/architecture/">',
        '    <img width="640" height="360" src="https://www.hyperfrontend.dev/media/builder-manifest/hero.gif" alt="The manifest the build writes">',
        '  </a>',
        '</p>',
        '',
        '```bash',
        'npm install @hyperfrontend/builder',
        '```',
      ].join('\n')
    )
  })

  it('accounts for each region it replaced', () => {
    const { replacements } = transformReadme(SOURCE, { docsLanding: LANDING, catalog })
    expect(replacements).toEqual([
      expect.objectContaining({
        id: 'layout',
        before: '| Field | Written from |\n| --- | --- |\n| exports | what landed |',
        docs: 'https://www.hyperfrontend.dev/docs/libraries/builder/architecture/',
        media: expect.objectContaining({ url: 'https://www.hyperfrontend.dev/media/builder-manifest/hero.gif' }),
      }),
    ])
  })

  it('writes a source with no regions through unchanged', () => {
    const plain = '# Title\n\nProse only.\n'
    expect(transformReadme(plain, { docsLanding: LANDING, catalog })).toEqual({ markdown: plain, replacements: [] })
  })

  it('is deterministic', () => {
    const first = transformReadme(SOURCE, { docsLanding: LANDING, catalog }).markdown
    const second = transformReadme(SOURCE, { docsLanding: LANDING, catalog }).markdown
    expect(first).toBe(second)
  })

  it('links to the landing page when no docs are named, and resolves an anchor, a path or an absolute URL', () => {
    const region = (docs: string): string =>
      `<!-- hf:media start id="r" scene="builder-manifest" alt="x"${docs} -->\nbody\n<!-- hf:media end -->`
    const resolved = ['', ' docs="#api-build"', ' docs="/bundle/"', ' docs="https://example.com/x"'].map(
      (docs) => transformReadme(region(docs), { docsLanding: LANDING, catalog }).replacements[0]?.docs
    )
    expect(resolved).toEqual([LANDING, `${LANDING}#api-build`, `${LANDING}bundle/`, 'https://example.com/x'])
  })

  it('asks the catalog for the stem the directive names', () => {
    const source = '<!-- hf:media start id="r" scene="builder-manifest" asset="poster" alt="x" -->\n<!-- hf:media end -->'
    expect(transformReadme(source, { docsLanding: LANDING, catalog }).markdown).toContain('builder-manifest/poster.gif')
  })

  it('escapes attribute text', () => {
    const source = '<!-- hf:media start id="r" scene="builder-manifest" alt="a <b> & \'c\'" -->\n<!-- hf:media end -->'
    expect(transformReadme(source, { docsLanding: LANDING, catalog }).markdown).toContain('alt="a &lt;b&gt; &amp; \'c\'"')
  })

  it('refuses a document whose directives cannot be read, naming each line', () => {
    const source = '# T\n<!-- hf:media start id="a" scene="s" -->\nbody'
    expect(() => transformReadme(source, { docsLanding: LANDING, catalog })).toThrow(/line 2: a directive needs alt/)
  })

  it('refuses a region whose media the catalog cannot find, naming the region', () => {
    const source = '<!-- hf:media start id="missing" scene="nowhere" alt="x" -->\n<!-- hf:media end -->'
    expect(() => transformReadme(source, { docsLanding: LANDING, catalog })).toThrow(
      /Region "missing" \(line 1\): no scene named "nowhere"/
    )
  })

  it('reports a non-error thrown by the catalog as text', () => {
    const throwing: MediaCatalog = {
      resolve() {
        throw 'gone'
      },
    }
    const source = '<!-- hf:media start id="r" scene="s" alt="x" -->\n<!-- hf:media end -->'
    expect(() => transformReadme(source, { docsLanding: LANDING, catalog: throwing })).toThrow(/Region "r" \(line 1\): gone/)
  })
})
