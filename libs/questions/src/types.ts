/**
 * Core types for terminal prompts.
 *
 * @internal
 */
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Result state of a prompt interaction.
 */
export const PromptResult = freeze(<const>{
  /** User submitted a value */
  Submitted: 'submitted',
  /** User cancelled the prompt (Ctrl+C) */
  Cancelled: 'cancelled',
})

/** Result state of a prompt interaction. */
export type PromptResult = (typeof PromptResult)[keyof typeof PromptResult]

/**
 * Base configuration shared by all prompts.
 */
export interface PromptConfig {
  /** The question message to display */
  readonly message: string
  /** Stream to read input from (defaults to stdin) */
  readonly input?: NodeJS.ReadStream
  /** Stream to write output to (defaults to stdout) */
  readonly output?: NodeJS.WriteStream
}

/**
 * Outcome when user submits a value.
 */
export interface PromptSubmittedOutcome<T> {
  /** Submission result indicator */
  readonly result: typeof PromptResult.Submitted
  /** The submitted value */
  readonly value: T
}

/**
 * Outcome when user cancels the prompt.
 */
export interface PromptCancelledOutcome {
  /** Cancellation result indicator */
  readonly result: typeof PromptResult.Cancelled
  /** No value on cancellation */
  readonly value: undefined
}

/**
 * Outcome of a prompt interaction.
 */
export type PromptOutcome<T> = PromptSubmittedOutcome<T> | PromptCancelledOutcome

/**
 * A prompt function that asks a question and returns a value.
 */
export type PromptFunction<TConfig extends PromptConfig, TValue> = (config: TConfig) => Promise<PromptOutcome<TValue>>

/**
 * Choice item for select/multiselect prompts.
 */
export interface Choice<T = string> {
  /** Display label */
  readonly label: string
  /** Value returned when selected */
  readonly value: T
  /** Optional hint text shown after label */
  readonly hint?: string
  /** Whether this choice is disabled */
  readonly disabled?: boolean
}

/**
 * Configuration for text input prompts.
 */
export interface TextConfig extends PromptConfig {
  /** Default value if user submits empty input */
  readonly initial?: string
  /** Validator function - return error message string to reject, undefined to accept */
  readonly validate?: (value: string) => string | undefined
  /** Transform display of input (e.g., for password masking) */
  readonly format?: (value: string) => string
  /** Dynamic message recomputed on every keystroke; overrides `message` when present */
  readonly renderMessage?: (value: string) => string
}

/**
 * Configuration for confirmation prompts.
 */
export interface ConfirmConfig extends PromptConfig {
  /** Default value if user just presses enter */
  readonly initial?: boolean
}

/**
 * Configuration for single-select prompts.
 */
export interface SelectConfig<T = string> extends PromptConfig {
  /** Available choices */
  readonly choices: ReadonlyArray<Choice<T>>
  /** Index of initially selected choice */
  readonly initial?: number
  /** Maximum number of visible choices (enables scrolling) */
  readonly maxVisible?: number
  /** Enable type-to-filter */
  readonly searchable?: boolean
}

/**
 * Configuration for multi-select prompts.
 */
export interface MultiselectConfig<T = string> extends PromptConfig {
  /** Available choices */
  readonly choices: ReadonlyArray<Choice<T>>
  /** Indices of initially selected choices */
  readonly initial?: ReadonlyArray<number>
  /** Maximum number of visible choices (enables scrolling) */
  readonly maxVisible?: number
  /** Minimum required selections */
  readonly min?: number
  /** Maximum allowed selections */
  readonly max?: number
  /** Enable type-to-filter */
  readonly searchable?: boolean
}
