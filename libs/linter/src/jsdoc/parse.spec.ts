import { describe, expect, it } from '@hyperfrontend/testing'
import { lineMap } from '../text/lines'
import { parseJsdoc, stringifyLine } from './parse'

/**
 * Parses the one JSDoc comment of a text.
 *
 * @param text - A text holding one comment
 * @returns The block parsed
 */
function block(text: string): ReturnType<typeof parseJsdoc> {
  return parseJsdoc(text, text.indexOf('/**'), text.indexOf('*/') + 2, lineMap(text).starts)
}

describe('parseJsdoc', () => {
  it('reads a description and the tags with their types, names and descriptions', () => {
    const parsed = block(
      '  /**\n   * Adds two numbers.\n   *\n   * @param {number} a - The first\n   * @param {number} b\n   *   continued\n   * @returns {number} The sum\n   */\n'
    )
    expect([parsed.description, parsed.tags.map((tag) => [tag.tag, tag.type, tag.name, tag.description, tag.index])]).toEqual([
      'Adds two numbers.\n',
      [
        ['param', 'number', 'a', '- The first', 3],
        ['param', 'number', 'b', '\ncontinued', 4],
        ['returns', 'number', '', 'The sum', 6],
      ],
    ])
  })

  it('keeps every token so that a line stringifies back to itself', () => {
    const text = '\t/**  Text  \n\t *\t@param  {T}  [x=1]  desc \r\n\t */'
    const parsed = block(text)
    // why: the carriage return stays on its line, as a token of it.
    expect(parsed.lines.map((line) => stringifyLine(line.tokens))).toEqual(text.split(/\n/))
  })

  it('reads a bracketed name with its default', () => {
    const tag = block('/** @param {string} [name=hello world] desc */').tags[0]
    expect([tag?.name, tag?.optional, tag?.default, tag?.description, tag?.lines[0]?.tokens.name]).toEqual([
      'name',
      true,
      'hello world',
      'desc ',
      '[name=hello world]',
    ])
  })

  it('reads a bracketed name without a default', () => {
    const tag = block('/** @param [name] */').tags[0]
    expect([tag?.name, tag?.optional, tag?.default]).toEqual(['name', true, null])
  })

  it('reads a quoted name', () => {
    const tag = block('/** @param {number} "0" the first */').tags[0]
    expect([tag?.name, tag?.lines[0]?.tokens.name, tag?.description]).toEqual(['0', '"0"', 'the first '])
  })

  it('reads an unclosed quote as a plain word', () => {
    const tag = block('/** @param "abc */').tags[0]
    expect([tag?.name, tag?.description]).toEqual(['"abc', ''])
  })

  it('reads no name from brackets left open', () => {
    const tag = block('/** @param [abc desc */').tags[0]
    expect([tag?.name, tag?.optional, tag?.description]).toEqual(['', false, '[abc desc '])
  })

  it('reads a type that spans lines', () => {
    const tag = block('/**\n * @param {Object<string,\n *   number>} map desc\n */').tags[0]
    expect([tag?.type, tag?.name, tag?.description, tag?.lines.map((line) => line.tokens.type)]).toEqual([
      'Object<string,\nnumber>',
      'map',
      'desc',
      ['{Object<string,', 'number>}', ''],
    ])
  })

  it('leaves an unclosed type open', () => {
    const tag = block('/**\n * @param {Object<string\n * desc\n */').tags[0]
    expect([tag?.type, tag?.name]).toEqual(['Object<string\ndesc\n', ''])
  })

  it('takes no type on a typeless tag and no name on a nameless one', () => {
    const parsed = block('/**\n * @default {}\n * @example {code} here\n * @see {@link Foo} there\n * @see {Foo} bar\n */')
    expect(parsed.tags.map((tag) => [tag.type, tag.name, tag.description])).toEqual([
      ['', '', '{}'],
      ['', '', '{code} here'],
      ['', '{@link', 'Foo} there'],
      ['', '{Foo}', 'bar'],
    ])
  })

  it('reads a tag that ends its line', () => {
    const parsed = block('/**\n * @abstract\n */')
    expect(parsed.tags.map((tag) => [tag.tag, tag.lines[0]?.tokens.tag, tag.lines[0]?.tokens.postTag])).toEqual([
      ['abstract', '@abstract', ''],
    ])
  })

  it('numbers lines and records where each starts', () => {
    const text = 'const a = 1\n/**\n * x\n */\n'
    const parsed = block(text)
    expect(parsed.lines.map((line) => [line.number, line.offset])).toEqual([
      [2, 12],
      [3, 16],
      [4, 21],
    ])
  })

  it('treats the text before the comment on its line as indentation', () => {
    const parsed = block('app.use(/** @type {X} */ (a) => a)')
    expect([parsed.lines[0]?.tokens.start, parsed.lines[0]?.tokens.end, parsed.tags[0]?.type]).toEqual(['        ', '*/', 'X'])
  })

  it('reads a one-line comment with a bare tag', () => {
    const parsed = block('/** @abstract */')
    expect(parsed.tags.map((tag) => [tag.tag, tag.name, tag.lines[0]?.tokens.postTag])).toEqual([['abstract', '', ' ']])
  })

  it('reads the description of a block without tags, closing line left out', () => {
    expect(block('/**\n * First.\n * Second.\n */').description).toBe('First.\nSecond.')
  })

  it('reads a line starting with @ inside a code fence as text', () => {
    expect(block('/**\n * @example\n * ```ts\n * @decorator()\n * ```\n * @see x\n */').tags.map((tag) => tag.tag)).toEqual([
      'example',
      'see',
    ])
  })

  it('reads an @ followed by whitespace, and a scoped package name, as text', () => {
    expect(block('/**\n * @ x\n * @\n * @scope/name\n */').tags.length).toBe(0)
  })

  it('reads the name on the line after a type that ends its line', () => {
    expect(block('/**\n * @param {string}\n *   foo The foo.\n */').tags[0]?.name).toBe('foo')
  })

  it('reads no name after a type when every later line is blank', () => {
    expect(block('/**\n * @param {string}\n *\n */').tags[0]?.name).toBe('')
  })

  it('reads a template list with spaces after its commas as one name', () => {
    expect(block('/**\n * @template T, U - The types\n */').tags[0]?.name).toBe('T, U')
  })
})
