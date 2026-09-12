import type { Mark } from './banner'

/**
 * How a value is coloured.
 *
 * `plain` is the theme's strong text; the rest name the theme tone of the
 * same name, so a scene says what a value means and never what colour it is.
 */
export type CascadeTone = 'plain' | 'accent' | 'warning' | 'success'

/** One span of the header line, the unit a copy is taken of. */
export interface HeaderPart {
  /** The characters of the span, spaces included. */
  text: string
  /** How the span is coloured once it is typed. */
  tone?: CascadeTone
}

/** One field the header parses to. */
export interface CascadeField {
  /** The field's name, set faintly above its value. */
  label: string
  /** The value that lands in the field. */
  value: string
  /** Index of the header part a copy of which falls into the field. */
  from: number
  /** How the value is coloured. */
  tone?: CascadeTone
}

/** One derivation: the package export that performs it, and when it starts. */
export interface CascadeStep {
  /** The export, as a reader would import it, drawn as a chip beside the row it produces. */
  api: string
  /** When the step starts. */
  atMs: number
}

/** The step that parses the header into fields. */
export interface ParseStep extends CascadeStep {
  /** The fields, left to right. */
  fields: readonly CascadeField[]
}

/** The step that reads the fields and decides the bump. */
export interface BumpStep extends CascadeStep {
  /** The field's name, set faintly above its value. */
  label: string
  /** The bump the copies merge into. */
  value: string
  /** Indices of the fields whose values converge on it. */
  from: readonly number[]
}

/** The step that applies the bump to the version on disk. */
export interface IncrementStep extends CascadeStep {
  /** The version on disk. */
  from: string
  /** The version after the bump; every character that differs from `from` rolls. */
  to: string
}

/** One token of the changelog line. */
export interface ChangelogToken {
  /** The token's text. */
  text: string
  /** Characters drawn faintly either side of the text, such as markdown emphasis. */
  wrap?: string
  /** Index of the field a copy of whose value becomes this token, or undefined for a token that appears in place. */
  from?: number
  /** How the token is coloured. */
  tone?: CascadeTone
}

/** The step that writes the changelog line. */
export interface ChangelogStep extends CascadeStep {
  /** The tokens, left to right, joined by single spaces. */
  tokens: readonly ChangelogToken[]
  /** The file the line is written to, set faintly after the line. */
  file: string
}

/** Everything a scene tells the cascade stage. */
export interface CascadeConfig {
  /** The package's mark, drawn on every chip. */
  mark: Mark
  /** The header line, in the spans that are copied out of it. */
  header: readonly HeaderPart[]
  /** When the header starts typing. */
  typeAtMs: number
  /** How fast it types, in characters per second. */
  typeCps: number
  /** The parse. */
  parse: ParseStep
  /** The bump. */
  bump: BumpStep
  /** The increment. */
  increment: IncrementStep
  /** The changelog line. */
  changelog: ChangelogStep
  /** How long the frame holds after the last thing lands. */
  restMs?: number
}
