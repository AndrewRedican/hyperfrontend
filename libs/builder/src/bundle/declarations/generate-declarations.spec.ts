jest.mock('@hyperfrontend/logging', () => {
  const actual = jest.requireActual('@hyperfrontend/logging')
  const mockChannel = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), log: jest.fn() }
  return {
    ...actual,
    logger: { channel: jest.fn(() => mockChannel) },
    __mockChannel: mockChannel,
  }
})

jest.mock('@hyperfrontend/immutable-api-utils/built-in-copy/timers', () => ({
  setInterval: jest.fn(() => 'fake-interval-id'),
  clearInterval: jest.fn(),
}))

jest.mock('node:child_process', () => ({ spawn: jest.fn() }))

jest.mock('./flatten-paths', () => ({ flattenDeclarationPaths: jest.fn() }))

import type { BuildContext } from '../../models'
import { spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { clearInterval, setInterval } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { flattenDeclarationPaths } from './flatten-paths'
import { generateDeclarations } from './generate-declarations'

interface FakeChild extends EventEmitter {
  stdout: EventEmitter
  stderr: EventEmitter
  pid?: number
}

const makeFakeChild = (pid = 12345): FakeChild => {
  const child = <FakeChild>new EventEmitter()
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  child.pid = pid
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
  ;(<jest.Mock>setInterval).mockReset().mockReturnValue('fake-interval-id')
  ;(<jest.Mock>clearInterval).mockReset()
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
    expect(mockChannel.error).toHaveBeenCalledWith(expect.stringMatching(/^tsc failed with exit code 2 after \d+ms$/))
  })

  it('resolves with empty stdout and stderr when tsc emits no output', async () => {
    const child = makeFakeChild()
    ;(<jest.Mock>spawn).mockReturnValue(child)
    const promise = generateDeclarations(makeContext())
    await tick()
    child.emit('close', 0)
    expect(await promise).toEqual({ success: true, stdout: '', stderr: '' })
  })

  it('logs a pre-tsc memory snapshot before spawning', async () => {
    const child = makeFakeChild()
    ;(<jest.Mock>spawn).mockReturnValue(child)
    const promise = generateDeclarations(makeContext())
    await tick()
    child.emit('close', 0)
    await promise
    expect(mockChannel.info).toHaveBeenCalledWith(expect.stringMatching(/^pre-tsc memory: parent heap=[\d.]+MB rss=[\d.]+MB$/))
  })

  it('logs the tsc pid at info level after spawning', async () => {
    const child = makeFakeChild(54321)
    ;(<jest.Mock>spawn).mockReturnValue(child)
    const promise = generateDeclarations(makeContext())
    await tick()
    child.emit('close', 0)
    await promise
    expect(mockChannel.info).toHaveBeenCalledWith('tsc spawned: pid=54321')
  })

  it('falls back to "unknown" when the child has no pid', async () => {
    const child = makeFakeChild()
    delete child.pid
    ;(<jest.Mock>spawn).mockReturnValue(child)
    const promise = generateDeclarations(makeContext())
    await tick()
    child.emit('close', 0)
    await promise
    expect(mockChannel.info).toHaveBeenCalledWith('tsc spawned: pid=unknown')
  })

  it('logs the full tsc args at debug level', async () => {
    const child = makeFakeChild()
    ;(<jest.Mock>spawn).mockReturnValue(child)
    const promise = generateDeclarations(makeContext())
    await tick()
    child.emit('close', 0)
    await promise
    expect(mockChannel.debug).toHaveBeenCalledWith(expect.stringMatching(/^tsc args: .*--emitDeclarationOnly/))
  })

  it('starts a heartbeat interval on spawn and clears it on close', async () => {
    const child = makeFakeChild()
    ;(<jest.Mock>spawn).mockReturnValue(child)
    const promise = generateDeclarations(makeContext())
    await tick()
    expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 5000)
    child.emit('close', 0)
    await promise
    expect(clearInterval).toHaveBeenCalledWith('fake-interval-id')
  })

  it('clears the heartbeat interval on tsc spawn error', async () => {
    const child = makeFakeChild()
    ;(<jest.Mock>spawn).mockReturnValue(child)
    const promise = generateDeclarations(makeContext())
    await tick()
    child.emit('error', new Error('boom'))
    await expect(promise).rejects.toThrow('boom')
    expect(clearInterval).toHaveBeenCalledWith('fake-interval-id')
  })

  it('emits a heartbeat info line with parent heap and rss when the interval fires', async () => {
    const child = makeFakeChild()
    ;(<jest.Mock>spawn).mockReturnValue(child)
    const promise = generateDeclarations(makeContext())
    await tick()
    const heartbeatFn = (<jest.Mock>setInterval).mock.calls[0]?.[0] as () => void
    heartbeatFn()
    expect(mockChannel.info).toHaveBeenCalledWith(
      expect.stringMatching(/^tsc still running: elapsed=[\d.]+s parent heap=[\d.]+MB rss=[\d.]+MB$/)
    )
    child.emit('close', 0)
    await promise
  })

  it('logs the tsc duration at info level on success', async () => {
    const child = makeFakeChild()
    ;(<jest.Mock>spawn).mockReturnValue(child)
    const promise = generateDeclarations(makeContext())
    await tick()
    child.emit('close', 0)
    await promise
    expect(mockChannel.info).toHaveBeenCalledWith(expect.stringMatching(/^tsc exited 0 in \d+ms$/))
  })

  it('logs the flatten phase boundaries at info level', async () => {
    const child = makeFakeChild()
    ;(<jest.Mock>spawn).mockReturnValue(child)
    const promise = generateDeclarations(makeContext())
    await tick()
    child.emit('close', 0)
    await promise
    expect(mockChannel.info).toHaveBeenCalledWith('flattening declaration paths')
    expect(mockChannel.info).toHaveBeenCalledWith(expect.stringMatching(/^flatten complete in \d+ms$/))
  })
})
