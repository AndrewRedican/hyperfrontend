import type { Terminal } from './terminal'
import { PassThrough } from 'node:stream'
import { Key, Ansi, createTerminal } from './terminal'

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
function createMockOutput(): PassThrough & { getWrittenData: () => string } {
  const output = new PassThrough() as PassThrough & { getWrittenData: () => string }
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

    it('sets raw mode during read', async () => {
      const keyPromise = terminal.readKey()

      // why: raw mode is set before the data event
      await new Promise((resolve) => setImmediate(resolve))
      expect(input.isRaw).toBe(true)

      input.emit('data', Buffer.from('x'))
      await keyPromise
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

  describe('close', () => {
    it('shows cursor after close', () => {
      terminal.close()

      expect(output.getWrittenData()).toContain(Ansi.ShowCursor)
    })

    it('can be called multiple times', () => {
      terminal.close()
      terminal.close()

      // why: should not throw
      expect(true).toBe(true)
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
  })
})
