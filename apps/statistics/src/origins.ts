import type { Reader } from '@hyperfrontend/server/environment'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { asOrigin } from '@hyperfrontend/server/environment'

/**
 * Reads a comma-separated list of origins, each as a browser sends it in its `Origin` header.
 *
 * Every entry is read by the kernel's own origin reader, so plain `http` is
 * accepted for a loopback host and nowhere else, and one malformed entry
 * refuses the whole list: a deployment with a mistyped origin does not start
 * with the rest.
 *
 * @returns A frozen reader that yields the origins in the order given
 *
 * @example Letting the site and a local copy of it read a service
 * ```typescript
 * asOrigins().read('https://www.example.dev,http://localhost:3000') // => ['https://www.example.dev', 'http://localhost:3000']
 * asOrigins().read('https://www.example.dev,example.dev') // => undefined
 * ```
 */
export function asOrigins(): Reader<readonly string[]> {
  const origin = asOrigin()
  return freeze({
    expected: 'a comma-separated list of origins, such as https://site.example,http://localhost:3000',
    secret: false,
    read: (raw: string): readonly string[] | undefined => {
      const origins: string[] = []
      for (const entry of raw.split(',')) {
        const read = origin.read(entry)
        if (read === undefined) return undefined
        origins.push(read)
      }
      return freeze(origins)
    },
  })
}
