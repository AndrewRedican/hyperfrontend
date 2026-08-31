import { inspect } from 'node:util'

/**
 * Anything that may carry a `name`, such as a constructor.
 */
type NamedValue = {
  /** The declared name, when the value has one. */
  name?: string
}

/**
 * Renders a value for a failure message.
 *
 * Depth is capped so a deeply nested fixture does not bury the difference that matters,
 * and colour is disabled so the output is identical in a terminal and in a CI log.
 *
 * @param value - The value to render.
 * @returns A single-value, human-readable rendering.
 */
export function formatValue(value: unknown): string {
  return inspect(value, { depth: 4, colors: false, breakLength: 120, sorted: true })
}

/**
 * Renders an argument list the way a call site would read.
 *
 * @param args - The arguments to render.
 * @returns The arguments joined as a parenthesised list.
 */
export function formatArguments(args: readonly unknown[]): string {
  return `(${args.map(formatValue).join(', ')})`
}

/**
 * Names a constructor for a failure message, falling back to rendering the value when it
 * is not a constructor at all.
 *
 * @param value - The constructor, or whatever was passed in its place.
 * @returns The constructor's name, or a rendering of the value.
 */
export function describeConstructor(value: unknown): string {
  const named = value as NamedValue | null | undefined
  return named?.name ?? formatValue(value)
}
