import type { MarkdownNode } from './model'
import { describe, expect, it } from '@hyperfrontend/testing'
import { parseMarkdown } from './parse'

// why: the kinds and values of a paragraph's children, positions left out.
const shape = (text: string): string[] => {
  const paragraph = parseMarkdown(text).children?.[0]
  return (paragraph?.children ?? []).map((node: MarkdownNode) => `${node.kind}:${node.value ?? node.url ?? ''}`)
}

describe('bare URLs and addresses after a bracket that forms no link', () => {
  it('links a URL and an address inside the failed brackets', () => {
    expect(shape('w [https://a.b/c and x@y.cd here] z\n')).toEqual([
      'text:w [',
      'link:https://a.b/c',
      'text: and ',
      'link:mailto:x@y.cd',
      'text: here] z',
    ])
  })

  it('links a URL after a bracket left open', () => {
    expect(shape('[open https://a.b/c tail\n')).toEqual(['text:[open ', 'link:https://a.b/c', 'text: tail'])
  })

  it('leaves text without any URL as it was', () => {
    expect(shape('[plain] words\n')).toEqual(['text:[plain] words'])
  })

  it('keeps a URL inside a link as the link text', () => {
    expect(shape('[https://a.b/c](https://d.e)\n')).toEqual(['link:https://d.e'])
  })
})
