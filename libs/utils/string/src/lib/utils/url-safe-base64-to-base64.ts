export function urlSafeBase64ToBase64(urlSafeBase64: string): string {
  let normalizedBase64 = urlSafeBase64.replace(/-/g, '+').replace(/_/g, '/')
  const pad = normalizedBase64.length % 4
  if (pad) {
    normalizedBase64 = normalizedBase64.padEnd(normalizedBase64.length + (4 - pad), '=')
  }
  return normalizedBase64
}
