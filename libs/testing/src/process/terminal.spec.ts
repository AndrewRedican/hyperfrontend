import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { describe, it } from 'node:test'
import { Keys } from './keys'
import { createCapturedOutput, createTtyInput, readAll } from './terminal'

describe('createTtyInput', () => {
  it('reports itself as a terminal', () => {
    assert.equal(createTtyInput().isTTY, true)
  })

  it('records the raw-mode flag and returns itself', () => {
    const input = createTtyInput()
    assert.deepEqual({ returned: input.setRawMode(true) === input, raw: input.isRaw }, { returned: true, raw: true })
  })

  it('delivers each key as its own chunk, in order', async () => {
    const input = createTtyInput()
    const chunks: string[] = []
    input.on('data', (chunk: Buffer) => chunks.push(chunk.toString()))
    await input.sendKeys('a', Keys.Down, Keys.Enter)
    assert.deepEqual(chunks, ['a', '\x1B[B', '\r'])
  })

  it('buffers keys sent before anything listens', async () => {
    const input = createTtyInput()
    await input.sendKeys('h', 'i')
    assert.equal(readAll(input), 'hi')
  })

  it('queues a second sendKeys behind the first', async () => {
    const input = createTtyInput()
    const chunks: string[] = []
    input.on('data', (chunk: Buffer) => chunks.push(chunk.toString()))
    void input.sendKeys('a', 'b')
    await input.sendKeys('c')
    assert.deepEqual(chunks, ['a', 'b', 'c'])
  })

  it('wraps pasted text in bracketed-paste markers', async () => {
    const input = createTtyInput()
    await input.paste('hello')
    assert.equal(readAll(input), '\x1B[200~hello\x1B[201~')
  })
})

describe('createCapturedOutput', () => {
  it('keeps what was written, strings and bytes alike', () => {
    const output = createCapturedOutput()
    output.write('a')
    output.write(Buffer.from('b'))
    assert.equal(output.text(), 'ab')
  })

  it('forgets what was written on clear', () => {
    const output = createCapturedOutput()
    output.write('a')
    output.clear()
    assert.equal(output.text(), '')
  })

  it('reports no terminal and no size by default', () => {
    const { isTTY, columns, rows } = createCapturedOutput()
    assert.deepEqual({ isTTY, columns, rows }, { isTTY: false, columns: undefined, rows: undefined })
  })

  it('reports a standard terminal size when it is a terminal', () => {
    const { isTTY, columns, rows } = createCapturedOutput({ tty: true })
    assert.deepEqual({ isTTY, columns, rows }, { isTTY: true, columns: 80, rows: 24 })
  })

  it('reports the terminal size it was given', () => {
    const { columns, rows } = createCapturedOutput({ tty: true, columns: 120, rows: 40 })
    assert.deepEqual({ columns, rows }, { columns: 120, rows: 40 })
  })

  it('emits resize with the new size applied', () => {
    const output = createCapturedOutput({ tty: true })
    let seen: unknown
    output.on('resize', () => {
      seen = { columns: output.columns, rows: output.rows }
    })
    output.resize(100, 30)
    assert.deepEqual(seen, { columns: 100, rows: 30 })
  })

  it('keeps the height when resized by width alone', () => {
    const output = createCapturedOutput({ tty: true })
    output.resize(100)
    assert.equal(output.rows, 24)
  })

  it('reports a one-bit colour depth by default, so colour-aware code writes plain text', () => {
    const output = createCapturedOutput({ tty: true })
    assert.deepEqual(
      { depth: output.getColorDepth(), two: output.hasColors(2), sixteen: output.hasColors() },
      { depth: 1, two: true, sixteen: false }
    )
  })

  it('reports the colour depth it was given', () => {
    assert.equal(createCapturedOutput({ tty: true, colorDepth: 8 }).hasColors(256), true)
  })
})

describe('readAll', () => {
  it('reads everything buffered', () => {
    const stream = new PassThrough()
    stream.write('one ')
    stream.write('two')
    assert.equal(readAll(stream), 'one two')
  })

  it('returns an empty string when nothing is buffered', () => {
    assert.equal(readAll(new PassThrough()), '')
  })

  it('decodes a stream that already yields strings', () => {
    const stream = new PassThrough({ encoding: 'utf8' })
    stream.write('text')
    assert.equal(readAll(stream), 'text')
  })
})
