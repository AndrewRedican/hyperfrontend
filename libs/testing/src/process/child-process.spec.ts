import assert from 'node:assert/strict'
import { once } from 'node:events'
import { describe, it } from 'node:test'
import { createFakeChildProcess, spawnSyncResult } from './child-process'
import { readAll } from './terminal'

describe('createFakeChildProcess', () => {
  it('hands each child a different process identifier', () => {
    assert.notEqual(createFakeChildProcess().pid, createFakeChildProcess().pid)
  })

  it('accepts an undefined process identifier, as for a child that never started', () => {
    const child = createFakeChildProcess()
    child.pid = undefined
    assert.equal(child.pid, undefined)
  })

  it('uses the process identifier it was given', () => {
    assert.equal(createFakeChildProcess({ pid: 42 }).pid, 42)
  })

  it('starts running, neither exited nor killed', () => {
    const { exitCode, signalCode, killed } = createFakeChildProcess()
    assert.deepEqual({ exitCode, signalCode, killed }, { exitCode: null, signalCode: null, killed: false })
  })

  it('writes to its stdout', () => {
    const child = createFakeChildProcess()
    child.writeStdout('out')
    assert.equal(readAll(child.stdout), 'out')
  })

  it('writes to its stderr', () => {
    const child = createFakeChildProcess()
    child.writeStderr('err')
    assert.equal(readAll(child.stderr), 'err')
  })

  it('keeps what the parent writes to its stdin', () => {
    const child = createFakeChildProcess()
    child.stdin.write('input')
    assert.equal(child.stdin.text(), 'input')
  })

  it('emits exit with the exit code and records it', () => {
    const child = createFakeChildProcess()
    let seen: unknown
    child.on('exit', (code, signal) => {
      seen = { code, signal }
    })
    child.exit(3)
    assert.deepEqual({ seen, exitCode: child.exitCode }, { seen: { code: 3, signal: null }, exitCode: 3 })
  })

  it('exits with code 0 by default', () => {
    const child = createFakeChildProcess()
    child.exit()
    assert.equal(child.exitCode, 0)
  })

  it('records a signal exit with no exit code', () => {
    const child = createFakeChildProcess()
    child.exit(1, 'SIGKILL')
    assert.deepEqual({ exitCode: child.exitCode, signalCode: child.signalCode }, { exitCode: null, signalCode: 'SIGKILL' })
  })

  it('ends its output streams on exit', () => {
    const child = createFakeChildProcess()
    child.exit()
    assert.deepEqual({ stdout: child.stdout.writableEnded, stderr: child.stderr.writableEnded }, { stdout: true, stderr: true })
  })

  it('emits close after exit, on a later turn', async () => {
    const child = createFakeChildProcess()
    const order: string[] = []
    child.on('exit', () => order.push('exit'))
    child.on('close', () => order.push('close'))
    const closed = once(child, 'close')
    child.exit(0)
    order.push('after exit call')
    await closed
    assert.deepEqual(order, ['exit', 'after exit call', 'close'])
  })

  it('emits error on fail', () => {
    const child = createFakeChildProcess()
    let seen: unknown
    child.on('error', (error) => {
      seen = error
    })
    const error = new Error('spawn ENOENT')
    child.fail(error)
    assert.equal(seen, error)
  })

  it('exits with SIGTERM when killed without a signal', async () => {
    const child = createFakeChildProcess()
    const exited = once(child, 'exit')
    child.kill()
    assert.deepEqual({ args: await exited, killed: child.killed }, { args: [null, 'SIGTERM'], killed: true })
  })

  it('exits with the signal it was killed with', async () => {
    const child = createFakeChildProcess()
    const exited = once(child, 'exit')
    child.kill('SIGINT')
    assert.deepEqual(await exited, [null, 'SIGINT'])
  })

  it('exits with SIGTERM when killed with a signal number', async () => {
    const child = createFakeChildProcess()
    const exited = once(child, 'exit')
    child.kill(9)
    assert.deepEqual(await exited, [null, 'SIGTERM'])
  })

  it('reports false when killed after exiting', () => {
    const child = createFakeChildProcess()
    child.exit(0)
    assert.equal(child.kill(), false)
  })

  it('records kill calls for assertion', () => {
    const child = createFakeChildProcess()
    child.kill('SIGINT')
    assert.deepEqual(child.kill.mock.calls, [['SIGINT']])
  })
})

describe('spawnSyncResult', () => {
  it('describes a clean exit with no output by default', () => {
    assert.deepEqual(spawnSyncResult(), { pid: 1, output: [null, '', ''], stdout: '', stderr: '', status: 0, signal: null })
  })

  it('carries the output and exit code it was given', () => {
    assert.deepEqual(spawnSyncResult({ status: 2, stdout: 'out', stderr: 'err', pid: 7 }), {
      pid: 7,
      output: [null, 'out', 'err'],
      stdout: 'out',
      stderr: 'err',
      status: 2,
      signal: null,
    })
  })

  it('reports no exit code for a process ended by a signal', () => {
    assert.equal(spawnSyncResult({ signal: 'SIGKILL' }).status, null)
  })

  it('carries the error of a process that could not run', () => {
    const error = new Error('spawnSync missing ENOENT')
    assert.equal(spawnSyncResult({ status: null, error }).error, error)
  })
})
