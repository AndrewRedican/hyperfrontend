import { getType } from '@hyperfrontend/data-utils'

export function isValidSequence(sequence: unknown): boolean {
  return !!(sequence && getType(sequence) === 'number' && <number>sequence > 0)
}
