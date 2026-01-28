export function isValidUnserializedData(data: unknown): boolean {
  return !!data && data instanceof Uint8Array
}
