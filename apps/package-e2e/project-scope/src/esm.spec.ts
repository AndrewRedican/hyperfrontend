import type { NativeConsumer } from '../../shared/native-consumer'
import { join } from 'node:path'
import { before as beforeAll, after as afterAll } from 'node:test'
import { describe, it, expect } from '@hyperfrontend/testing'

import {
  analyzeProject,
  buildSimpleProjectGraph,
  createMemoryTree,
  createTree,
  createTreeFromDisk,
  discoverNxProjects,
  findNxWorkspaceRoot,
  getNxWorkspaceInfo,
  isNxProject,
  isNxWorkspace,
  nxDetector,
} from '@hyperfrontend/project-scope'
import { createNativeConsumer, tarballFor } from '../../shared/native-consumer'

const PACKAGE = '@hyperfrontend/project-scope'
const E2E_DIR = join(import.meta.dirname, '..')
// why: the setup installs the tarball from the npm cache, which takes a few seconds on a cold disk.
const SETUP_TIMEOUT = 120_000
const RUNNER = [
  "import { analyzeProject, createMemoryTree, isNxWorkspace } from '@hyperfrontend/project-scope'",
  'async function main() {',
  "  const tree = createMemoryTree({ 'package.json': '{}' })",
  '  tree.write(\'package.json\', \'{"name":"app"}\')',
  "  tree.write('src/index.ts', 'export const x = 1\\n')",
  '  const analysis = analyzeProject(process.cwd())',
  '  return {',
  "    read: tree.read('package.json', 'utf-8'),",
  "    exists: [tree.exists('src/index.ts'), tree.exists('missing.ts')],",
  '    changes: tree.listChanges().map(({ path, type }) => ({ path, type })),',
  '    analysedName: analysis.name,',
  '    nx: isNxWorkspace(process.cwd()),',
  '  }',
  '}',
  'process.stdout.write(JSON.stringify(await main()))',
  '',
].join('\n')

describe('@hyperfrontend/project-scope ESM', () => {
  it('exports createTree function', () => {
    expect(typeof createTree).toBe('function')
  })

  it('exports createTreeFromDisk function', () => {
    expect(typeof createTreeFromDisk).toBe('function')
  })

  it('exports analyzeProject function', () => {
    expect(typeof analyzeProject).toBe('function')
  })

  it('buffers a write over a file held in a memory tree', () => {
    const tree = createMemoryTree({ 'package.json': '{}' })
    tree.write('package.json', '{"name":"app"}')
    expect(tree.listChanges().map(({ path, type }) => ({ path, type }))).toEqual([{ path: 'package.json', type: 'UPDATE' }])
  })
})

describe('NX heuristics (ESM)', () => {
  it('exports isNxWorkspace function', () => {
    expect(typeof isNxWorkspace).toBe('function')
  })

  it('exports findNxWorkspaceRoot function', () => {
    expect(typeof findNxWorkspaceRoot).toBe('function')
  })

  it('exports isNxProject function', () => {
    expect(typeof isNxProject).toBe('function')
  })

  it('exports getNxWorkspaceInfo function', () => {
    expect(typeof getNxWorkspaceInfo).toBe('function')
  })

  it('exports discoverNxProjects function', () => {
    expect(typeof discoverNxProjects).toBe('function')
  })

  it('exports buildSimpleProjectGraph function', () => {
    expect(typeof buildSimpleProjectGraph).toBe('function')
  })

  it('exports nxDetector function', () => {
    expect(typeof nxDetector).toBe('function')
  })
})

describe('@hyperfrontend/project-scope ESM under plain Node in an isolated consumer', () => {
  let consumer: NativeConsumer

  beforeAll(
    () => {
      consumer = createNativeConsumer({ tarball: tarballFor(E2E_DIR, PACKAGE), packageName: PACKAGE })
      consumer.write('run.mjs', RUNNER)
    },
    { timeout: SETUP_TIMEOUT }
  )

  afterAll(() => {
    consumer.remove()
  })

  it('imports every export entry natively', () => {
    const loads = consumer.loadEntries('import')
    expect({ probed: loads.length > 0, failures: loads.filter((load) => !load.ok) }).toEqual({ probed: true, failures: [] })
  })

  it('buffers writes in a memory tree and analyses the consumer directory', () => {
    const run = consumer.node([join(consumer.path, 'run.mjs')])
    expect(run.status === 0 ? JSON.parse(run.stdout) : run.stderr).toEqual({
      read: '{"name":"app"}',
      exists: [true, false],
      changes: [
        {
          path: 'package.json',
          type: 'UPDATE',
        },
        {
          path: 'src/index.ts',
          type: 'CREATE',
        },
      ],
      analysedName: 'native-consumer',
      nx: false,
    })
  })
})
