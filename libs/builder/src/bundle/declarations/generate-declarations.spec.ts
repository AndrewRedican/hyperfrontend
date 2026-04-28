jest.mock('@hyperfrontend/logging', () => {
  const actual = jest.requireActual('@hyperfrontend/logging')
  const mockChannel = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), log: jest.fn() }
  return {
    ...actual,
    logger: { channel: jest.fn(() => mockChannel) },
    __mockChannel: mockChannel,
  }
})

jest.mock('node:child_process', () => ({ spawnSync: jest.fn() }))

jest.mock('./flatten-paths', () => ({ flattenDeclarationPaths: jest.fn() }))

import type { BuildContext } from '../../models'
import { spawnSync } from 'node:child_process'
import { flattenDeclarationPaths } from './flatten-paths'
import { generateDeclarations } from './generate-declarations'

const makeContext = (): BuildContext => ({
  projectRoot: '/abs/libs/foo',
  workspaceRoot: '/abs/repo',
  projectRelativePath: 'libs/foo',
  outputPath: '/abs/dist/libs/foo',
  tsConfigPath: '/abs/libs/foo/tsconfig.lib.json',
  external: [],
  assets: [],
  isWorkspacePackage: () => false,
  entryPointDiscovery: { category: 'root', entryPoints: [], hasRootEntry: false, platformEntries: [], featureEntries: [] },
  startedAt: 0,
})

beforeEach(() => {
  ;(<jest.Mock>spawnSync).mockReset()
  ;(<jest.Mock>flattenDeclarationPaths).mockReset()
})

describe('generateDeclarations', () => {
  it('spawns the workspace-local tsc binary with the declaration emission flags', () => {
    ;(<jest.Mock>spawnSync).mockReturnValue({ status: 0, stdout: '', stderr: '' })
    generateDeclarations(makeContext())
    expect(spawnSync).toHaveBeenCalledWith(
      '/abs/repo/node_modules/.bin/tsc',
      expect.arrayContaining([
        '--project',
        '/abs/libs/foo/tsconfig.lib.json',
        '--emitDeclarationOnly',
        '--declaration',
        '--declarationMap',
      ]),
      expect.objectContaining({ cwd: '/abs/libs/foo', encoding: 'utf-8' })
    )
  })

  it('flattens declaration paths after a successful tsc run', () => {
    ;(<jest.Mock>spawnSync).mockReturnValue({ status: 0, stdout: '', stderr: '' })
    const ctx = makeContext()
    generateDeclarations(ctx)
    expect(flattenDeclarationPaths).toHaveBeenCalledWith(ctx)
  })

  it('returns the captured stdout from tsc', () => {
    ;(<jest.Mock>spawnSync).mockReturnValue({ status: 0, stdout: 'compiled.\n', stderr: '' })
    expect(generateDeclarations(makeContext()).stdout).toBe('compiled.\n')
  })

  it('rethrows the error returned by spawnSync when the binary cannot be invoked', () => {
    ;(<jest.Mock>spawnSync).mockReturnValue({ error: new Error('spawn failed'), status: null, stdout: '', stderr: '' })
    expect(() => generateDeclarations(makeContext())).toThrow('spawn failed')
  })

  it('throws a descriptive error when tsc exits with a non-zero status', () => {
    ;(<jest.Mock>spawnSync).mockReturnValue({ status: 2, stdout: '', stderr: 'failed' })
    expect(() => generateDeclarations(makeContext())).toThrow(/tsc failed with exit code 2/)
  })

  it('returns an empty stdout when tsc emits no output', () => {
    ;(<jest.Mock>spawnSync).mockReturnValue({ status: 0 })
    expect(generateDeclarations(makeContext()).stdout).toBe('')
  })
})
