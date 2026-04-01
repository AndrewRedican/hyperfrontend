import { readFileSync, writeFileSync } from 'node:fs'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'

/**
 * Dependency sections in package.json that can contain version references.
 */
const DEPENDENCY_SECTIONS: readonly string[] = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']

/**
 * Replaces a dependency version in a package.json file using JSON parsing.
 * This preserves the original key ordering by using JSON.parse/stringify.
 *
 * @param filePath - Path to the package.json file
 * @param packageName - The npm package name to update
 * @param newVersion - The new version string to set
 * @returns true if a replacement was made, false otherwise
 */
export function replaceDependencyVersion(filePath: string, packageName: string, newVersion: string): boolean {
  const content = readFileSync(filePath, 'utf-8')
  const pkg = <Record<string, unknown>>parse(content)

  let changed = false

  for (const section of DEPENDENCY_SECTIONS) {
    const deps = <Record<string, string> | undefined>pkg[section]
    if (deps && packageName in deps && deps[packageName] !== newVersion) {
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
 */
export function replaceTgzReference(filePath: string, packageName: string, tgzPrefix: string, newTgzName: string): boolean {
  const content = readFileSync(filePath, 'utf-8')
  const pkg = <Record<string, unknown>>parse(content)

  let changed = false

  for (const section of DEPENDENCY_SECTIONS) {
    const deps = <Record<string, string> | undefined>pkg[section]
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
