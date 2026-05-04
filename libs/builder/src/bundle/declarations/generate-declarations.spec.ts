jest.mock('@hyperfrontend/logging', () => {
  const actual = jest.requireActual('@hyperfrontend/logging')
  const mockChannel = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), log: jest.fn() }
  return {
    ...actual,
    logger: { channel: jest.fn(() => mockChannel) },
    __mockChannel: mockChannel,
  }
})

jest.mock('node:child_process', () => ({ spawn: jest.fn() }))

jest.mock('./flatten-paths', () => ({ flattenDeclarationPaths: jest.fn() }))

import type { BuildContext } from '../../models'
import { spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { flattenDeclarationPaths } from './flatten-paths'
import { generateDeclarations } from './generate-declarations'

interface FakeChild extends EventEmitter {
  stdout: EventEmitter
  stderr: EventEmitter
}

const makeFakeChild = (): FakeChild => {
  const child = <FakeChild>new EventEmitter()
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  return child
}

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
  bundledDeps: [],
  startedAt: 0,
})

const tick = () => new Promise<void>((resolve) => setImmediate(resolve))

const mockChannel = jest.requireMock('@hyperfrontend/logging').__mockChannel as {
  error: jest.Mock
  warn: jest.Mock
  info: jest.Mock
  debug: jest.Mock
  log: jest.Mock
}

beforeEach(() => {
  ;(<jest.Mock>spawn).mockReset()
  ;(<jest.Mock>flattenDeclarationPaths).mockReset()
  mockChannel.error.mockReset()
  mockChannel.warn.mockReset()
  mockChannel.info.mockReset()
  mockChannel.debug.mockReset()
  mockChannel.log.mockReset()
})

describe('generateDeclarations', () => {
  it('spawns the workspace-local tsc binary with the declaration emission flags', async () => {
    const child = makeFakeChild()
    ;(<jest.Mock>spawn).mockReturnValue(child)
    const promise = generateDeclarations(makeContext())
    await tick()
    child.emit('close', 0)
    await promise
    expect(spawn).toHaveBeenCalledWith(
      '/abs/repo/node_modules/.bin/tsc',
      expect.arrayContaining([
        '--project',
        '/abs/libs/foo/tsconfig.lib.json',
        '--emitDeclarationOnly',
        '--declaration',
        '--declarationMap',
      ]),
      expect.objectContaining({ cwd: '/abs/libs/foo', stdio: ['ignore', 'pipe', 'pipe'] })
    )
  })

  it('flattens declaration paths after a successful tsc run', async () => {
    const child = makeFakeChild()
    ;(<jest.Mock>spawn).mockReturnValue(child)
    const ctx = makeContext()
    const promise = generateDeclarations(ctx)
    await tick()
    child.emit('close', 0)
    await promise
    expect(flattenDeclarationPaths).toHaveBeenCalledWith(ctx)
  })

  it('resolves with the streamed stdout and stderr concatenated', async () => {
    const child = makeFakeChild()
    ;(<jest.Mock>spawn).mockReturnValue(child)
    const promise = generateDeclarations(makeContext())
    await tick()
    child.stdout.emit('data', Buffer.from('compiled.\n'))
    child.stderr.emit('data', Buffer.from('warn1\n'))
    child.emit('close', 0)
    const result = await promise
    expect(result).toEqual({ success: true, stdout: 'compiled.\n', stderr: 'warn1\n' })
  })

  it('forwards stdout chunks to log.debug as they stream in', async () => {
    const child = makeFakeChild()
    ;(<jest.Mock>spawn).mockReturnValue(child)
    const promise = generateDeclarations(makeContext())
    await tick()
    child.stdout.emit('data', Buffer.from('chunk-a\n'))
    child.stdout.emit('data', 'chunk-b\n')
    child.emit('close', 0)
    await promise
    expect(mockChannel.debug).toHaveBeenCalledWith('chunk-a')
    expect(mockChannel.debug).toHaveBeenCalledWith('chunk-b')
  })

  it('forwards stderr chunks to log.warn as they stream in', async () => {
    const child = makeFakeChild()
    ;(<jest.Mock>spawn).mockReturnValue(child)
    const promise = generateDeclarations(makeContext())
    await tick()
    child.stderr.emit('data', Buffer.from('boom\n'))
    child.emit('close', 0)
    await promise
    expect(mockChannel.warn).toHaveBeenCalledWith('boom')
  })

  it('rejects with the original error when the child emits an error event', async () => {
    const child = makeFakeChild()
    ;(<jest.Mock>spawn).mockReturnValue(child)
    const promise = generateDeclarations(makeContext())
    await tick()
    const spawnError = new Error('spawn failed')
    child.emit('error', spawnError)
    await expect(promise).rejects.toBe(spawnError)
    expect(mockChannel.error).toHaveBeenCalledWith('tsc spawn error: spawn failed')
    expect(flattenDeclarationPaths).not.toHaveBeenCalled()
  })

  it('rejects with a descriptive error when tsc closes with a non-zero exit code', async () => {
    const child = makeFakeChild()
    ;(<jest.Mock>spawn).mockReturnValue(child)
    const promise = generateDeclarations(makeContext())
    await tick()
    child.emit('close', 2)
    await expect(promise).rejects.toThrow(/tsc failed with exit code 2/)
    expect(flattenDeclarationPaths).not.toHaveBeenCalled()
  })

  it('resolves with empty stdout and stderr when tsc emits no output', async () => {
    const child = makeFakeChild()
    ;(<jest.Mock>spawn).mockReturnValue(child)
    const promise = generateDeclarations(makeContext())
    await tick()
    child.emit('close', 0)
    expect(await promise).toEqual({ success: true, stdout: '', stderr: '' })
  })
})
