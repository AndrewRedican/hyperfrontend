import type { Edge, EdgeEvidence } from './model'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { describe, expect, it } from '@hyperfrontend/testing'
import { compareEdges, sortEdges } from './order'
import { Role } from './roles'

const source = (line: number, column = 1): EdgeEvidence => ({ kind: 'source', file: 'libs/a/src/index.ts', line, column })
const configuration = (key: string): EdgeEvidence => ({ kind: 'configuration', file: 'libs/a/project.json', key })

const edge = (overrides: Partial<Edge>): Edge => ({
  source: 'file:libs/a/src/index.ts',
  target: 'entry:@fixture/b',
  kind: 'value',
  role: Role.Production,
  path: { specifier: '@fixture/b', resolved: 'libs/b/src/index.ts' },
  targets: [],
  evidence: source(1),
  ...overrides,
})

describe('sortEdges', () => {
  const edges: readonly Edge[] = [
    edge({ source: 'file:libs/b/src/index.ts' }),
    edge({ target: 'entry:@fixture/a' }),
    edge({ kind: 'type' }),
    edge({ role: Role.Spec }),
    edge({ path: { specifier: '@fixture/b/side', resolved: null } }),
    edge({ evidence: { kind: 'source', file: 'libs/a/src/zed.ts', line: 1, column: 1 } }),
    edge({ evidence: source(2) }),
    edge({ evidence: source(2, 9) }),
    edge({ evidence: configuration('targets.build.inputs') }),
    edge({ evidence: configuration('implicitDependencies') }),
    edge({}),
  ]

  it('serialises two permutations of the same edges identically', () => {
    const reversed = [...edges].reverse()
    expect(stringify(sortEdges(reversed))).toBe(stringify(sortEdges(edges)))
  })

  it('orders by source, target, kind, role, specifier, file, then position', () => {
    expect(sortEdges(edges).map((item) => describeEdge(item))).toEqual([
      'file:libs/a/src/index.ts → entry:@fixture/a value production @fixture/b libs/a/src/index.ts 1:1',
      'file:libs/a/src/index.ts → entry:@fixture/b type production @fixture/b libs/a/src/index.ts 1:1',
      'file:libs/a/src/index.ts → entry:@fixture/b value production @fixture/b libs/a/project.json implicitDependencies',
      'file:libs/a/src/index.ts → entry:@fixture/b value production @fixture/b libs/a/project.json targets.build.inputs',
      'file:libs/a/src/index.ts → entry:@fixture/b value production @fixture/b libs/a/src/index.ts 1:1',
      'file:libs/a/src/index.ts → entry:@fixture/b value production @fixture/b libs/a/src/index.ts 2:1',
      'file:libs/a/src/index.ts → entry:@fixture/b value production @fixture/b libs/a/src/index.ts 2:9',
      'file:libs/a/src/index.ts → entry:@fixture/b value production @fixture/b libs/a/src/zed.ts 1:1',
      'file:libs/a/src/index.ts → entry:@fixture/b value production @fixture/b/side libs/a/src/index.ts 1:1',
      'file:libs/a/src/index.ts → entry:@fixture/b value spec @fixture/b libs/a/src/index.ts 1:1',
      'file:libs/b/src/index.ts → entry:@fixture/b value production @fixture/b libs/a/src/index.ts 1:1',
    ])
  })

  it('leaves the given array untouched', () => {
    const given = [edge({ kind: 'type' }), edge({})]
    sortEdges(given)
    expect(given.map((item) => item.kind)).toEqual(['type', 'value'])
  })
})

describe('compareEdges', () => {
  it('sorts source evidence before configuration evidence in the same file', () => {
    const left = edge({ evidence: { kind: 'source', file: 'libs/a/project.json', line: 1, column: 1 } })
    const right = edge({ evidence: configuration('implicitDependencies') })
    expect([compareEdges(left, right), compareEdges(right, left)]).toEqual([-1, 1])
  })

  it('treats an edge without a specifier as sorting before one with', () => {
    expect(compareEdges(edge({ path: null }), edge({}))).toBe(-1)
  })
})

/**
 * One line describing an edge, for ordered comparisons.
 *
 * @param item - The edge to describe
 * @returns Its fields space-separated, evidence last
 */
function describeEdge(item: Edge): string {
  const position = item.evidence.kind === 'source' ? `${item.evidence.line}:${item.evidence.column}` : item.evidence.key
  return `${item.source} → ${item.target} ${item.kind} ${item.role} ${item.path?.specifier ?? ''} ${item.evidence.file} ${position}`
}
