/**
 * The pieces of a project or package manifest a rename rewrites: its name and the package name its
 * description mentions.
 *
 * @module generators/shared/json-updaters
 */

/**
 * JSON object with an optional description field.
 */
export interface JsonWithDescription {
  /** Optional description text */
  description?: unknown
}

/**
 * A project or package manifest as far as a rename reads it.
 */
export interface NamedJson extends JsonWithDescription {
  /** The project or package name */
  name?: string
}

/**
 * Update description field by replacing package name references.
 * Mutates the json object in place for use inside updateJson callbacks.
 *
 * @param json - The JSON object to update
 * @param currentPackageName - Package name to replace
 * @param newPackageName - Replacement package name
 *
 * @example Inside an `updateJson` updater
 * ```typescript
 * import type { NamedJson } from '@hyperfrontend/workspace/generators'
 * import { replaceDescriptionPackageName, updateJson } from '@hyperfrontend/workspace/generators'
 *
 * updateJson<NamedJson>(tree, 'e2e/core/project.json', (json) => {
 *   replaceDescriptionPackageName(json, '@acme/core', '@acme/kernel')
 *   return json // description "E2E tests for @acme/core" now reads "E2E tests for @acme/kernel"
 * })
 * ```
 */
export function replaceDescriptionPackageName(json: JsonWithDescription, currentPackageName: string, newPackageName: string): void {
  if (json.description && typeof json.description === 'string') {
    json.description = json.description.replaceAll(currentPackageName, newPackageName)
  }
}
