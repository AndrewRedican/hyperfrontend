/**
 * The pieces of a project or package manifest a rename rewrites: its name and the package name its
 * description mentions.
 *
 * @module generators/shared/json-updaters
 */

import { replacePackageMentions } from './package-mentions'

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
 * A longer name that starts with the package's, such as `@acme/core-ui` beside `@acme/core`, is left alone.
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
 *   return json // description "E2E tests for @acme/core and @acme/core-ui" now reads "E2E tests for @acme/kernel and @acme/core-ui"
 * })
 * ```
 */
export function replaceDescriptionPackageName(json: JsonWithDescription, currentPackageName: string, newPackageName: string): void {
  if (json.description && typeof json.description === 'string') {
    json.description = replacePackageMentions(json.description, currentPackageName, newPackageName)
  }
}
