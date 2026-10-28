import type { WorkspaceGraph } from '../build'
import { execFileSync } from 'node:child_process'
import { after as afterAll } from 'node:test'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { describe, expect, it } from '@hyperfrontend/testing'
import { fixtureNamed, plantFixture } from '../__test-utils__/workspace-fixtures'
import { buildGraph } from '../build'
import { ALL_KINDS, closureOf, entryClosures, hopTo, ruleHop, traceOf } from './closure'

const planted = plantFixture(fixtureNamed('unused-entry-edit'))
execFileSync('git', ['checkout', '-q', planted.base], { cwd: planted.root })
const graph: WorkspaceGraph = buildGraph(planted.root)
const noTypes = createSet([...ALL_KINDS].filter((kind) => kind !== 'type'))

afterAll(() => planted.remove())

/**
 * The files a closure holds, sorted.
 *
 * @param seeds - The files to start from
 * @param kinds - The kinds to follow
 * @returns The paths
 */
function reach(seeds: readonly string[], kinds = ALL_KINDS): string[] {
  return [...closureOf(graph, seeds, kinds).files.keys()].sort()
}

describe('closureOf', () => {
  it('follows imports through an entry into the files the entry reaches, and no further', () => {
    expect(reach(['apps/consumer/src/main.ts'])).toEqual([
      'apps/consumer/src/main.ts',
      'libs/alpha/src/extra/extra-impl.ts',
      'libs/alpha/src/extra/index.ts',
      'libs/alpha/src/shared.ts',
    ])
  })

  it('leaves type-only imports unfollowed for kinds without type, while the side-effect imports of the project still follow', () => {
    expect(reach(['libs/beta/src/index.ts'], noTypes)).toEqual([
      'libs/alpha/src/extra/extra-impl.ts',
      'libs/alpha/src/extra/index.ts',
      'libs/alpha/src/shared.ts',
      'libs/beta/src/all.ts',
      'libs/beta/src/index.ts',
    ])
  })

  it('follows type-only imports for every kind', () => {
    expect(reach(['libs/beta/src/index.ts'])).toEqual([
      'libs/alpha/src/core.ts',
      'libs/alpha/src/extra/extra-impl.ts',
      'libs/alpha/src/extra/index.ts',
      'libs/alpha/src/index.ts',
      'libs/alpha/src/shared.ts',
      'libs/alpha/src/types.ts',
      'libs/beta/src/all.ts',
      'libs/beta/src/index.ts',
    ])
  })

  it('collapses a project whose reachable file loads a module it cannot name', () => {
    const closure = closureOf(graph, ['apps/consumer/src/gamma-user.ts'], ALL_KINDS)
    expect({
      rule: closure.projects.get('lib-gamma')?.rule,
      other: closure.files.has('libs/gamma/src/other.ts'),
      fallbacks: closure.fallbacks.map((item) => `${item.rule} ${item.edge.evidence.file} ${item.project}`),
    }).toEqual({ rule: 'unresolved-import', other: true, fallbacks: ['unresolved-import libs/gamma/src/index.ts lib-gamma'] })
  })

  it('collapses the other members of a cross-project cycle', () => {
    expect(closureOf(graph, ['libs/cycle-a/src/index.ts'], noTypes).projects.get('lib-cycle-b')?.rule).toBe('cycle')
  })

  it('collapses a declared dependency of a project it enters', () => {
    expect(closureOf(graph, ['apps/alpha-e2e/project.json'], ALL_KINDS).projects.get('lib-alpha')?.rule).toBe('declared-dependency')
  })

  it('follows the side-effect imports of a project it enters, whichever entry was consumed', () => {
    const closure = closureOf(graph, ['apps/beta-app/src/main.ts'], noTypes)
    expect(ruleHop(closure, 'libs/alpha/src/extra/extra-impl.ts')?.rule).toBe('side-effect-import')
  })

  it('collapses a project another re-exports whole', () => {
    const closure = closureOf(graph, ['libs/delta/src/index.ts'], ALL_KINDS)
    expect({
      extra: closure.files.get('libs/testing/src/extra.ts')?.rule,
      index: closure.files.get('libs/testing/src/index.ts')?.rule,
    }).toEqual({
      extra: 'external-re-export',
      index: null,
    })
  })

  it('leaves a dangling import as a collapse of the owner of the missing file', () => {
    const dangling = plantFixture(fixtureNamed('deleted-module'))
    try {
      const closure = closureOf(buildGraph(dangling.root), ['apps/consumer/src/main.ts'], ALL_KINDS)
      expect(closure.fallbacks.map((item) => `${item.rule} ${item.edge.evidence.file} → ${item.edge.target}`)).toEqual([
        'unresolved-import libs/alpha/src/extra/extra-impl.ts → file:libs/alpha/src/shared',
        'unresolved-import libs/alpha/src/core.ts → file:libs/alpha/src/shared',
      ])
    } finally {
      dangling.remove()
    }
  })

  it('collapses a project whose production file does not parse as soon as it is entered', () => {
    const broken = plantFixture(fixtureNamed('parse-failure'))
    try {
      const closure = closureOf(buildGraph(broken.root), ['apps/consumer/src/main.ts'], ALL_KINDS)
      expect({ rule: closure.projects.get('lib-alpha')?.rule, core: closure.files.has('libs/alpha/src/core.ts') }).toEqual({
        rule: 'parse-failure',
        core: true,
      })
    } finally {
      broken.remove()
    }
  })

  it('collapses the importer itself when no project owns a dangling path', () => {
    const dangling = plantFixture(fixtureNamed('deleted-module'))
    try {
      const built = buildGraph(dangling.root)
      const closure = closureOf({ ...built, projectOf: () => null }, ['apps/consumer/src/main.ts'], ALL_KINDS)
      expect([...closure.projects.keys()]).toEqual(['lib-alpha'])
    } finally {
      dangling.remove()
    }
  })

  it('ignores an edge to an entry the graph does not know', () => {
    const stub: WorkspaceGraph = {
      ...graph,
      records: [
        ...graph.records,
        {
          source: 'file:apps/consumer/src/main.ts',
          target: 'entry:@fixture/nothing',
          kind: 'value',
          role: 'production',
          path: { specifier: '@fixture/nothing', resolved: null },
          targets: [],
          evidence: { kind: 'source', file: 'apps/consumer/src/main.ts', line: 9, column: 1 },
        },
      ],
    }
    expect(closureOf(stub, ['apps/consumer/src/main.ts'], ALL_KINDS).files.size).toBe(4)
  })
})

describe('traceOf', () => {
  it('lists the files and entries from the seed to the reached file', () => {
    expect(traceOf(closureOf(graph, ['apps/consumer/src/main.ts'], ALL_KINDS), 'libs/alpha/src/shared.ts')).toEqual([
      'file:apps/consumer/src/main.ts',
      'entry:@fixture/alpha/extra',
      'file:libs/alpha/src/extra/index.ts',
      'file:libs/alpha/src/extra/extra-impl.ts',
      'file:libs/alpha/src/shared.ts',
    ])
  })

  it('answers the file alone when the closure does not hold it', () => {
    expect(traceOf(closureOf(graph, [], ALL_KINDS), 'libs/alpha/src/shared.ts')).toEqual(['file:libs/alpha/src/shared.ts'])
  })
})

describe('ruleHop and hopTo', () => {
  it('answers nothing for a file ordinary edges reached', () => {
    expect(ruleHop(closureOf(graph, ['apps/consumer/src/main.ts'], ALL_KINDS), 'libs/alpha/src/shared.ts')).toBeNull()
  })

  it('answers nothing for a file outside the closure', () => {
    expect(ruleHop(closureOf(graph, [], ALL_KINDS), 'libs/alpha/src/shared.ts')).toBeNull()
  })

  it('answers the collapse of a project for a path of it the closure never visited', () => {
    const closure = closureOf(graph, ['apps/consumer/src/gamma-user.ts'], ALL_KINDS)
    expect(hopTo(closure, 'libs/gamma/src/gone.ts', 'lib-gamma')?.rule).toBe('unresolved-import')
  })

  it('answers nothing for a path of no project outside the closure', () => {
    expect(hopTo(closureOf(graph, [], ALL_KINDS), 'nowhere.ts', null)).toBeNull()
  })
})

describe('entryClosures', () => {
  it('computes one closure per entry over every kind', () => {
    expect([...entryClosures(graph).keys()].sort()).toEqual([...graph.entries.keys()].sort())
  })
})
