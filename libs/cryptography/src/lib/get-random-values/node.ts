import { randomBytes } from 'node:crypto'

export function getRandomValues(byteLength: number): Uint8Array {
  if (!byteLength) {
    throw new Error('Cannot generate random values without a byte length.')
  }
  return new Uint8Array(randomBytes(byteLength))
}
