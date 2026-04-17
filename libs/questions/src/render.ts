/**
 * Symbols and styling for prompt rendering.
 *
 * @internal
 */
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { Ansi } from './terminal'

/**
 * Unicode symbols for prompt rendering.
 */
export const Symbol = freeze(<const>{
  Pointer: '❯',
  Radio: '◯',
  RadioSelected: '◉',
  Checkbox: '☐',
  CheckboxSelected: '☑',
  Check: '✔',
  Cross: '✖',
  Question: '?',
  Ellipsis: '…',
})

/**
 * Style functions for ANSI text formatting.
 */
export const style = freeze({
  /**
   * Applies bold styling to text.
   *
   * @param text - Text to style
   * @returns Text wrapped in bold ANSI codes
   */
  bold: (text: string): string => `${Ansi.Bold}${text}${Ansi.Reset}`,
  /**
   * Applies dim styling to text.
   *
   * @param text - Text to style
   * @returns Text wrapped in dim ANSI codes
   */
  dim: (text: string): string => `${Ansi.Dim}${text}${Ansi.Reset}`,
  /**
   * Applies cyan color to text.
   *
   * @param text - Text to style
   * @returns Text wrapped in cyan ANSI codes
   */
  cyan: (text: string): string => `${Ansi.Cyan}${text}${Ansi.Reset}`,
  /**
   * Applies green color to text.
   *
   * @param text - Text to style
   * @returns Text wrapped in green ANSI codes
   */
  green: (text: string): string => `${Ansi.Green}${text}${Ansi.Reset}`,
  /**
   * Applies yellow color to text.
   *
   * @param text - Text to style
   * @returns Text wrapped in yellow ANSI codes
   */
  yellow: (text: string): string => `${Ansi.Yellow}${text}${Ansi.Reset}`,
  /**
   * Applies gray color to text.
   *
   * @param text - Text to style
   * @returns Text wrapped in gray ANSI codes
   */
  gray: (text: string): string => `${Ansi.Gray}${text}${Ansi.Reset}`,
})

/**
 * Renders a prompt message with consistent styling.
 *
 * @param message - The prompt message to display
 * @returns Formatted message string with cyan question mark and bold text
 *
 * @example Render a prompt message
 * ```typescript
 * const output = renderMessage('Enter your name')
 * // Returns "? Enter your name " with styling
 * ```
 */
export function renderMessage(message: string): string {
  return `${style.cyan(Symbol.Question)} ${style.bold(message)} `
}

/**
 * Renders a submitted value with visual confirmation styling.
 *
 * @param value - The value that was submitted
 * @returns Value string styled in cyan
 *
 * @example Render submitted input
 * ```typescript
 * const output = renderSubmitted('John Doe')
 * // Returns "John Doe" in cyan
 * ```
 */
export function renderSubmitted(value: string): string {
  return style.cyan(value)
}

/**
 * Renders a cancellation indicator.
 *
 * @returns Dimmed "(cancelled)" string
 *
 * @example Show cancellation
 * ```typescript
 * const output = renderCancelled()
 * // Returns "(cancelled)" in dim style
 * ```
 */
export function renderCancelled(): string {
  return style.dim('(cancelled)')
}

/**
 * Renders hint text in a subdued style.
 *
 * @param hint - The hint text to display
 * @returns Dimmed hint string with leading space
 *
 * @example Render a hint
 * ```typescript
 * const output = renderHint('press enter to confirm')
 * // Returns " press enter to confirm" in dim style
 * ```
 */
export function renderHint(hint: string): string {
  return style.dim(` ${hint}`)
}
