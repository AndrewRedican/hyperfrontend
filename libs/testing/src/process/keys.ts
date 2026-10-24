/**
 * The byte sequences a terminal sends for the keys an interactive prompt reacts to, as a
 * raw-mode stdin receives them.
 */
export const Keys = Object.freeze({
  /** Carriage return, which submits a prompt. */
  Enter: '\r',
  /** A lone ESC byte, which prompts commonly read as dismissal. */
  Escape: '\x1B',
  /** Horizontal tab, which prompts use for completion or to move focus forward. */
  Tab: '\t',
  /** Back-tab, which moves focus backward. */
  ShiftTab: '\x1B[Z',
  /** DEL, which a raw-mode terminal sends for the key that erases before the cursor. */
  Backspace: '\x7F',
  /** Erases the character under the cursor. */
  Delete: '\x1B[3~',
  /** A single space, which toggles the highlighted choice in a multi-select. */
  Space: ' ',
  /** Moves the highlight or cursor one line up. */
  Up: '\x1B[A',
  /** Moves the highlight or cursor one line down. */
  Down: '\x1B[B',
  /** Moves the cursor one character right. */
  Right: '\x1B[C',
  /** Moves the cursor one character left. */
  Left: '\x1B[D',
  /** Moves the cursor to the start of the line. */
  Home: '\x1B[H',
  /** Moves the cursor to the end of the line. */
  End: '\x1B[F',
  /** Scrolls a long list up by a screen. */
  PageUp: '\x1B[5~',
  /** Scrolls a long list down by a screen. */
  PageDown: '\x1B[6~',
  /** ETX, which a raw-mode prompt reads as cancellation since the terminal no longer turns it into SIGINT. */
  CtrlC: '\x03',
  /** EOT, which signals end of input. */
  CtrlD: '\x04',
} as const)

/**
 * One of the key sequences in `Keys`.
 */
export type Key = (typeof Keys)[keyof typeof Keys]

/**
 * The markers a terminal in bracketed-paste mode wraps pasted text in.
 */
export const PASTE = Object.freeze({ start: '\x1B[200~', end: '\x1B[201~' } as const)
