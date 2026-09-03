import type { Terminal } from './terminal'
import { PassThrough } from 'node:stream'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { Key, Ansi, createTerminal } from './terminal'
import { TokenType } from './token-parser'

/**
 * Creates a mock input stream for testing.
 *
 * @returns Mock input stream with raw mode support
 */
function createMockInput(): PassThrough & { isRaw: boolean; setRawMode: (mode: boolean) => void } {
  const input = new PassThrough() as PassThrough & { isRaw: boolean; setRawMode: (mode: boolean) => void }
  input.isRaw = false
  input.setRawMode = (mode: boolean): void => {
    input.isRaw = mode
  }
  return input
}

/**
 * Creates a mock output stream for testing.
 *
 * @returns Mock output stream that collects written data
 */
function createMockOutput(): PassThrough & { getWrittenData: () => string; columns?: number; rows?: number } {
  const output = new PassThrough() as PassThrough & { getWrittenData: () => string; columns?: number; rows?: number }
  let writtenData = ''

  const originalWrite = output.write.bind(output)
  output.write = ((chunk: string | Buffer): boolean => {
    writtenData += chunk.toString()
    return originalWrite(chunk)
  }) as typeof output.write

  output.getWrittenData = (): string => writtenData

  return output
}

describe('Key', () => {
  it('contains Up arrow key code', () => {
    expect(Key.Up).toBe('\x1B[A')
  })

  it('contains Down arrow key code', () => {
    expect(Key.Down).toBe('\x1B[B')
  })

  it('contains Left arrow key code', () => {
    expect(Key.Left).toBe('\x1B[D')
  })

  it('contains Right arrow key code', () => {
    expect(Key.Right).toBe('\x1B[C')
  })

  it('contains Enter key code', () => {
    expect(Key.Enter).toBe('\r')
  })

  it('contains Space key code', () => {
    expect(Key.Space).toBe(' ')
  })

  it('contains Tab key code', () => {
    expect(Key.Tab).toBe('\t')
  })

  it('contains Escape key code', () => {
    expect(Key.Escape).toBe('\x1B')
  })

  it('contains Backspace key code', () => {
    expect(Key.Backspace).toBe('\x7F')
  })

  it('contains Delete key code', () => {
    expect(Key.Delete).toBe('\x1B[3~')
  })

  it('contains CtrlC key code', () => {
    expect(Key.CtrlC).toBe('\x03')
  })
})

describe('Ansi', () => {
  it('contains ClearLine escape code', () => {
    expect(Ansi.ClearLine).toBe('\x1B[2K')
  })

  it('contains CursorStart code', () => {
    expect(Ansi.CursorStart).toBe('\r')
  })

  it('generates cursor up sequence', () => {
    expect(Ansi.cursorUp(3)).toBe('\x1B[3A')
    expect(Ansi.cursorUp(1)).toBe('\x1B[1A')
    expect(Ansi.cursorUp(10)).toBe('\x1B[10A')
  })

  it('generates cursor down sequence', () => {
    expect(Ansi.cursorDown(3)).toBe('\x1B[3B')
    expect(Ansi.cursorDown(1)).toBe('\x1B[1B')
    expect(Ansi.cursorDown(5)).toBe('\x1B[5B')
  })

  it('generates cursor left sequence', () => {
    expect(Ansi.cursorLeft(2)).toBe('\x1B[2D')
  })

  it('generates cursor right sequence', () => {
    expect(Ansi.cursorRight(2)).toBe('\x1B[2C')
  })

  it('contains HideCursor escape code', () => {
    expect(Ansi.HideCursor).toBe('\x1B[?25l')
  })

  it('contains ShowCursor escape code', () => {
    expect(Ansi.ShowCursor).toBe('\x1B[?25h')
  })

  it('contains SaveCursor escape code', () => {
    expect(Ansi.SaveCursor).toBe('\x1B7')
  })

  it('contains RestoreCursor escape code', () => {
    expect(Ansi.RestoreCursor).toBe('\x1B8')
  })

  it('contains ClearToEnd escape code', () => {
    expect(Ansi.ClearToEnd).toBe('\x1B[J')
  })

  it('contains BracketedPasteOn escape code', () => {
    expect(Ansi.BracketedPasteOn).toBe('\x1B[?2004h')
  })

  it('contains BracketedPasteOff escape code', () => {
    expect(Ansi.BracketedPasteOff).toBe('\x1B[?2004l')
  })

  it('contains Bold escape code', () => {
    expect(Ansi.Bold).toBe('\x1B[1m')
  })

  it('contains Dim escape code', () => {
    expect(Ansi.Dim).toBe('\x1B[2m')
  })

  it('contains Reset escape code', () => {
    expect(Ansi.Reset).toBe('\x1B[0m')
  })

  it('contains Cyan escape code', () => {
    expect(Ansi.Cyan).toBe('\x1B[36m')
  })

  it('contains Green escape code', () => {
    expect(Ansi.Green).toBe('\x1B[32m')
  })

  it('contains Yellow escape code', () => {
    expect(Ansi.Yellow).toBe('\x1B[33m')
  })

  it('contains Gray escape code', () => {
    expect(Ansi.Gray).toBe('\x1B[90m')
  })
})

describe('createTerminal', () => {
  // why: need to cast streams for terminals
  let input: ReturnType<typeof createMockInput>
  let output: ReturnType<typeof createMockOutput>
  let terminal: Terminal

  beforeEach(() => {
    input = createMockInput()
    output = createMockOutput()
    terminal = createTerminal({
      input: input as unknown as NodeJS.ReadStream,
      output: output as unknown as NodeJS.WriteStream,
    })
  })

  afterEach(() => {
    terminal.close()
    input.destroy()
    output.destroy()
  })

  describe('write', () => {
    it('writes text to output stream', () => {
      terminal.write('Hello')

      expect(output.getWrittenData()).toContain('Hello')
    })

    it('writes multiple times', () => {
      terminal.write('First ')
      terminal.write('Second')

      expect(output.getWrittenData()).toContain('First Second')
    })
  })

  describe('readKey', () => {
    it('reads a single keypress', async () => {
      const keyPromise = terminal.readKey()

      input.emit('data', Buffer.from('a'))

      const key = await keyPromise

      expect(key).toBe('a')
    })

    it('sets raw mode when the read session opens', () => {
      const keyPromise = terminal.readKey()

      expect(input.isRaw).toBe(true)

      input.emit('data', Buffer.from('x'))
      return keyPromise
    })

    it('keeps raw mode enabled between keys', async () => {
      const keyPromise = terminal.readKey()
      input.emit('data', Buffer.from('x'))
      await keyPromise

      // why: raw mode stays on for the whole session instead of per keystroke
      expect(input.isRaw).toBe(true)
    })

    it('sets cancelled on Ctrl+C', async () => {
      expect(terminal.isCancelled()).toBe(false)

      const keyPromise = terminal.readKey()
      input.emit('data', Buffer.from(Key.CtrlC))

      await keyPromise

      expect(terminal.isCancelled()).toBe(true)
    })

    it('reads arrow key sequences', async () => {
      const keyPromise = terminal.readKey()

      input.emit('data', Buffer.from(Key.Up))

      const key = await keyPromise

      expect(key).toBe(Key.Up)
    })

    it('delivers a chunk that arrives between reads', async () => {
      const first = terminal.readKey()
      input.emit('data', Buffer.from('a'))
      input.emit('data', Buffer.from('b'))

      expect(await first).toBe('a')
      expect(await terminal.readKey()).toBe('b')
    })

    it('skips resize tokens', async () => {
      const keyPromise = terminal.readKey()

      output.emit('resize')
      input.emit('data', Buffer.from('k'))

      expect(await keyPromise).toBe('k')
    })
  })

  describe('readToken', () => {
    it('resolves a key token for a single character', async () => {
      const tokenPromise = terminal.readToken()

      input.emit('data', Buffer.from('a'))

      expect(await tokenPromise).toEqual({ type: TokenType.Key, value: 'a' })
    })

    it('resolves a paste token for a multi-character chunk', async () => {
      const tokenPromise = terminal.readToken()

      input.emit('data', Buffer.from('pasted text'))

      expect(await tokenPromise).toEqual({ type: TokenType.Paste, value: 'pasted text' })
    })

    it('accumulates a bracketed paste split across chunks', async () => {
      const tokenPromise = terminal.readToken()

      input.emit('data', Buffer.from('\x1B[200~he'))
      input.emit('data', Buffer.from('llo\x1B[201~'))

      expect(await tokenPromise).toEqual({ type: TokenType.Paste, value: 'hello' })
    })

    it('resolves a resize token when the output resizes', async () => {
      const tokenPromise = terminal.readToken()

      output.emit('resize')

      expect(await tokenPromise).toEqual({ type: TokenType.Resize })
    })

    it('coalesces consecutive queued resize events into one token', async () => {
      const first = terminal.readToken()
      output.emit('resize')
      output.emit('resize')
      output.emit('resize')
      input.emit('data', Buffer.from('a'))

      expect(await first).toEqual({ type: TokenType.Resize })
      // why: the second and third resize events collapse into the single queued token
      expect(await terminal.readToken()).toEqual({ type: TokenType.Resize })
      expect(await terminal.readToken()).toEqual({ type: TokenType.Key, value: 'a' })
    })

    it('keeps a multibyte character split across chunks intact', async () => {
      const tokenPromise = terminal.readToken()
      const encoded = Buffer.from('é')

      input.emit('data', encoded.subarray(0, 1))
      input.emit('data', encoded.subarray(1))

      expect(await tokenPromise).toEqual({ type: TokenType.Key, value: 'é' })
    })

    it('holds a partial escape sequence until it completes', async () => {
      const tokenPromise = terminal.readToken()

      input.emit('data', Buffer.from('\x1B['))
      input.emit('data', Buffer.from('A'))

      expect(await tokenPromise).toEqual({ type: TokenType.Key, value: Key.Up })
    })

    it('does not cancel on Ctrl+C inside a bracketed paste', async () => {
      const tokenPromise = terminal.readToken()

      input.emit('data', Buffer.from('\x1B[200~a\x03b\x1B[201~'))

      expect(await tokenPromise).toEqual({ type: TokenType.Paste, value: 'a\x03b' })
      expect(terminal.isCancelled()).toBe(false)
    })

    it('cancels on Ctrl+C outside a bracketed paste', async () => {
      const tokenPromise = terminal.readToken()

      input.emit('data', Buffer.from('\x03'))

      await tokenPromise

      expect(terminal.isCancelled()).toBe(true)
    })
  })

  describe('bracketed paste mode', () => {
    it('enables bracketed paste when the read session opens', async () => {
      const keyPromise = terminal.readKey()
      input.emit('data', Buffer.from('x'))
      await keyPromise

      expect(output.getWrittenData()).toContain(Ansi.BracketedPasteOn)
    })

    it('disables bracketed paste on close', async () => {
      const keyPromise = terminal.readKey()
      input.emit('data', Buffer.from('x'))
      await keyPromise

      terminal.close()

      expect(output.getWrittenData()).toContain(Ansi.BracketedPasteOff)
    })
  })

  describe('readLine', () => {
    it('reads a line of text', async () => {
      const linePromise = terminal.readLine()

      // why: need tick for readline to be set up
      await new Promise((resolve) => setImmediate(resolve))

      input.write('hello\n')

      const line = await linePromise

      expect(line).toBe('hello')
    })

    it('sets cancelled on close', async () => {
      expect(terminal.isCancelled()).toBe(false)

      const linePromise = terminal.readLine()

      // why: need tick for readline to be set up
      await new Promise((resolve) => setImmediate(resolve))

      input.end()

      await linePromise

      expect(terminal.isCancelled()).toBe(true)
    })
  })

  describe('clearLines', () => {
    it('does nothing for count <= 0', () => {
      terminal.clearLines(0)
      terminal.clearLines(-1)

      // why: no clear codes should be written for 0 or negative counts
      expect(output.getWrittenData()).not.toContain(Ansi.ClearLine)
    })

    it('clears single line', () => {
      terminal.clearLines(1)

      const data = output.getWrittenData()

      expect(data).toContain(Ansi.CursorStart)
      expect(data).toContain(Ansi.ClearLine)
    })

    it('clears multiple lines', () => {
      terminal.clearLines(3)

      const data = output.getWrittenData()
      // why: should clear 3 lines and move cursor up 2 times
      const clearCount = data.split(Ansi.ClearLine).length - 1

      expect(clearCount).toBe(3)
    })
  })

  describe('getSize', () => {
    it('defaults to 80x24 when the output reports no size', () => {
      expect(terminal.getSize()).toEqual({ columns: 80, rows: 24 })
    })

    it('reports the output size when available', () => {
      output.columns = 120
      output.rows = 40

      expect(terminal.getSize()).toEqual({ columns: 120, rows: 40 })
    })
  })

  describe('close', () => {
    it('shows cursor after close', () => {
      terminal.close()

      expect(output.getWrittenData()).toContain(Ansi.ShowCursor)
    })

    it('is idempotent when called multiple times', () => {
      terminal.close()
      terminal.close()

      const shows = output.getWrittenData().split(Ansi.ShowCursor).length - 1

      expect(shows).toBe(1)
    })

    it('restores the original raw mode', async () => {
      const keyPromise = terminal.readKey()
      input.emit('data', Buffer.from('x'))
      await keyPromise

      terminal.close()

      expect(input.isRaw).toBe(false)
    })

    it('closes readline interface when created via readLine', async () => {
      // why: first need to create the rl interface by calling readLine
      const linePromise = terminal.readLine()

      // why: need tick for readline to be set up
      await new Promise((resolve) => setImmediate(resolve))

      // why: close the terminal which should close the readline interface
      terminal.close()

      // why: the readline close should resolve the pending promise
      input.end()

      await linePromise

      // why: verify cursor was shown
      expect(output.getWrittenData()).toContain(Ansi.ShowCursor)
    })
  })

  describe('isCancelled', () => {
    it('returns false initially', () => {
      expect(terminal.isCancelled()).toBe(false)
    })

    it('returns true after cancel is called', () => {
      terminal.cancel()

      expect(terminal.isCancelled()).toBe(true)
    })
  })

  describe('cancel', () => {
    it('sets cancelled state', () => {
      terminal.cancel()

      expect(terminal.isCancelled()).toBe(true)
    })
  })

  describe('with default streams', () => {
    it('uses process.stdin and process.stdout by default', () => {
      // why: we can't easily test this without affecting the actual process streams
      const term = createTerminal()

      expect(typeof term.write).toBe('function')

      // why: close immediately to avoid interfering with process streams
      term.close()
    })
  })

  describe('readKey without raw mode support', () => {
    it('works when setRawMode is not available', async () => {
      const simpleInput = new PassThrough() as PassThrough & { isRaw?: boolean }
      // why: no setRawMode method, simulating non-TTY input
      const simpleOutput = createMockOutput()
      const term = createTerminal({
        input: simpleInput as unknown as NodeJS.ReadStream,
        output: simpleOutput as unknown as NodeJS.WriteStream,
      })

      const keyPromise = term.readKey()

      simpleInput.emit('data', Buffer.from('z'))

      const key = await keyPromise

      expect(key).toBe('z')

      term.close()
      simpleInput.destroy()
      simpleOutput.destroy()
    })

    it('skips bracketed paste sequences for non-TTY input', async () => {
      const simpleInput = new PassThrough()
      const simpleOutput = createMockOutput()
      const term = createTerminal({
        input: simpleInput as unknown as NodeJS.ReadStream,
        output: simpleOutput as unknown as NodeJS.WriteStream,
      })

      const keyPromise = term.readKey()
      simpleInput.emit('data', Buffer.from('z'))
      await keyPromise

      term.close()

      expect(simpleOutput.getWrittenData()).not.toContain('\x1B[?2004')

      simpleInput.destroy()
      simpleOutput.destroy()
    })
  })
})
