import type { Node } from '../../../code/model.ts'
import type { ScopeAnalysis } from '../../../scope/analysis.ts'
import { describe, expect, it } from '@hyperfrontend/testing'
import { childrenOf } from '../../../code/children.ts'
import { parseCode } from '../../../code/parse.ts'
import { DEFAULT_LANGUAGE } from '../../../config/model.ts'
import { analyzeScopes } from '../../../scope/analysis.ts'
import { isReferenceToGlobal } from './references.ts'

/** A parsed text with its scopes and the names its type references make. */
interface Probe {
  /** The scope analysis of the text. */
  readonly analysis: ScopeAnalysis
  /** The identifiers of the type references, in source order. */
  readonly names: readonly Node[]
}

/**
 * Parses a text and collects the identifiers of its type references.
 *
 * @param text - The text parsed
 * @returns The analysis and the identifiers
 */
function probe(text: string): Probe {
  const tree = parseCode(text, '.ts').tree as Node
  const names: Node[] = []
  const walk = (node: Node): void => {
    if (node.kind === 'TSTypeReference') names.push(node.typeName as Node)
    for (const child of childrenOf(node)) walk(child)
  }
  walk(tree)
  return { analysis: analyzeScopes(tree, DEFAULT_LANGUAGE), names }
}

describe('isReferenceToGlobal', () => {
  it('answers true for a global of the language', () => {
    const { analysis, names } = probe('let value: Function;')
    expect(isReferenceToGlobal(analysis, names[0] as Node, 'Function')).toBe(true)
  })

  it('answers true for a name nothing declares', () => {
    const { analysis, names } = probe('let value: Nope;')
    expect(isReferenceToGlobal(analysis, names[0] as Node, 'Nope')).toBe(true)
  })

  it('answers false for a name a scope in reach declares', () => {
    const { analysis, names } = probe('{ type Function = () => void; let value: Function; }')
    expect(isReferenceToGlobal(analysis, names[0] as Node, 'Function')).toBe(false)
  })

  it('answers true when the scope makes no reference of the name', () => {
    const { analysis, names } = probe('let value: Function;')
    expect(isReferenceToGlobal(analysis, names[0] as Node, 'Other')).toBe(true)
  })
})
