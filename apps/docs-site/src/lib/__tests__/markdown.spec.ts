import { describe, expect, it } from 'vitest'
import { markdownToHtml } from '../markdown'

// why: The first render loads the shiki highlighter, which outruns the default per-test timeout
const RENDER_TIMEOUT_MS = 30_000

describe('markdownToHtml', () => {
  it(
    'drops authoring comments from the rendered page',
    async () => {
      const html = await markdownToHtml(['Prose.', '', '<!-- TODO(asset): capture the pond loading -->', '', 'More prose.'].join('\n'))

      expect(html).not.toContain('TODO(asset)')
      expect(html).not.toContain('<!--')
    },
    RENDER_TIMEOUT_MS
  )

  it(
    'leaves no comment behind when markers overlap',
    async () => {
      const html = await markdownToHtml('<!<!-- inner -->-- authoring note -->')

      expect(html).not.toContain('<!--')
    },
    RENDER_TIMEOUT_MS
  )

  it(
    'keeps comment syntax inside code samples, where it is sample content',
    async () => {
      const html = await markdownToHtml(['```html', '<!-- unpkg -->', '<script src="https://unpkg.com/pkg"></script>', '```'].join('\n'))

      expect(html).toContain('unpkg')
      expect(html).toContain('--')
    },
    RENDER_TIMEOUT_MS
  )
})
