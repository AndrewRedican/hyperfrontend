export function utf8StringToUint8Array(text: string): Uint8Array {
  return new Uint8Array(Buffer.from(text, 'utf8'))
}
