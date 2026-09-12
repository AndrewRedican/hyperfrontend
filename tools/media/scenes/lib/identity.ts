import type { Mark } from '../../src/models/banner'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { SCOPE, WORKSPACE_ROOT } from './libraries'

/** One package's entry in the identity file. */
export interface IdentityEntry {
  /** The hue the package's pages and media are tinted with, in degrees. */
  hue: number
  /** The package's mark. */
  mark: Mark
}

/** The identity file's shape, as far as the scenes read it. */
interface Identity {
  /** Hue and mark by package name. */
  packages: Record<string, IdentityEntry>
  /** The mark for a package with none of its own. */
  fallbackMark: Mark
  /** The hue for a package with none of its own. */
  fallbackHue: number
}

const identity = parse(readFileSync(join(WORKSPACE_ROOT, 'assets/brand/package-identity.json'), 'utf8')) as Identity

/**
 * The hue and mark a package is drawn with.
 *
 * Read from the same file the documentation site reads, so a showcase and the
 * page it is embedded in agree about what colour and what shape belong to the
 * package. A package the file does not name gets the workspace's fallback.
 *
 * @param name - The package's registry name, with or without its scope.
 * @returns The package's hue and mark.
 * @example The mark and hue of the cryptography package
 * ```ts
 * const { hue, mark } = packageIdentity('cryptography')
 * ```
 */
export function packageIdentity(name: string): IdentityEntry {
  const full = name.startsWith(SCOPE) ? name : `${SCOPE}${name}`
  return identity.packages[full] ?? { hue: identity.fallbackHue, mark: identity.fallbackMark }
}
