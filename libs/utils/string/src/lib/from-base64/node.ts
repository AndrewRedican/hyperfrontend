import { urlSafeBase64ToBase64 } from '../utils'

export function fromBase64(text: string): string {
  return Buffer.from(urlSafeBase64ToBase64(text), 'base64').toString('utf8')
}
