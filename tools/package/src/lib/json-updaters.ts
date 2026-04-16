/**
 * JSON object with an optional description field.
 */
interface JsonWithDescription {
  /** Optional description text */
  description?: unknown
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
