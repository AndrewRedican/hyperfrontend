import type { Secret } from './readers'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { symbolFor } from '@hyperfrontend/immutable-api-utils/built-in-copy/symbol'

// note: What every printing path shows in place of the text.
const MASK = '[secret]'

// why: Node's inspection looks a custom printer up under this registered symbol, so naming it needs no import of a Node built-in.
const INSPECT = symbolFor('nodejs.util.inspect.custom')

/**
 * Prints the mask, whatever asked for a printable form.
 *
 * @returns The text shown in place of the secret.
 */
function mask(): string {
  return MASK
}

/**
 * Wraps a text so that it cannot be printed by accident: string conversion, a
 * template, JSON and Node's inspection all show `[secret]`, and `reveal()` is
 * the only way back to the text.
 *
 * The text is held in a closure, not in a property, so nothing that walks the
 * object's members finds it, and a structured clone is refused.
 *
 * @param text - The value to protect.
 * @returns A frozen wrapper around the value.
 *
 * @example Printing a wrapped key
 * ```typescript
 * const key = createSecret('correct-horse-battery-staple')
 * String(key) // => '[secret]'
 * JSON.stringify({ key }) // => '{"key":"[secret]"}'
 * key.reveal() // => 'correct-horse-battery-staple'
 * ```
 */
export function createSecret(text: string): Secret {
  return freeze({ reveal: () => text, toString: mask, toJSON: mask, [INSPECT]: mask })
}
