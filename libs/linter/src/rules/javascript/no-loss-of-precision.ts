/**
 * A number literal with more digits than a double holds is stored as a different number than
 * the one written.
 *
 * @module rules/javascript/no-loss-of-precision
 */

import type { Node } from '../../code/model'
import { isFinite, parseInt } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { defineRule } from '../../engine/rule'

/** The radix each literal prefix announces. */
const RADIX: Readonly<Record<string, number>> = { '0b': 2, '0o': 8, '0x': 16 }

/** The most significant digits a number can be printed with. */
const MOST_DIGITS = 100

export default defineRule<undefined, Node>({
  id: 'no-loss-of-precision',
  language: 'code',
  fixable: false,
  create: (context) => ({
    Literal(node) {
      if (typeof node.value !== 'number' || node.value === 0) return
      if (!losesPrecision(node.value, (node.raw as string).replace(/_/g, ''))) return
      context.report({ start: node.start, end: node.end, message: 'This number literal will lose precision at runtime.' })
    },
  }),
})

/**
 * Whether the number stored differs from the one written: a binary, octal or hexadecimal literal
 * is compared digit for digit with the stored value printed in its radix; a decimal literal is
 * compared with the stored value printed to as many significant digits as were written.
 *
 * @param value - The number stored
 * @param text - The literal's text without separators
 * @returns Whether precision is lost
 */
function losesPrecision(value: number, text: string): boolean {
  const radix = RADIX[text.slice(0, 2).toLowerCase()]
  if (radix !== undefined) return withoutLeadingZeros(text.slice(2).toLowerCase()) !== value.toString(radix)
  if (!isFinite(value)) return true
  const written = canonical(text, true)
  const digits = written.slice(0, written.indexOf('e'))
  if (digits.length > MOST_DIGITS) return true
  // why: the stored number is printed with exactly as many significant digits as were written, so every digit it shows counts, zeros included.
  return written !== canonical(value.toPrecision(digits.length), false)
}

/**
 * A decimal number's canonical form: its significant digits, then `e` and the power of ten of
 * the first digit. A number with a decimal point keeps the zeros after it.
 *
 * @param text - A decimal number as written or as printed
 * @param dropTrailingZeros - Whether the trailing zeros of a number without a decimal point are insignificant
 * @returns The canonical form
 */
function canonical(text: string, dropTrailingZeros: boolean): string {
  const [mantissa, power] = text.toLowerCase().split('e') as [string, string | undefined]
  const shift = power === undefined ? 0 : parseInt(power, 10)
  const dot = mantissa.indexOf('.')
  if (dot === -1) {
    const whole = withoutLeadingZeros(mantissa)
    return `${dropTrailingZeros ? whole.replace(/0+$/, '') : whole}e${shift + whole.length - 1}`
  }
  const integer = withoutLeadingZeros(mantissa.slice(0, dot))
  const fraction = mantissa.slice(dot + 1)
  if (integer !== '') return `${integer}${fraction}e${shift + integer.length - 1}`
  const digits = withoutLeadingZeros(fraction)
  return `${digits}e${shift + digits.length - fraction.length - 1}`
}

/**
 * The digits after the leading zeros.
 *
 * @param digits - A run of digits
 * @returns The run without the zeros that open it
 */
function withoutLeadingZeros(digits: string): string {
  return digits.replace(/^0+/, '')
}
