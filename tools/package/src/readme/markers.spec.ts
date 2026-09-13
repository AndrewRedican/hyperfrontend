import { describe, expect, it } from '@hyperfrontend/testing'
import { parseMarkers } from './markers'

/**
 * A document with one region around a table.
 *
 * @param attributes - What the start marker carries.
 * @returns Markdown.
 */
function withRegion(attributes: string): string {
  return ['# Title', '', `<!-- hf:media start ${attributes} -->`, '| a | b |', '| - | - |', '<!-- hf:media end -->', '', 'After.'].join(
    '\n'
  )
}

describe('parseMarkers', () => {
  it('reads a region with every attribute', () => {
    const parsed = parseMarkers(withRegion('id="layout" scene="builder-manifest" asset="poster" docs="architecture/" alt="The manifest"'))
    expect(parsed).toEqual({
      problems: [],
      directives: [
        { id: 'layout', scene: 'builder-manifest', asset: 'poster', docs: 'architecture/', alt: 'The manifest', startLine: 2, endLine: 5 },
      ],
    })
  })

  it('defaults the asset to hero and leaves docs undefined', () => {
    const [directive] = parseMarkers(withRegion('id="a" scene="s" alt="x"')).directives
    expect(directive).toEqual(expect.objectContaining({ asset: 'hero', docs: undefined }))
  })

  it('treats an empty docs as absent', () => {
    const [directive] = parseMarkers(withRegion('id="a" scene="s" alt="x" docs=""')).directives
    expect(directive).toEqual(expect.objectContaining({ docs: undefined }))
  })

  it('tolerates spacing inside the markers', () => {
    const source = ['<!--   hf:media   start   id="a"   scene="s"   alt="x"  -->  ', 'body', '<!--hf:media end-->'].join('\n')
    const parsed = parseMarkers(source)
    expect(parsed).toEqual({ problems: [], directives: [expect.objectContaining({ id: 'a', startLine: 0, endLine: 2 })] })
  })

  it('allows an empty region', () => {
    const parsed = parseMarkers(['<!-- hf:media start id="a" scene="s" alt="x" -->', '<!-- hf:media end -->'].join('\n'))
    expect(parsed).toEqual({ problems: [], directives: [expect.objectContaining({ startLine: 0, endLine: 1 })] })
  })

  it('reads several regions in document order', () => {
    const source = [
      '<!-- hf:media start id="one" scene="s" alt="x" -->',
      '<!-- hf:media end -->',
      'between',
      '<!-- hf:media start id="two" scene="t" alt="y" -->',
      'inner',
      '<!-- hf:media end -->',
    ].join('\n')
    expect(parseMarkers(source).directives.map((directive) => directive.id)).toEqual(['one', 'two'])
  })

  it('ignores markers inside fenced code blocks and reports a lookalike outside them', () => {
    const source = [
      '```md',
      '<!-- hf:media start id="a" scene="s" alt="x" -->',
      '<!-- hf:media end -->',
      '```',
      '<!-- hf:media start id="b" scene="s" alt="x"',
    ].join('\n')
    expect(parseMarkers(source)).toEqual({
      directives: [],
      problems: [{ line: 4, reason: expect.stringContaining('looks like a directive') }],
    })
  })

  it('leaves ordinary comments alone', () => {
    const parsed = parseMarkers('<!-- ALL-CONTRIBUTORS-BADGE:START -->\ntext\n<!-- a note -->')
    expect(parsed).toEqual({ directives: [], problems: [] })
  })

  it('reports an unclosed region on its start line', () => {
    const parsed = parseMarkers('# T\n<!-- hf:media start id="a" scene="s" alt="x" -->\nbody')
    expect(parsed).toEqual({ directives: [], problems: [{ line: 1, reason: expect.stringContaining('never closed') }] })
  })

  it('reports an end marker with nothing open', () => {
    expect(parseMarkers('<!-- hf:media end -->').problems).toEqual([{ line: 0, reason: expect.stringContaining('no region open') }])
  })

  it('reports a region opened inside another, and still reads the inner one', () => {
    const source = [
      '<!-- hf:media start id="a" scene="s" alt="x" -->',
      '<!-- hf:media start id="b" scene="s" alt="x" -->',
      '<!-- hf:media end -->',
    ].join('\n')
    const parsed = parseMarkers(source)
    expect(parsed).toEqual({
      problems: [{ line: 1, reason: expect.stringContaining('still open') }],
      directives: [expect.objectContaining({ id: 'b' })],
    })
  })

  it('reports a duplicate id', () => {
    const source = [
      '<!-- hf:media start id="a" scene="s" alt="x" -->',
      '<!-- hf:media end -->',
      '<!-- hf:media start id="a" scene="s" alt="x" -->',
      '<!-- hf:media end -->',
    ].join('\n')
    const parsed = parseMarkers(source)
    expect(parsed).toEqual({
      problems: [{ line: 2, reason: expect.stringContaining('used twice') }],
      directives: [expect.objectContaining({ id: 'a' })],
    })
  })

  it('reports each malformed attribute list', () => {
    const cases: ReadonlyArray<[string, string]> = [
      ['id="a" scene="s" alt="x" colour="red"', 'unknown attribute "colour"'],
      ['id="a" id="b" scene="s" alt="x"', 'given twice'],
      ['id="a" scene="s" alt="x" stray', 'name="value"'],
      ['scene="s" alt="x"', 'needs id="..."'],
      ['id="a" alt="x"', 'needs scene="..."'],
      ['id="a" scene="s"', 'needs alt="..."'],
      ['id="a" scene="s" alt=""', 'needs alt="..."'],
      ['id="Not-Kebab" scene="s" alt="x"', 'id "Not-Kebab"'],
      ['id="a--b" scene="s" alt="x"', 'id "a--b"'],
      ['id="a" scene="my scene" alt="x"', 'scene "my scene"'],
      ['id="a" scene="s" asset="hero.gif" alt="x"', 'asset "hero.gif"'],
      ['id="a" scene="s" asset="hero.dark" alt="x"', 'asset "hero.dark"'],
      ['id="a" scene="s" kind="still" alt="x"', 'unknown attribute "kind"'],
    ]
    const outcomes = cases.map(([attributes]) => parseMarkers(withRegion(attributes)))
    expect(outcomes).toEqual(
      cases.map(([, expected]) => ({ directives: [], problems: [expect.objectContaining({ reason: expect.stringContaining(expected) })] }))
    )
  })

  it('accepts hyphenated scene slugs and asset stems', () => {
    const [directive] = parseMarkers(withRegion('id="a1" scene="feature-session" asset="poster-wide" alt="x"')).directives
    expect(directive).toEqual(expect.objectContaining({ scene: 'feature-session', asset: 'poster-wide' }))
  })
})
