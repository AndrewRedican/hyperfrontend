import type { Node } from '../code/model'
import type { RuleContext } from '../engine/rule'
import { readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { childrenOf } from '../code/children'
import { parseCode } from '../code/parse'
import { DEFAULT_LANGUAGE } from '../config/model'
import { dumpFlow } from './__fixtures__/dump'
import { analyzeFlow, flowAnalysisOf } from './analysis'

const FIXTURES = join(import.meta.dirname, '__fixtures__')

/**
 * Every switch case of a tree, in source order.
 *
 * @param node - The node searched
 * @param found - The cases found so far
 * @returns The cases found
 */
function switchCases(node: Node, found: Node[] = []): Node[] {
  if (node.kind === 'SwitchCase') found.push(node)
  for (const child of childrenOf(node)) switchCases(child, found)
  return found
}

describe('analyzeFlow', () => {
  for (const file of ['control.ts', 'exceptions.ts', 'expressions.tsx']) {
    it(`builds ${file} as recorded`, () => {
      const expected = readFileSync(join(FIXTURES, file.replace(/\.[a-z]+$/, '.flow')), 'utf8')
        .trimEnd()
        .split(/\r?\n/)
      const tree = parseCode(readFileSync(join(FIXTURES, file), 'utf8'), extname(file)).tree as Node
      expect(dumpFlow(analyzeFlow(tree), switchCases(tree)).join('\n')).toBe(expected.join('\n'))
    })
  }

  it('answers no segment for a node never evaluated', () => {
    const tree = parseCode('type T = number\n', '.ts').tree as Node
    expect(analyzeFlow(tree).segmentOf((tree.body as Node[])[0] as Node)).toBeUndefined()
  })

  it('answers no end segments for a case it never saw', () => {
    const tree = parseCode('a\n', '.ts').tree as Node
    expect(analyzeFlow(tree).caseEnd(tree)).toEqual([])
  })
})

describe('flowAnalysisOf', () => {
  const context = (tree: Node): RuleContext<unknown, Node> => ({
    file: { path: '/w/a.ts', root: '/w', relativePath: 'a.ts', text: '', lines: { starts: [0], text: '' }, comments: [] },
    tree,
    options: undefined,
    settings: {},
    language: DEFAULT_LANGUAGE,
    report: () => undefined,
  })

  it('builds the analysis once per program', () => {
    const tree = parseCode('a\n', '.ts').tree as Node
    expect(flowAnalysisOf(context(tree))).toBe(flowAnalysisOf(context(tree)))
  })
})
