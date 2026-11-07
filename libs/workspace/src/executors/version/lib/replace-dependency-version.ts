import { readFileSync, writeFileSync } from 'node:fs'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'

/**
 * Dependency sections in package.json that can contain version references.
 */
const DEPENDENCY_SECTIONS: readonly string[] = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']

/** An exact version, as a pin is written: `1.2.3` or `1.2.3-rc.1`. */
const EXACT_VERSION = /^\d+\.\d+\.\d+[^\s|]*$/

/**
 * Whether a version bump leaves an entry as it is, because the entry says what it accepts rather than what it pins.
 *
 * @param section - The manifest section holding the entry
 * @param declared - The entry's version string
 * @returns true for a range under `peerDependencies`
 */
function isPeerRange(section: string, declared: string): boolean {
  return section === 'peerDependencies' && !EXACT_VERSION.test(declared)
}

/**
 * Replaces a dependency version in a package.json file using JSON parsing.
 * This preserves the original key ordering by using JSON.parse/stringify.
 * A peer declared as a range stays a range: pinning it to a version not yet published makes npm drop the consumer's own install of that peer.
 *
 * @param filePath - Path to the package.json file
 * @param packageName - The npm package name to update
 * @param newVersion - The new version string to set
 * @returns true if a replacement was made, false otherwise
 *
 * @example Every section that pins the package follows
 * ```typescript
 * replaceDependencyVersion('/repo/libs/consumer/package.json', '@acme/core', '2.0.0')
 * // => true; the dependencies, devDependencies and exact peerDependencies entries for @acme/core now read 2.0.0, key order kept
 * replaceDependencyVersion('/repo/libs/consumer/package.json', '@acme/core', '2.0.0')
 * // => false the second time: nothing left to change, the file is not rewritten
 * ```
 */
export function replaceDependencyVersion(filePath: string, packageName: string, newVersion: string): boolean {
  const content = readFileSync(filePath, 'utf-8')
  const pkg = parse(content) as Record<string, unknown>

  let changed = false

  for (const section of DEPENDENCY_SECTIONS) {
    const deps = pkg[section] as Record<string, string> | undefined
    if (deps && packageName in deps && deps[packageName] !== newVersion && !isPeerRange(section, deps[packageName])) {
      deps[packageName] = newVersion
      changed = true
    }
  }

  if (!changed) {
    return false
  }

  const newContent = stringify(pkg, null, 2) + '\n'
  writeFileSync(filePath, newContent, 'utf-8')
  return true
}

/**
 * Checks if a version string is a file: reference to a tgz with the given prefix.
 *
 * @param value - The dependency version string to check
 * @param tgzPrefix - The expected tgz filename prefix (e.g., "hyperfrontend-my-package-")
 * @returns true if the value is a file: reference containing a matching tgz
 */
function isTgzReference(value: string, tgzPrefix: string): boolean {
  return value.startsWith('file:') && value.includes(tgzPrefix) && value.endsWith('.tgz')
}

/**
 * Replaces a tgz filename in a file: dependency reference.
 *
 * @param value - The full dependency value (e.g., "file:../../packs/hyperfrontend-my-package-1.0.0.tgz")
 * @param tgzPrefix - The tgz filename prefix to look for
 * @param newTgzName - The new tgz filename to use
 * @returns The updated value with the new tgz filename
 */
function replaceTgzInValue(value: string, tgzPrefix: string, newTgzName: string): string {
  const lastSlashIndex = value.lastIndexOf('/')
  const tgzStartIndex = lastSlashIndex >= 0 ? lastSlashIndex + 1 : value.indexOf(':') + 1

  const pathPrefix = value.substring(0, tgzStartIndex)
  return pathPrefix + newTgzName
}

/**
 * Replaces a file: dependency reference (tgz path) in a package.json file.
 * This preserves the original key ordering by using JSON.parse/stringify.
 *
 * @param filePath - Path to the package.json file
 * @param packageName - The npm package name to update
 * @param tgzPrefix - The tgz filename prefix to match (e.g., "hyperfrontend-my-package-")
 * @param newTgzName - The new tgz filename to use
 * @returns true if a replacement was made, false otherwise
 *
 * @example Repinning the tarball an e2e project installs
 * ```typescript
 * replaceTgzReference('/repo/e2e/core/package.json', '@acme/core', 'acme-core-', 'acme-core-1.1.0.tgz')
 * // => true; "file:../../packs/acme-core-1.0.0.tgz" became "file:../../packs/acme-core-1.1.0.tgz"
 * // => false for a pin that is a plain version, which is left alone
 * ```
 */
export function replaceTgzReference(filePath: string, packageName: string, tgzPrefix: string, newTgzName: string): boolean {
  const content = readFileSync(filePath, 'utf-8')
  const pkg = parse(content) as Record<string, unknown>

  let changed = false

  for (const section of DEPENDENCY_SECTIONS) {
    const deps = pkg[section] as Record<string, string> | undefined
    if (deps && packageName in deps) {
      const currentValue = deps[packageName]
      if (typeof currentValue === 'string' && isTgzReference(currentValue, tgzPrefix)) {
        const newValue = replaceTgzInValue(currentValue, tgzPrefix, newTgzName)
        if (newValue !== currentValue) {
          deps[packageName] = newValue
          changed = true
        }
      }
    }
  }

  if (!changed) {
    return false
  }

  const newContent = stringify(pkg, null, 2) + '\n'
  writeFileSync(filePath, newContent, 'utf-8')
  return true
}
