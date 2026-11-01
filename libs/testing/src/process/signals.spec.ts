import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { describe, it } from 'node:test'
import { createFakeChildProcess } from './child-process'
import { cleanSignalExit, sendSignal } from './signals'

const HANDLES_SIGINT = "process.on('SIGINT', () => process.exit(0)); setInterval(() => {}, 1000); process.stdout.write('ready')"

describe('sendSignal', () => {
  it('resolves with the exit a child reports once it ends', async () => {
    const child = createFakeChildProcess()
    assert.deepEqual(await sendSignal(child, 'SIGINT'), { code: null, signal: 'SIGINT' })
  })

  it('resolves with how a child that already ended did so, sending nothing', async () => {
    const child = createFakeChildProcess()
    child.exit(3)
    assert.deepEqual(
      { exit: await sendSignal(child, 'SIGTERM'), sent: child.kill.mock.calls },
      { exit: { code: 3, signal: null }, sent: [] }
    )
  })

  it('ends a real child that handles the signal the way the platform reports it', async () => {
    const child = spawn(process.execPath, ['-e', HANDLES_SIGINT], { stdio: ['ignore', 'pipe', 'ignore'] })
    // why: the signal is sent once the child says it listens, or an early signal ends it with the default handler.
    await once(child.stdout, 'data')
    assert.deepEqual(await sendSignal(child, 'SIGINT'), cleanSignalExit('SIGINT'))
  })
})

describe('cleanSignalExit', () => {
  it('is a zero exit code where signals are delivered', () => {
    assert.deepEqual(cleanSignalExit('SIGINT', 'linux'), { code: 0, signal: null })
  })

  it('is the signal and no exit code on Windows, which ends the child outright', () => {
    assert.deepEqual(cleanSignalExit('SIGTERM', 'win32'), { code: null, signal: 'SIGTERM' })
  })

  it('describes the running platform by default', () => {
    assert.deepEqual(cleanSignalExit('SIGINT'), cleanSignalExit('SIGINT', process.platform))
  })
})
