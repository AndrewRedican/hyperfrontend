import type { Terminal, TerminalSize } from './terminal'
import { createScreen, wrapLine } from './screen'

/**
 * Creates a stub terminal capturing writes with a settable size.
 *
 * @param columns - Initial column count
 * @param rows - Initial row count
 * @returns Stub terminal handle for screen tests
 */
function createStubTerminal(
  columns: number,
  rows = 24
): {
  terminal: Terminal
  getWrites: () => string
  clearWrites: () => void
  setColumns: (columns: number) => void
  setSize: (columns: number, rows: number) => void
} {
  let written = ''
  let size: TerminalSize = { columns, rows }
  const stub = {
    write: (text: string): void => {
      written += text
    },
    getSize: (): TerminalSize => size,
  }
  return {
    terminal: stub as unknown as Terminal,
    getWrites: () => written,
    clearWrites: (): void => {
      written = ''
    },
    setColumns: (next: number): void => {
      size = { columns: next, rows: size.rows }
    },
    setSize: (nextColumns: number, nextRows: number): void => {
      size = { columns: nextColumns, rows: nextRows }
    },
  }
}

describe('wrapLine', () => {
  it('keeps a short line on one row', () => {
    expect(wrapLine('abc', 10)).toEqual(['abc'])
  })

  it('keeps a line exactly at the width on one row', () => {
    expect(wrapLine('abcd', 4)).toEqual(['abcd'])
  })

  it('hard-wraps a long line into rows', () => {
    expect(wrapLine('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij'])
  })

  it('treats ANSI escape sequences as zero-width', () => {
    expect(wrapLine('\x1B[36mabcd\x1B[0m', 4)).toEqual(['\x1B[36mabcd\x1B[0m'])
  })

  it('keeps escape sequences attached when wrapping', () => {
    expect(wrapLine('ab\x1B[1mcdef', 4)).toEqual(['ab\x1B[1mcd', 'ef'])
  })

  it('keeps surrogate pairs on the same row', () => {
    expect(wrapLine('\u{1F642}\u{1F642}\u{1F642}', 2)).toEqual(['\u{1F642}\u{1F642}', '\u{1F642}'])
  })

  it('returns a single empty row for an empty line', () => {
    expect(wrapLine('', 4)).toEqual([''])
  })
})

describe('createScreen', () => {
  it('paints logical lines joined by newlines', () => {
    const stub = createStubTerminal(10)
    const screen = createScreen(stub.terminal)

    screen.render({ lines: ['ab', 'cd'] })

    expect(stub.getWrites()).toContain('ab\ncd')
  })

  it('hard-wraps lines wider than the terminal', () => {
    const stub = createStubTerminal(4)
    const screen = createScreen(stub.terminal)

    screen.render({ lines: ['abcdef'] })

    expect(stub.getWrites()).toContain('abcd\nef')
  })

  it('does not erase before the first paint', () => {
    const stub = createStubTerminal(10)
    const screen = createScreen(stub.terminal)

    screen.render({ lines: ['hello'] })

    expect(stub.getWrites()).not.toContain('\x1B[J')
  })

  it('erases a single-row frame from its start before repainting', () => {
    const stub = createStubTerminal(10)
    const screen = createScreen(stub.terminal)
    screen.render({ lines: ['hello'], cursor: { line: 0, col: 5 } })
    stub.clearWrites()

    screen.render({ lines: ['hell'], cursor: { line: 0, col: 4 } })

    expect(stub.getWrites()).toContain('\r\x1B[J')
  })

  it('travels up over wrapped rows when erasing', () => {
    const stub = createStubTerminal(4)
    const screen = createScreen(stub.terminal)
    screen.render({ lines: ['1234567890'], cursor: { line: 0, col: 10 } })
    stub.clearWrites()

    screen.render({ lines: ['x'], cursor: { line: 0, col: 1 } })

    // why: the cursor was parked on physical row 2 of the previous frame
    expect(stub.getWrites()).toContain('\x1B[2A\x1B[J')
  })

  it('parks the cursor on the wrapped row matching its column', () => {
    const stub = createStubTerminal(4)
    const screen = createScreen(stub.terminal)

    screen.render({ lines: ['1234567890'], cursor: { line: 0, col: 5 } })

    // why: three painted rows; the caret belongs on row 1, column 1
    expect(stub.getWrites()).toContain('\r\x1B[1A\x1B[1C')
  })

  it('parks a cursor at an exact wrap boundary at the end of the previous row', () => {
    const stub = createStubTerminal(4)
    const screen = createScreen(stub.terminal)

    screen.render({ lines: ['12345678'], cursor: { line: 0, col: 4 } })

    expect(stub.getWrites()).toContain('\r\x1B[1A\x1B[4C')
  })

  it('maps a cursor on a later logical line past earlier wrapped rows', () => {
    const stub = createStubTerminal(4)
    const screen = createScreen(stub.terminal)
    screen.render({ lines: ['123456', 'ab'], cursor: { line: 1, col: 2 } })
    stub.clearWrites()

    screen.render({ lines: ['x'], cursor: { line: 0, col: 1 } })

    // why: two wrapped rows for line 0 put the parked cursor on physical row 2
    expect(stub.getWrites()).toContain('\x1B[2A\x1B[J')
  })

  it('defaults the cursor to the end of the last painted row', () => {
    const stub = createStubTerminal(10)
    const screen = createScreen(stub.terminal)

    screen.render({ lines: ['ab', 'cdef'] })

    expect(stub.getWrites()).toContain('ab\ncdef\r\x1B[4C')
  })

  it('recomputes the erase height at the new width after a resize', () => {
    const stub = createStubTerminal(10)
    const screen = createScreen(stub.terminal)
    screen.render({ lines: ['abcdefgh'], cursor: { line: 0, col: 8 } })
    stub.clearWrites()
    stub.setColumns(4)

    screen.render({ lines: ['abcdefgh'], cursor: { line: 0, col: 8 } })

    // why: the reflowed previous frame places the parked cursor two rows down
    expect(stub.getWrites()).toContain('\x1B[2A\x1B[J')
  })

  it('counts reflowed rows above the parked cursor after a resize', () => {
    const stub = createStubTerminal(10)
    const screen = createScreen(stub.terminal)
    screen.render({ lines: ['abcdef', 'xy'], cursor: { line: 1, col: 2 } })
    stub.clearWrites()
    stub.setColumns(3)

    screen.render({ lines: ['abcdef', 'xy'], cursor: { line: 1, col: 2 } })

    // why: the six-column first row reflows to two rows at width three
    expect(stub.getWrites()).toContain('\x1B[2A\x1B[J')
  })

  it('counts an empty painted row as one row when reflowing', () => {
    const stub = createStubTerminal(4)
    const screen = createScreen(stub.terminal)
    screen.render({ lines: ['', 'x'], cursor: { line: 1, col: 0 } })
    stub.clearWrites()
    stub.setColumns(3)

    screen.render({ lines: ['', 'x'], cursor: { line: 1, col: 0 } })

    expect(stub.getWrites()).toContain('\x1B[1A\x1B[J')
  })

  it('paints only the tail of a frame taller than the viewport', () => {
    const stub = createStubTerminal(10, 3)
    const screen = createScreen(stub.terminal)

    screen.render({ lines: ['one', 'two', 'three', 'four', 'five'] })

    expect(stub.getWrites()).toContain('three\nfour\nfive')
    expect(stub.getWrites()).not.toContain('one')
  })

  it('parks the cursor at the top-left when its row was clipped by the viewport', () => {
    const stub = createStubTerminal(10, 2)
    const screen = createScreen(stub.terminal)

    screen.render({ lines: ['one', 'two', 'three'], cursor: { line: 0, col: 2 } })

    // why: the clipped frame keeps two rows, so travel goes to their first row with no column offset
    expect(stub.getWrites()).toContain('two\nthree')
    expect(stub.getWrites()).toContain('\r\x1B[1A')
    expect(stub.getWrites()).not.toContain('\x1B[2C')
  })

  it('caps upward erase travel at the viewport height after narrowing', () => {
    const stub = createStubTerminal(12, 4)
    const screen = createScreen(stub.terminal)
    screen.render({ lines: ['abcdefghijkl', 'x', 'y', 'z'], cursor: { line: 3, col: 1 } })
    stub.clearWrites()
    stub.setSize(2, 4)

    screen.render({ lines: ['abcdefghijkl', 'x', 'y', 'z'], cursor: { line: 3, col: 1 } })

    // why: the reflow estimate says eight rows up, but the viewport is only four rows tall
    expect(stub.getWrites()).toContain('\x1B[3A\x1B[J')
    expect(stub.getWrites()).not.toContain('\x1B[8A')
  })
})
