import assert from 'node:assert/strict'
import { Console } from 'node:console'
import { afterEach, describe, it } from 'node:test'
import { Serializer } from 'node:v8'
import { restoreAllMocks } from '../mock/registry'
import { createSpy } from '../mock/spy'
import { isMockFunction } from '../mock/types'
import { captureStdio } from './stdio'

describe('captureStdio', () => {
  afterEach(() => restoreAllMocks())

  it('records what is written to stdout', () => {
    const stdio = captureStdio()
    process.stdout.write('to stdout')
    stdio.restore()
    assert.equal(stdio.stdout(), 'to stdout')
  })

  it('records what is written to stderr', () => {
    const stdio = captureStdio()
    process.stderr.write('to stderr')
    stdio.restore()
    assert.equal(stdio.stderr(), 'to stderr')
  })

  it('records console output, which writes through the streams', () => {
    const stdio = captureStdio()
    new Console(process.stdout, process.stderr).log('logged')
    stdio.restore()
    assert.equal(stdio.stdout(), 'logged\n')
  })

  it('decodes bytes written to a stream', () => {
    const stdio = captureStdio()
    process.stdout.write(Buffer.from('bytes'))
    stdio.restore()
    assert.equal(stdio.stdout(), 'bytes')
  })

  it('leaves a stream alone when told not to capture it', () => {
    const stdio = captureStdio({ stdout: false })
    const stdoutMocked = isMockFunction(process.stdout.write)
    stdio.restore()
    assert.equal(stdoutMocked, false)
  })

  it('leaves stderr alone when told not to capture it', () => {
    const stdio = captureStdio({ stderr: false })
    const stderrMocked = isMockFunction(process.stderr.write)
    stdio.restore()
    assert.equal(stderrMocked, false)
  })

  it('forgets what was recorded on clear', () => {
    const stdio = captureStdio()
    process.stdout.write('dropped')
    stdio.clear()
    stdio.restore()
    assert.equal(stdio.stdout(), '')
  })

  it('still writes to the real stream when passing through', () => {
    const real = createSpy(process.stdout, 'write').mockImplementation(() => true)
    const stdio = captureStdio({ stderr: false, passThrough: true })
    process.stdout.write('both')
    stdio.restore()
    assert.deepEqual({ recorded: stdio.stdout(), real: real.mock.calls }, { recorded: 'both', real: [['both', undefined, undefined]] })
  })

  it("passes the test runner's own result messages through to the real stream without recording them", () => {
    const serializer = new Serializer()
    serializer.writeHeader()
    serializer.writeValue({ type: 'test:pass' })
    const frame = serializer.releaseBuffer()
    const real = createSpy(process.stdout, 'write').mockImplementation(() => true)
    const stdio = captureStdio({ stderr: false })
    process.stdout.write(frame)
    stdio.restore()
    assert.deepEqual({ recorded: stdio.stdout(), real: real.mock.calls.length }, { recorded: '', real: 1 })
  })

  it('records bytes too short to be a result message', () => {
    const stdio = captureStdio()
    process.stdout.write(new Uint8Array([0xff]))
    stdio.restore()
    assert.equal(stdio.stdout().length, 1)
  })

  it('calls a write callback after the write returns', async () => {
    const stdio = captureStdio()
    const order: string[] = []
    await new Promise<void>((resolve) => {
      process.stdout.write('x', () => {
        order.push('callback')
        resolve()
      })
      order.push('returned')
    })
    stdio.restore()
    assert.deepEqual(order, ['returned', 'callback'])
  })

  it('calls a write callback passed after an encoding', async () => {
    const stdio = captureStdio()
    await new Promise<void>((resolve) => process.stdout.write('x', 'utf8', () => resolve()))
    stdio.restore()
    assert.equal(stdio.stdout(), 'x')
  })

  it('ends when restoreAllMocks runs', () => {
    captureStdio()
    restoreAllMocks()
    assert.equal(isMockFunction(process.stdout.write), false)
  })
})
