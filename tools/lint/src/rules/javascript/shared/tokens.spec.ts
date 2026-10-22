import type { Node } from '../../../code/model.ts'
import type { RuleFile } from '../../../engine/rule.ts'
import { describe, expect, it } from '@hyperfrontend/testing'
import { parseCode } from '../../../code/parse.ts'
import { lineMap } from '../../../text/lines.ts'
import { sameTokens } from './tokens.ts'

/** A parsed text with the nodes compared. */
interface Parsed {
  /** The program. */
  readonly program: Node
  /** The file. */
  readonly file: RuleFile
  /** The expressions of the statements, in order. */
  readonly expressions: readonly Node[]
}

/**
 * Parses a text of expression statements.
 *
 * @param text - The text parsed
 * @param extension - The extension it is parsed with
 * @returns The program, the file and the expressions
 */
function parse(text: string, extension = '.ts'): Parsed {
  const parsed = parseCode(text, extension)
  const program = parsed.tree as Node
  const file = {
    path: `/w/a${extension}`,
    root: '/w',
    relativePath: `a${extension}`,
    text,
    lines: lineMap(text),
    comments: parsed.comments,
  }
  return { program, file, expressions: (program.body as readonly Node[]).map((statement) => statement.expression as Node) }
}

describe('sameTokens', () => {
  it('matches nodes that differ only in spacing and comments', () => {
    const { program, file, expressions } = parse('f(a + 1).b;\nf( a /* c */ +1 )\n.b')
    expect(sameTokens(program, file, expressions[0] as Node, expressions[1] as Node)).toBe(true)
  })

  it('rejects nodes with different token counts', () => {
    const { program, file, expressions } = parse('f(a);\nf(a, b)')
    expect(sameTokens(program, file, expressions[0] as Node, expressions[1] as Node)).toBe(false)
  })

  it('rejects nodes with a different token', () => {
    const { program, file, expressions } = parse('a == b;\na === b')
    expect(sameTokens(program, file, expressions[0] as Node, expressions[1] as Node)).toBe(false)
  })

  it('rejects tokens of another category with the same text', () => {
    const { program, file, expressions } = parse('a;\n<p>a</p>', '.tsx')
    const text = ((expressions[1] as Node).children as readonly Node[])[0] as Node
    expect(sameTokens(program, file, expressions[0] as Node, text)).toBe(false)
  })
})
