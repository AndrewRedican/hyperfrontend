export function base64ToUrlSafeBase64(base64: string, { urlSafe, keepPadding }: { urlSafe: boolean; keepPadding: boolean }): string {
  if (urlSafe) {
    base64 = base64.replace(/\+/g, '-').replace(/\//g, '_')
    if (keepPadding === false) {
      base64 = base64.replace(/=+$/, '')
    }
  }
  return base64
}
