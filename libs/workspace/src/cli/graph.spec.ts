import type { Mock } from '@hyperfrontend/testing'
import type { WorkspaceGraph } from '../graph/build'
import type { EdgeGroup, GraphNode, ProjectRecord } from '../graph/model'
import type { AffectedSet } from '../graph/selection'
import type { StateStatus } from '../graph/store/state'
import type { GraphOutput } from './graph'
import { posix } from 'node:path'
import { beforeEach } from 'node:test'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { selectAffected } from '../graph/affected/select'
import { workspaceGraph } from '../graph/build'
import { changeSet, resolveBase } from '../graph/changes'
import { previousGraph } from '../graph/revision'
import { buildState, stateStatus, verifyState } from '../graph/store/state'
import { runGraph } from './graph'

jest.mock('../graph/affected/select', () => ({ selectAffected: jest.fn() }))
jest.mock('../graph/build', () => ({ workspaceGraph: jest.fn() }))
jest.mock('../graph/changes', () => ({ changeSet: jest.fn(), DEFAULT_BASE: 'origin/main', resolveBase: jest.fn() }))
jest.mock('../graph/revision', () => ({ previousGraph: jest.fn() }))
jest.mock('../graph/store/state', () => ({ buildState: jest.fn(), stateStatus: jest.fn(), verifyState: jest.fn() }))

const mockSelect = selectAffected as Mock
const mockGraph = workspaceGraph as Mock
const mockChanges = changeSet as Mock
const mockResolveBase = resolveBase as Mock
const mockPrevious = previousGraph as Mock
const mockBuild = buildState as Mock
const mockStatus = stateStatus as Mock
const mockVerify = verifyState as Mock

/** The workspace root of these cases; every collaborator that reads it is a mock. */
const ROOT = '/workspace'

/** A change set, as opaque to the command as the graph it is read with. */
const CHANGES = { base: 'a1b2c3', head: null, changes: [] }

/** The graph at the base revision, as opaque as the change set. */
const PREVIOUS = { root: '/checkout' }

/** What a run wrote and answered. */
interface Run {
  /** The exit code. */
  readonly code: number
  /** The lines of the result. */
  readonly said: readonly string[]
  /** The lines about what the command did on the way. */
  readonly noted: readonly string[]
}

/**
 * A project of the fixture graph.
 *
 * @param name - What the project is called
 * @param root - Where it lives, workspace-relative
 * @param tags - The labels it carries
 * @returns The record, its manifest and configuration set so printing can be seen to drop them
 */
function project(name: string, root: string, tags: readonly string[] = []): ProjectRecord {
  return {
    name,
    root,
    type: root.startsWith('apps') ? 'app' : 'lib',
    tags,
    implicitDependencies: [],
    files: [posix.join(root, 'src/index.ts')],
    manifest: { name: `@fixture/${name}` },
    configuration: { name },
  } as ProjectRecord
}

/**
 * A group of edges between two projects.
 *
 * @param source - The depending project
 * @param target - The node depended on
 * @param files - The files drawing the edges
 * @param role - The role of those files
 * @returns The edges of those files as one group
 */
function group(source: string, target: string, files: readonly string[], role = 'production'): EdgeGroup {
  return { source, target, kind: 'value', role, files } as EdgeGroup
}

/**
 * The fixture graph: `lib-zed` before `app-shop` in the map, so name order is the command's own
 * doing; `app-shop` depends on both libraries and `lib-idle` has no groups of its own at all.
 *
 * @returns A graph with exactly what these cases read
 */
function graph(): WorkspaceGraph {
  const nodes: GraphNode[] = [
    { kind: 'project', name: 'lib-zed' },
    { kind: 'project', name: 'app-shop' },
    { kind: 'file', path: 'libs/zed/src/index.ts' },
  ] as GraphNode[]
  return {
    root: ROOT,
    projects: createMap([
      ['lib-zed', project('lib-zed', 'libs/zed', ['scope:zed', 'type:util'])],
      ['app-shop', project('app-shop', 'apps/shop')],
      ['lib-idle', project('lib-idle', 'libs/idle')],
    ]),
    nodes: createMap(nodes.map((node, index) => [String(index), node])),
    records: [{ source: 'project:app-shop', target: 'project:lib-zed' }],
    groups: createMap([
      [
        'app-shop',
        [
          group('app-shop', 'project:lib-zed', ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts']),
          group('app-shop', 'project:lib-zed', ['a.spec.ts'], 'test'),
          group('app-shop', 'project:lib-alpha', ['a.ts', 'b.ts']),
        ],
      ],
      ['lib-zed', []],
    ]),
  } as unknown as WorkspaceGraph
}

/**
 * Runs the command, keeping what it wrote.
 *
 * @param argv - The arguments after `graph`
 * @returns The exit code and the lines of both streams
 */
function run(argv: readonly string[]): Run {
  const said: string[] = []
  const noted: string[] = []
  const output: GraphOutput = { say: (line) => said.push(line), note: (line) => noted.push(line) }
  return { code: runGraph(argv, ROOT, output), said, noted }
}

/**
 * The state a build answers.
 *
 * @param written - The state files whose bytes changed
 * @returns The built state with a fixed plan and duration
 */
function built(written: readonly string[]): unknown {
  return {
    graph: graph(),
    outcome: { plan: { mode: 'incremental', reasons: ['1 changed', '0 deleted'], reparse: ['a.ts', 'b.ts'] }, written, durationMs: 41.6 },
  }
}

/**
 * The set a selection answers: `app-shop:test` selected, `lib-zed:test` skipped.
 *
 * @param target - The target decided
 * @returns The decisions for that target
 */
function selected(target = 'test'): AffectedSet {
  return {
    target,
    changes: CHANGES,
    selected: [{ task: 'app-shop:test', reasons: [] }],
    skipped: [{ task: 'lib-zed:test', reasons: [] }],
    fallbacks: [],
  } as AffectedSet
}

/**
 * What `status` reports.
 *
 * @param difference - The fields that differ from a workspace with no state
 * @returns The report, with a cold plan unless overridden
 */
function status(difference: Partial<StateStatus> = {}): StateStatus {
  return {
    present: false,
    meta: null,
    digests: null,
    plan: { mode: 'cold', reasons: ['no state'], added: [], changed: [], deleted: [], reparse: 12 },
    ...difference,
  } as StateStatus
}

beforeEach(() => {
  for (const mock of [mockSelect, mockGraph, mockChanges, mockPrevious, mockBuild, mockStatus, mockVerify]) mock.mockReset()
  mockGraph.mockReturnValue(graph())
  mockBuild.mockReturnValue(built(['graph.json']))
  mockChanges.mockReturnValue(CHANGES)
  mockResolveBase.mockImplementation((_root: string, base: string) => base)
  mockPrevious.mockReturnValue(PREVIOUS)
  mockSelect.mockImplementation((options: { targets: readonly string[] }) =>
    createMap(options.targets.map((target) => [target, selected(target)]))
  )
})

describe('runGraph projects', () => {
  it('prints a line per project in name order: name, type, root and tags', () => {
    expect(run(['projects'])).toEqual({
      code: 0,
      said: ['app-shop\tapp\tapps/shop\t', 'lib-idle\tlib\tlibs/idle\t', 'lib-zed\tlib\tlibs/zed\tscope:zed,type:util'],
      noted: [],
    })
  })

  it('prints the records without manifest or configuration under --json', () => {
    const { said } = run(['projects', '--json'])
    expect(parse(said.join('\n'))[2]).toEqual({
      name: 'lib-zed',
      root: 'libs/zed',
      type: 'lib',
      tags: ['scope:zed', 'type:util'],
      implicitDependencies: [],
      files: ['libs/zed/src/index.ts'],
    })
  })
})

describe('runGraph graph', () => {
  it('prints the totals, then the nodes counted by kind', () => {
    expect(run(['graph']).said).toEqual(['3 projects, 3 nodes, 1 edges', '  project: 2', '  file: 1'])
  })

  it('prints projects, nodes and edges under --json', () => {
    const parsed = parse(run(['graph', '--json']).said.join('\n'))
    expect({ projects: parsed.projects.length, nodes: parsed.nodes.length, edges: parsed.edges }).toEqual({
      projects: 3,
      nodes: 3,
      edges: [{ source: 'project:app-shop', target: 'project:lib-zed' }],
    })
  })
})

describe('runGraph explain of a project', () => {
  it('prints what a project depends on by target in name order, counting the files past the third', () => {
    expect(run(['explain', 'app-shop']).said).toEqual([
      'app-shop (app, apps/shop)',
      'depends on',
      '  → project:lib-alpha',
      '      value production (2 files): a.ts, b.ts',
      '  → project:lib-zed',
      '      value production (5 files): a.ts, b.ts, c.ts, +2 more',
      '      value test (1 file): a.spec.ts',
      'depended on by',
    ])
  })

  it('prints what depends on a project by source, under an empty list of what it depends on', () => {
    expect(run(['explain', 'lib-zed']).said).toEqual([
      'lib-zed (lib, libs/zed)',
      'depends on',
      'depended on by',
      '  ← app-shop',
      '      value production (5 files): a.ts, b.ts, c.ts, +2 more',
      '      value test (1 file): a.spec.ts',
    ])
  })

  it('prints a project the graph holds no group entry for', () => {
    expect(run(['explain', 'lib-idle']).said).toEqual(['lib-idle (lib, libs/idle)', 'depends on', 'depended on by'])
  })

  it('refuses a name no project has', () => {
    expect(() => run(['explain', 'lib-absent'])).toThrow('no project named lib-absent')
  })

  it('reads a project without building the state', () => {
    run(['explain', 'lib-zed'])
    expect(mockBuild).not.toHaveBeenCalled()
  })
})

describe('runGraph explain of a task', () => {
  it('says whether the task is selected', () => {
    expect(run(['explain', 'app-shop:test']).said).toEqual(['app-shop:test is selected'])
  })

  it('says a task is skipped', () => {
    expect(run(['explain', 'lib-zed:test']).said).toEqual(['lib-zed:test is skipped'])
  })

  it('reports the state build as a note, away from the result', () => {
    expect(run(['explain', 'app-shop:test']).noted).toEqual([
      'graph state incremental (1 changed, 0 deleted): 2 files parsed, wrote graph.json, 42 ms',
    ])
  })

  it('decides against origin/main and the working tree unless told otherwise', () => {
    run(['explain', 'app-shop:test'])
    expect(mockChanges.mock.calls).toEqual([[ROOT, 'origin/main', null]])
  })

  it('decides against the revision the repository resolves the base to', () => {
    mockResolveBase.mockReturnValue('main')
    run(['explain', 'app-shop:test'])
    expect(mockChanges.mock.calls).toEqual([[ROOT, 'main', null]])
  })

  it('refuses a default base the repository cannot resolve, naming both candidates', () => {
    mockResolveBase.mockReturnValue(null)
    expect(() => run(['explain', 'app-shop:test'])).toThrow(
      'neither origin/main nor main in this repository: commit first, or name the base with --base=<ref>'
    )
  })

  it('refuses a named base the repository does not have', () => {
    mockResolveBase.mockReturnValue(null)
    expect(() => run(['explain', 'app-shop:test', '--base', 'v9'])).toThrow(
      'no revision v9 in this repository: commit first, or name the base with --base=<ref>'
    )
  })

  it('decides between the revisions it is given', () => {
    run(['explain', 'app-shop:test', '--base', 'origin/main', '--head', 'HEAD'])
    expect(mockChanges.mock.calls).toEqual([[ROOT, 'origin/main', 'HEAD']])
  })

  it('builds cold under --force', () => {
    run(['explain', 'app-shop:test', '--force'])
    expect(mockBuild.mock.calls).toEqual([[ROOT, { force: true }]])
  })

  it('decides the target after the first colon over the built graph and the previous graph', () => {
    run(['explain', 'app-shop:test'])
    expect(mockSelect.mock.calls).toEqual([
      [{ graph: expect.objectContaining({ root: ROOT }), changes: CHANGES, targets: ['test'], previous: PREVIOUS }],
    ])
  })

  it('reads the graph at the base revision for the change set it found', () => {
    run(['explain', 'app-shop:test'])
    expect(mockPrevious.mock.calls).toEqual([[ROOT, CHANGES]])
  })
})

describe('runGraph build', () => {
  it('reports what the build did as the result', () => {
    expect(run(['build'])).toEqual({
      code: 0,
      said: ['graph state incremental (1 changed, 0 deleted): 2 files parsed, wrote graph.json, 42 ms'],
      noted: [],
    })
  })

  it('names every file it wrote', () => {
    mockBuild.mockReturnValue(built(['files.json', 'meta.json']))
    expect(run(['build']).said).toEqual([expect.stringContaining('wrote files.json, meta.json, 42 ms')])
  })

  it('says when nothing was written', () => {
    mockBuild.mockReturnValue(built([]))
    expect(run(['build']).said).toEqual([expect.stringContaining('2 files parsed, nothing written, 42 ms')])
  })

  it.each([
    [['build'], false],
    [['build', '--force'], true],
  ])('builds %j with force %s', (argv, force) => {
    run(argv)
    expect(mockBuild.mock.calls).toEqual([[ROOT, { force }]])
  })
})

describe('runGraph verify', () => {
  it('exits cleanly when a cold build agrees', () => {
    mockVerify.mockReturnValue({ ok: true, differences: [] })
    expect(run(['verify'])).toEqual({ code: 0, said: ['graph state verified: a cold build agrees byte for byte'], noted: [] })
  })

  it('exits with 1 and names the differences when a cold build disagrees', () => {
    mockVerify.mockReturnValue({ ok: false, differences: ['files.json', 'meta.json'] })
    expect(run(['verify'])).toEqual({
      code: 1,
      said: ['graph state differs from a cold build: files.json, meta.json'],
      noted: [],
    })
  })
})

describe('runGraph status', () => {
  it('prints the status as JSON under --json', () => {
    mockStatus.mockReturnValue(status())
    expect(parse(run(['status', '--json']).said.join('\n'))).toEqual(status())
  })

  it('says there is no state and what the next build would do', () => {
    mockStatus.mockReturnValue(status())
    expect(run(['status']).said).toEqual(['no graph state', 'next build: cold (no state), 12 files to parse'])
  })

  it('prints the persisted state with the digest of every file', () => {
    mockStatus.mockReturnValue(
      status({
        present: true,
        meta: { algorithm: '0123456789abcdef0123', reader: 3 } as unknown as StateStatus['meta'],
        digests: { 'files.json': 'f1', 'meta.json': 'm1' },
      })
    )
    expect(run(['status']).said).toEqual([
      'graph state present (0123456789ab, reader 3)',
      'next build: cold (no state), 12 files to parse',
      '  files.json f1',
      '  meta.json m1',
    ])
  })
})

describe('runGraph affected', () => {
  it('refuses to run without a target', () => {
    expect(() => run(['affected'])).toThrow('affected needs --target <target>')
  })

  it('prints the selected tasks alone by default', () => {
    expect(run(['affected', '--target', 'test']).said).toEqual(['app-shop:test'])
  })

  it('reports the state build as a note', () => {
    expect(run(['affected', '--target', 'test']).noted).toEqual([expect.stringContaining('graph state incremental')])
  })

  it('explains the selection under --explain', () => {
    expect(run(['affected', '--target', 'test', '--explain']).said).toEqual(
      expect.arrayContaining(['skipped 1 tasks', '  app-shop:test', '  lib-zed:test'])
    )
  })

  it('prints the affected set under --json', () => {
    expect(parse(run(['affected', '--target', 'test', '--json']).said.join('\n'))).toEqual(selected())
  })

  it('compares the revisions it is given', () => {
    run(['affected', '--target', 'test', '--base=v1', '--head=v2'])
    expect(mockChanges.mock.calls).toEqual([[ROOT, 'v1', 'v2']])
  })
})

describe('runGraph refusals', () => {
  it.each([
    ['a command it does not know', ['nope'], 'unknown command nope'],
    ['no command', [], 'unknown command '],
    ['explain without a subject', ['explain'], 'unknown command explain'],
  ])('refuses %s', (_, argv, message) => {
    expect(() => run(argv)).toThrow(message)
  })

  it('refuses an option it does not know', () => {
    expect(() => run(['projects', '--nope'])).toThrow("Unknown option '--nope'")
  })
})
