import type { CapturedOutput, TtyInput } from '@hyperfrontend/testing/process'
import type { Terminal } from './terminal'
import { PassThrough } from 'node:stream'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, flushPromises, it } from '@hyperfrontend/testing'
import { createCapturedOutput, createTtyInput } from '@hyperfrontend/testing/process'
import { Key, Ansi, createTerminal } from './terminal'
import { TokenType } from './token-parser'

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

  it.each([
    [3, '\x1B[3A'],
    [1, '\x1B[1A'],
    [10, '\x1B[10A'],
  ])('generates cursor up sequence for count %d', (count: number, sequence: string) => {
    expect(Ansi.cursorUp(count)).toBe(sequence)
  })

  it.each([
    [3, '\x1B[3B'],
    [1, '\x1B[1B'],
    [5, '\x1B[5B'],
  ])('generates cursor down sequence for count %d', (count: number, sequence: string) => {
    expect(Ansi.cursorDown(count)).toBe(sequence)
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
  let input: TtyInput
  let output: CapturedOutput
  let terminal: Terminal

  beforeEach(() => {
    input = createTtyInput()
    output = createCapturedOutput()
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

      expect(output.text()).toContain('Hello')
    })

    it('writes multiple times', () => {
      terminal.write('First ')
      terminal.write('Second')

      expect(output.text()).toContain('First Second')
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
      const cancelledBefore = terminal.isCancelled()

      const keyPromise = terminal.readKey()
      input.emit('data', Buffer.from(Key.CtrlC))

      await keyPromise

      expect({ cancelledBefore, cancelledAfter: terminal.isCancelled() }).toEqual({ cancelledBefore: false, cancelledAfter: true })
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

      const keysInReadOrder = [await first, await terminal.readKey()]

      expect(keysInReadOrder).toEqual(['a', 'b'])
    })

    it('skips resize tokens', async () => {
      const keyPromise = terminal.readKey()

      output.emit('resize')
      input.emit('data', Buffer.from('k'))

      expect(await keyPromise).toBe('k')
    })

    it('resolves a waiting read with Ctrl+C when the input ends', async () => {
      const keyPromise = terminal.readKey()

      input.end()

      expect(await keyPromise).toBe(Key.CtrlC)
    })

    it('sets cancelled when the input ends', async () => {
      const keyPromise = terminal.readKey()

      input.end()
      await keyPromise

      expect(terminal.isCancelled()).toBe(true)
    })

    it('reads the queued end-of-input cancellation on the next read', async () => {
      const keyPromise = terminal.readKey()
      input.emit('data', Buffer.from('a'))
      await keyPromise
      input.end()

      expect(await terminal.readKey()).toBe(Key.CtrlC)
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

      const tokensInReadOrder = [await first, await terminal.readToken(), await terminal.readToken()]

      // why: the first resize resolves the waiting read; the second and third resize events collapse into the single queued token
      expect(tokensInReadOrder).toEqual([{ type: TokenType.Resize }, { type: TokenType.Resize }, { type: TokenType.Key, value: 'a' }])
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

    it('delivers Ctrl+C inside a bracketed paste as paste data', async () => {
      const tokenPromise = terminal.readToken()

      input.emit('data', Buffer.from('\x1B[200~a\x03b\x1B[201~'))

      expect(await tokenPromise).toEqual({ type: TokenType.Paste, value: 'a\x03b' })
    })

    it('does not cancel on Ctrl+C inside a bracketed paste', async () => {
      const tokenPromise = terminal.readToken()

      input.emit('data', Buffer.from('\x1B[200~a\x03b\x1B[201~'))

      await tokenPromise

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

      expect(output.text()).toContain(Ansi.BracketedPasteOn)
    })

    it('disables bracketed paste on close', async () => {
      const keyPromise = terminal.readKey()
      input.emit('data', Buffer.from('x'))
      await keyPromise

      terminal.close()

      expect(output.text()).toContain(Ansi.BracketedPasteOff)
    })
  })

  describe('readLine', () => {
    it('reads a line of text', async () => {
      const linePromise = terminal.readLine()

      // why: need tick for readline to be set up
      await flushPromises()

      input.write('hello\n')

      const line = await linePromise

      expect(line).toBe('hello')
    })

    it('sets cancelled on close', async () => {
      const cancelledBefore = terminal.isCancelled()

      const linePromise = terminal.readLine()

      // why: need tick for readline to be set up
      await flushPromises()

      input.end()

      await linePromise

      expect({ cancelledBefore, cancelledAfter: terminal.isCancelled() }).toEqual({ cancelledBefore: false, cancelledAfter: true })
    })
  })

  describe('clearLines', () => {
    it('does nothing for count <= 0', () => {
      terminal.clearLines(0)
      terminal.clearLines(-1)

      // why: no clear codes should be written for 0 or negative counts
      expect(output.text()).not.toContain(Ansi.ClearLine)
    })

    it('clears single line', () => {
      terminal.clearLines(1)

      // why: clearing a line returns to its start, then erases it
      expect(output.text()).toContain(Ansi.CursorStart + Ansi.ClearLine)
    })

    it('clears multiple lines', () => {
      terminal.clearLines(3)

      const data = output.text()
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
      output.resize(120, 40)

      expect(terminal.getSize()).toEqual({ columns: 120, rows: 40 })
    })
  })

  describe('close', () => {
    it('shows cursor after close', () => {
      terminal.close()

      expect(output.text()).toContain(Ansi.ShowCursor)
    })

    it('is idempotent when called multiple times', () => {
      terminal.close()
      terminal.close()

      const shows = output.text().split(Ansi.ShowCursor).length - 1

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
      await flushPromises()

      // why: close the terminal which should close the readline interface
      terminal.close()

      // why: the readline close should resolve the pending promise
      input.end()

      await linePromise

      // why: verify cursor was shown
      expect(output.text()).toContain(Ansi.ShowCursor)
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
      const simpleOutput = createCapturedOutput()
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
      const simpleOutput = createCapturedOutput()
      const term = createTerminal({
        input: simpleInput as unknown as NodeJS.ReadStream,
        output: simpleOutput as unknown as NodeJS.WriteStream,
      })

      const keyPromise = term.readKey()
      simpleInput.emit('data', Buffer.from('z'))
      await keyPromise

      term.close()

      expect(simpleOutput.text()).not.toContain('\x1B[?2004')

      simpleInput.destroy()
      simpleOutput.destroy()
    })
  })
})
