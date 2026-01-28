import { base64ToUrlSafeBase64 } from '../utils'

export function toBase64(text: string, urlSafe = false, keepPadding = false): string {
  return base64ToUrlSafeBase64(Buffer.from(text, 'utf8').toString('base64'), {
    urlSafe,
    keepPadding,
  })
}
