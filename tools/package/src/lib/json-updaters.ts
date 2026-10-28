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
 */
export function replaceDescriptionPackageName(json: JsonWithDescription, currentPackageName: string, newPackageName: string): void {
  if (json.description && typeof json.description === 'string') {
    json.description = json.description.replaceAll(currentPackageName, newPackageName)
  }
}
