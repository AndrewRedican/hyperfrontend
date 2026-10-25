'use strict'

const { join } = require('node:path')
const { before: beforeAll, after: afterAll } = require('node:test')
const { describe, it, expect } = require('@hyperfrontend/testing')
const { createNativeConsumer, tarballFor } = require('../../shared/native-consumer')

const PACKAGE = '@hyperfrontend/project-scope'
const E2E_DIR = join(__dirname, '..')
// why: the setup installs the tarball from the npm cache, which takes a few seconds on a cold disk.
const SETUP_TIMEOUT = 120_000
const RUNNER = [
  "'use strict'",
  "const { analyzeProject, createMemoryTree, isNxWorkspace } = require('@hyperfrontend/project-scope')",
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
  'main().then((out) => process.stdout.write(JSON.stringify(out)))',
  '',
].join('\n')

describe('@hyperfrontend/project-scope CJS', () => {
  it('is importable via require', () => {
    const projectScope = require('@hyperfrontend/project-scope')
    expect(projectScope).toBeDefined()
  })

  it('exports createTree function', () => {
    const { createTree } = require('@hyperfrontend/project-scope')
    expect(typeof createTree).toBe('function')
  })

  it('exports createTreeFromDisk function', () => {
    const { createTreeFromDisk } = require('@hyperfrontend/project-scope')
    expect(typeof createTreeFromDisk).toBe('function')
  })

  it('exports analyzeProject function', () => {
    const { analyzeProject } = require('@hyperfrontend/project-scope')
    expect(typeof analyzeProject).toBe('function')
  })

  it('reads a file held in a memory tree', () => {
    const { createMemoryTree } = require('@hyperfrontend/project-scope')
    expect(createMemoryTree({ 'a.txt': 'a' }).read('a.txt', 'utf-8')).toBe('a')
  })
})

describe('NX heuristics (CJS)', () => {
  it('exports isNxWorkspace function', () => {
    const { isNxWorkspace } = require('@hyperfrontend/project-scope')
    expect(typeof isNxWorkspace).toBe('function')
  })

  it('exports findNxWorkspaceRoot function', () => {
    const { findNxWorkspaceRoot } = require('@hyperfrontend/project-scope')
    expect(typeof findNxWorkspaceRoot).toBe('function')
  })

  it('exports isNxProject function', () => {
    const { isNxProject } = require('@hyperfrontend/project-scope')
    expect(typeof isNxProject).toBe('function')
  })

  it('exports getNxWorkspaceInfo function', () => {
    const { getNxWorkspaceInfo } = require('@hyperfrontend/project-scope')
    expect(typeof getNxWorkspaceInfo).toBe('function')
  })

  it('exports discoverNxProjects function', () => {
    const { discoverNxProjects } = require('@hyperfrontend/project-scope')
    expect(typeof discoverNxProjects).toBe('function')
  })

  it('exports buildSimpleProjectGraph function', () => {
    const { buildSimpleProjectGraph } = require('@hyperfrontend/project-scope')
    expect(typeof buildSimpleProjectGraph).toBe('function')
  })

  it('exports nxDetector function', () => {
    const { nxDetector } = require('@hyperfrontend/project-scope')
    expect(typeof nxDetector).toBe('function')
  })
})

describe('@hyperfrontend/project-scope CJS under plain Node in an isolated consumer', () => {
  let consumer

  beforeAll(
    () => {
      consumer = createNativeConsumer({ tarball: tarballFor(E2E_DIR, PACKAGE), packageName: PACKAGE })
      consumer.write('run.cjs', RUNNER)
    },
    { timeout: SETUP_TIMEOUT }
  )

  afterAll(() => {
    consumer.remove()
  })

  it('requires every export entry natively', () => {
    const loads = consumer.loadEntries('require')
    expect({ probed: loads.length > 0, failures: loads.filter((load) => !load.ok) }).toEqual({ probed: true, failures: [] })
  })

  it('buffers writes in a memory tree and analyses the consumer directory', () => {
    const run = consumer.node([join(consumer.path, 'run.cjs')])
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
