import type { Node } from '../../../code/model.ts'
import type { ScopeAnalysis } from '../../../scope/analysis.ts'
import { describe, expect, it } from '@hyperfrontend/testing'
import { childrenOf } from '../../../code/children.ts'
import { parseCode } from '../../../code/parse.ts'
import { DEFAULT_LANGUAGE } from '../../../config/model.ts'
import { analyzeScopes } from '../../../scope/analysis.ts'
import { isConstant, isGlobalReference, isLogicalIdentity, isTruthyLiteral, referenceOf } from './constant.ts'

/** A program with its scope analysis. */
interface Analysed {
  /** The program. */
  readonly tree: Node
  /** Its analysis. */
  readonly analysis: ScopeAnalysis
}

/**
 * Parses a module and analyses its scopes.
 *
 * @param text - The module's text
 * @returns The program and its analysis
 */
function analyse(text: string): Analysed {
  const tree = parseCode(text, '.ts').tree as Node
  return { tree, analysis: analyzeScopes(tree, DEFAULT_LANGUAGE) }
}

/**
 * The first node of a kind under a root, in source order.
 *
 * @param root - The root searched
 * @param kind - The kind wanted
 * @param name - The name an identifier must carry, when one is wanted
 * @returns The node
 */
function find(root: Node, kind: string, name = ''): Node {
  const search = (node: Node): Node | null => {
    if (node.kind === kind && (name === '' || node.name === name)) return node
    for (const child of childrenOf(node)) {
      const found = search(child)
      if (found !== null) return found
    }
    return null
  }
  return search(root) as Node
}

describe('referenceOf', () => {
  it('answers null for an identifier that makes no reference', () => {
    const { tree, analysis } = analyse('a.b')
    expect(referenceOf(analysis, find(tree, 'Identifier', 'b'))).toBe(null)
  })
})

describe('isGlobalReference', () => {
  it('holds for the language`s undefined', () => {
    const { tree, analysis } = analyse('undefined')
    expect(isGlobalReference(analysis, find(tree, 'Identifier', 'undefined'))).toBe(true)
  })

  it('fails for a name the module declares', () => {
    const { tree, analysis } = analyse('const undefined = 1; undefined')
    expect(isGlobalReference(analysis, find(tree, 'ExpressionStatement').expression as Node)).toBe(false)
  })
})

describe('isTruthyLiteral', () => {
  it('holds for a regular expression', () => {
    expect(isTruthyLiteral(find(analyse('/a/').tree, 'Literal'))).toBe(true)
  })

  it('fails for null', () => {
    expect(isTruthyLiteral(find(analyse('null').tree, 'Literal'))).toBe(false)
  })
})

describe('isLogicalIdentity', () => {
  it('holds for a truthy literal on an or', () => {
    expect(isLogicalIdentity(find(analyse('1 || a').tree, 'Literal'), '||')).toBe(true)
  })

  it('fails for a truthy literal on an and', () => {
    expect(isLogicalIdentity(find(analyse('1 && a').tree, 'Literal'), '&&')).toBe(false)
  })

  it('fails for a falsy literal on a nullish coalescing', () => {
    expect(isLogicalIdentity(find(analyse('a ?? false').tree, 'Literal'), '??')).toBe(false)
  })
})

describe('isConstant', () => {
  it('holds for a sequence ending in a literal', () => {
    const { tree, analysis } = analyse('(a, 1)')
    expect(isConstant(analysis, find(tree, 'SequenceExpression'), true)).toBe(true)
  })

  it('fails for a call of something other than Boolean', () => {
    const { tree, analysis } = analyse('String(1)')
    expect(isConstant(analysis, find(tree, 'CallExpression'), true)).toBe(false)
  })
})
