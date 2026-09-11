/**
 * How a line of terminal output is coloured.
 *
 * Tones are named for what the line means rather than for a colour, so a script
 * says the same thing in every theme and a theme is free to disagree about how
 * to say it.
 */
export type TerminalTone = 'plain' | 'muted' | 'accent' | 'success' | 'warning' | 'danger'

/** One line of output, with the tone it is printed in. */
export interface TerminalLine {
  /** The text of the line. */
  text: string
  /** How it is coloured, defaulting to `plain`. */
  tone?: TerminalTone
}

/** A line of output, either written out or given as plain text. */
export type TerminalSpan = string | TerminalLine

/** Text appearing at the prompt a character at a time, as though typed. */
export interface TerminalTypeStep {
  /** Discriminant. */
  step: 'type'
  /** What is typed. */
  text: string
  /** Characters per second, overriding the terminal's own rate. */
  cps?: number
}

/** The typed line being submitted, which moves it into the scrollback. */
export interface TerminalRunStep {
  /** Discriminant. */
  step: 'run'
  /** How long the command appears to work before it prints anything. */
  thinkMs?: number
}

/** Output printed by whatever was last run. */
export interface TerminalOutputStep {
  /** Discriminant. */
  step: 'output'
  /** The lines, printed in order. */
  lines: readonly TerminalSpan[]
  /** How long each line waits before the next appears. */
  lineMs?: number
}

/** A beat where nothing changes. */
export interface TerminalPauseStep {
  /** Discriminant. */
  step: 'pause'
  /** How long the terminal sits still. */
  ms: number
}

/** The scrollback being emptied, as `clear` would. */
export interface TerminalClearStep {
  /** Discriminant. */
  step: 'clear'
}

/** The prompt changing, as it would after moving between directories. */
export interface TerminalPromptStep {
  /** Discriminant. */
  step: 'prompt'
  /** The new prompt. */
  text: string
}

/** One instruction in a terminal script. */
export type TerminalStep =
  | TerminalClearStep
  | TerminalOutputStep
  | TerminalPauseStep
  | TerminalPromptStep
  | TerminalRunStep
  | TerminalTypeStep

/**
 * A terminal's look, as a set of colours the renderer resolves tones against.
 *
 * Every value is a CSS colour. Keeping the look entirely in data is what lets
 * one terminal implementation carry several visual treatments without any of
 * them being a second implementation.
 */
export interface TerminalTheme {
  /** Name a scene selects this theme by. */
  id: string
  /** The surface the window sits on. */
  backdrop: string
  /** The window's own surface. */
  surface: string
  /** The title bar's surface. */
  chrome: string
  /** The window's outline. */
  border: string
  /** The shadow cast onto the backdrop, as a full `box-shadow` value. */
  shadow: string
  /** Colour of the three window buttons, left to right. */
  buttons: readonly [string, string, string]
  /** Colour of the title bar's text. */
  titleText: string
  /** Colour of the prompt. */
  prompt: string
  /** Colour of the cursor block. */
  cursor: string
  /** Colour each tone is printed in. */
  tones: Readonly<Record<TerminalTone, string>>
}

/** A theme as a scene states it: a built-in name, or one written out in full. */
export type TerminalThemeRef = string | TerminalTheme

/** Everything a scene tells the terminal stage. */
export interface TerminalConfig {
  /** The visual treatment, defaulting to the first built-in theme. */
  theme?: TerminalThemeRef
  /** Text in the title bar, or an empty string for a window with no title bar. */
  title?: string
  /** The prompt the script starts with. */
  prompt?: string
  /** Typing rate in characters per second, for steps that name none. */
  cps?: number
  /** What happens, in order. */
  script: readonly TerminalStep[]
}
