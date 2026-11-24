/**
 * `service.manifest.json`: the immutable section a service was built with, beside the digest the
 * build embedded in the main.
 *
 * @module executors/service/manifest
 */

import type { JsonValue } from './config'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'

/** The immutable section of a build, as `service.manifest.json` states it. */
export interface ServiceManifestSection {
  /** The SHA-256 of the section's compact JSON, in 64 lowercase hexadecimal characters. */
  readonly digest: string
  /** The section, in the author's key order. */
  readonly value: Readonly<Record<string, JsonValue>>
}

/** What `service.manifest.json` holds, schema 1. */
export interface ServiceManifest {
  /** The schema of the file. */
  readonly schema: 1
  /** The immutable section of the build. */
  readonly immutable: ServiceManifestSection
}

/**
 * Writes the text of `service.manifest.json`: members in a fixed order, two spaces of indentation
 * and one line feed at the end, so one section and one digest give one file.
 *
 * @param value - The immutable section, as `service.config.ts` states it
 * @param digest - The digest of the section, as the kernel's seal gives it
 * @returns The file's text
 *
 * @example The manifest of a service with one structural setting
 * ```typescript
 * serializeServiceManifest({ greeting: 'Hello' }, '00c815ea6ecfab00c055772c9295e721c391971d760faba8985a391fe695fd33')
 * // {
 * //   "schema": 1,
 * //   "immutable": {
 * //     "digest": "00c815ea6ecfab00c055772c9295e721c391971d760faba8985a391fe695fd33",
 * //     "value": {
 * //       "greeting": "Hello"
 * //     }
 * //   }
 * // }
 * ```
 */
export function serializeServiceManifest(value: Readonly<Record<string, JsonValue>>, digest: string): string {
  return `${stringify({ schema: 1, immutable: { digest, value } } satisfies ServiceManifest, null, 2)}\n`
}
