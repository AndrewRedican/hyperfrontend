import { getType } from '@hyperfrontend/data-utils'

export function isSHA256Hash(hash: unknown): boolean {
  return getType(hash) === 'string' ? /^[a-f0-9]{64}$/i.test(<string>hash) : false
}
