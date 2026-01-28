export function utf8StringToUint8Array(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}
