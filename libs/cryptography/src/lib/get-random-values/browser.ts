export function getRandomValues(byteLength: number): Uint8Array {
  if (!byteLength) {
    throw new Error('Cannot generate random values without a byte length.')
  }
  return window.crypto.getRandomValues(new Uint8Array(byteLength))
}
