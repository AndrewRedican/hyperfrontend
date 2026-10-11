import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { apply, get } from '@hyperfrontend/immutable-api-utils/built-in-copy/reflect'

// compat: node<20 Node 18 only exposes the `crypto` global behind --experimental-global-webcrypto, so the entry reads it on each use instead of capturing it at load; capture it at load again once the floor passes
const resolveSubtle = (): SubtleCrypto => {
  const webCrypto = globalThis.crypto as Crypto | undefined
  if (webCrypto === undefined) {
    throw createError(
      'Web Crypto is unavailable: this runtime has no `crypto` global. On Node.js import @hyperfrontend/cryptography/node instead, or run Node.js 18 with --experimental-global-webcrypto.'
    )
  }
  return webCrypto.subtle
}

/**
 * The Web Crypto `SubtleCrypto` interface, resolved from `globalThis.crypto` on
 * every access, so importing this entry never needs the global to exist and a
 * runtime without it fails at the first primitive call with a descriptive error.
 */
export const subtle: SubtleCrypto = new Proxy({} as SubtleCrypto, {
  get: (_target, property) => {
    const live = resolveSubtle()
    const member = get(live, property) as unknown
    return typeof member === 'function' ? (...args: unknown[]) => apply(member, live, args) : member
  },
})
