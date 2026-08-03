/**
 * Width-aware frame renderer for interactive prompts.
 *
 * Logical lines are hard-wrapped at the terminal width so the terminal's
 * own soft-wrap never engages, which keeps the painted row count exact.
 * Erasing assumes a modern reflowing terminal: when the width changes
 * between paints, the previous frame's height is recomputed at the new
 * width before the cursor travels back to the frame start. Cursor columns
 * are display columns (Unicode code points, ANSI excluded); east-asian
 * double-width rendering is out of scope.
 *
 * @internal
 */
import type { Terminal } from './terminal'
import { ceil, floor, max, min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { displayWidth, matchAnsiSequence, Esc } from './ansi-text'
import { Ansi } from './terminal'

/**
 * Cursor position expressed against a frame's logical lines.
 */
export interface ScreenCursor {
  /** Logical line index the cursor sits on */
  readonly line: number
  /** Display column within the logical line (ANSI excluded, code points) */
  readonly col: number
}

/**
 * One paintable frame.
 */
export interface ScreenFrame {
  /** Logical lines to paint; must contain at least one line */
  readonly lines: ReadonlyArray<string>
  /** Where to park the cursor; defaults to the end of the last line */
  readonly cursor?: ScreenCursor
}

/**
 * Frame renderer bound to one terminal. Each `render` erases the previous
 * frame exactly and repaints, so callers only describe the desired state.
 */
export interface Screen {
  /**
   * Erases the previously painted frame and paints the new one.
   *
   * @param frame - Frame to paint
   */
  readonly render: (frame: ScreenFrame) => void
}

/**
 * Hard-wraps one logical line into physical rows no wider than `width`
 * display columns. ANSI escape sequences are zero-width and never split;
 * surrogate pairs travel together.
 *
 * @param line - Logical line, possibly containing ANSI sequences
 * @param width - Maximum display columns per row (at least 1)
 * @returns Physical rows covering the line (always at least one row)
 *
 * @example Wrapping a long line
 * ```typescript
 * wrapLine('abcdefghij', 4)
 * // => ['abcd', 'efgh', 'ij']
 * ```
 */
export function wrapLine(line: string, width: number): ReadonlyArray<string> {
  const rows: string[] = []
  let current = ''
  let col = 0
  let i = 0
  while (i < line.length) {
    if (line.charAt(i) === Esc) {
      const { length } = matchAnsiSequence(line, i)
      current += line.slice(i, i + length)
      i += length
      continue
    }
    if (col === width) {
      rows.push(current)
      current = ''
      col = 0
    }
    const charCode = line.charCodeAt(i)
    // why: keep surrogate pairs on the same row so code points never split
    const charLength = charCode >= 0xd800 && charCode <= 0xdbff ? 2 : 1
    current += line.slice(i, i + charLength)
    col++
    i += charLength
  }
  rows.push(current)
  return freeze(rows)
}

/**
 * Physical cursor target within a painted frame.
 */
interface PhysicalCursor {
  /** Physical row index from the frame top */
  readonly row: number
  /** Column within that row (may equal the width at an exact wrap boundary) */
  readonly col: number
}

/**
 * Creates a frame renderer bound to a terminal.
 *
 * @param terminal - Terminal used for size queries and output
 * @returns Screen renderer
 *
 * @example Repainting a prompt line with a parked cursor
 * ```typescript
 * const screen = createScreen(terminal)
 * screen.render({ lines: ['? Name: Jo'], cursor: { line: 0, col: 10 } })
 * screen.render({ lines: ['? Name: Joe'], cursor: { line: 0, col: 11 } })
 * ```
 */
export function createScreen(terminal: Terminal): Screen {
  let lastRows: ReadonlyArray<string> = freeze([])
  let lastWidth = 0
  let lastCursorRow = 0
  let lastCursorCol = 0

  const reflowedCursorRow = (width: number): number => {
    let row = 0
    for (const paintedRow of lastRows.slice(0, lastCursorRow)) {
      row += max(1, ceil(displayWidth(paintedRow) / width))
    }
    return row + floor(lastCursorCol / width)
  }

  const eraseLastFrame = (width: number, viewportRows: number): void => {
    if (lastRows.length === 0) return
    // why: on a width change the terminal reflowed the old paint, so the cursor's row offset is recomputed against the new width
    const cursorRow = width === lastWidth ? lastCursorRow : reflowedCursorRow(width)
    // why: travel is capped at the viewport height so a reflow estimate can never climb past the frame into content above it
    const travelRows = min(cursorRow, viewportRows - 1)
    let travel = Ansi.CursorStart
    if (travelRows > 0) travel += Ansi.cursorUp(travelRows)
    terminal.write(travel + Ansi.ClearToEnd)
  }

  const resolveCursor = (
    frame: ScreenFrame,
    rowsPerLine: ReadonlyArray<number>,
    lastRowText: string,
    totalRows: number,
    width: number
  ): PhysicalCursor => {
    if (frame.cursor === undefined) {
      return freeze({ row: totalRows - 1, col: displayWidth(lastRowText) })
    }
    let row = 0
    for (const count of rowsPerLine.slice(0, frame.cursor.line)) {
      row += count
    }
    let extraRows = floor(frame.cursor.col / width)
    let col = frame.cursor.col - extraRows * width
    if (col === 0 && frame.cursor.col > 0) {
      // why: a cursor at an exact wrap boundary parks at the end of the previous physical row rather than on an unpainted row
      extraRows -= 1
      col = width
    }
    return freeze({ row: row + extraRows, col })
  }

  const render = (frame: ScreenFrame): void => {
    const size = terminal.getSize()
    const width = max(1, size.columns)
    const viewportRows = max(1, size.rows)
    eraseLastFrame(width, viewportRows)

    const wrappedRows: string[] = []
    const rowsPerLine: number[] = []
    let lastRowText = ''
    for (const line of frame.lines) {
      const wrapped = wrapLine(line, width)
      rowsPerLine.push(wrapped.length)
      for (const row of wrapped) {
        wrappedRows.push(row)
        lastRowText = row
      }
    }

    // why: a frame taller than the viewport would scroll its own top off-screen and desync the erase math, so only the tail that fits is painted
    const dropped = max(0, wrappedRows.length - viewportRows)
    const physicalRows = dropped > 0 ? wrappedRows.slice(dropped) : wrappedRows
    terminal.write(physicalRows.join('\n'))

    const rawCursor = resolveCursor(frame, rowsPerLine, lastRowText, wrappedRows.length, width)
    const cursor = rawCursor.row >= dropped ? freeze({ row: rawCursor.row - dropped, col: rawCursor.col }) : freeze({ row: 0, col: 0 })
    let travel = Ansi.CursorStart
    const rowsUp = physicalRows.length - 1 - cursor.row
    if (rowsUp > 0) travel += Ansi.cursorUp(rowsUp)
    if (cursor.col > 0) travel += Ansi.cursorRight(cursor.col)
    terminal.write(travel)

    lastRows = freeze(physicalRows)
    lastWidth = width
    lastCursorRow = cursor.row
    lastCursorCol = cursor.col
  }

  return freeze({ render })
}
