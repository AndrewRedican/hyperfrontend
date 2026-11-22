/**
 * A publishable library's `package.json` states none of the fields the build writes from the
 * workspace's root manifest: `repository`, `bugs`, `homepage` and `author`. A value stated for
 * one of them is never published, and the version flow reads the root manifest's repository
 * ahead of a library's own, so it is a second copy that can only drift. The fix removes it.
 *
 * @module rules/workspace/lib-pkg-inherited-fields
 */

import type { JsonObjectNode } from '@hyperfrontend/json-utils'
import type { Fix, JsonTreeNode } from '@hyperfrontend/linter'
import { basename, dirname } from 'node:path'
import { defineRule } from '@hyperfrontend/linter'
import { rootObject } from '@hyperfrontend/linter/helpers'
import { isPublishableLibrary, readPackageFile, workspaceRootOf } from '@hyperfrontend/workspace/lint'

/** A manifest, as far as its fields are read by name. */
type Manifest = Readonly<Record<string, unknown>>

/** The fields a built package takes from the workspace's root manifest, the same list the build executor inherits by. */
export const INHERITED_FIELDS: readonly string[] = ['repository', 'bugs', 'homepage', 'author']

/**
 * Whether the build adds the package's directory to the repository it writes, which it does where the root manifest states its repository in full.
 *
 * @param repository - What the root manifest states under `repository`
 * @returns True for an object whose `url` is text; false for the string shorthand, null or anything else
 *
 * @example A repository stated in full, and one stated as a shorthand
 * ```typescript
 * gainsDirectory({ type: 'git', url: 'git+https://github.com/acme/workspace.git' }) // => true
 * gainsDirectory('github:acme/workspace') // => false
 * ```
 */
export function gainsDirectory(repository: unknown): boolean {
  return typeof repository === 'object' && repository !== null && typeof (repository as Manifest)['url'] === 'string'
}

/**
 * The fix that removes a property with the separator that joined it to a neighbour, or everything between the braces where it is all the object holds.
 *
 * @param object - The object that holds the property
 * @param index - The property's place among the object's properties
 * @returns The fix
 */
function removal(object: JsonObjectNode, index: number): Fix {
  const { properties } = object
  if (index > 0) return { start: properties[index - 1].end, end: properties[index].end, text: '' }
  if (properties.length > 1) return { start: properties[0].start, end: properties[1].start, text: '' }
  return { start: object.start + 1, end: object.end - 1, text: '' }
}

export default defineRule<undefined, JsonTreeNode>({
  id: 'workspace/lib-pkg-inherited-fields',
  language: 'json',
  fixable: true,
  create(context) {
    const directory = dirname(context.file.path)
    if (basename(context.file.path) !== 'package.json') return {}
    const workspaceRoot = workspaceRootOf(directory)
    // why: the root manifest is where the build reads these fields, so there they are the source and never a copy.
    if (workspaceRoot === null || workspaceRoot === directory || !isPublishableLibrary(directory)) return {}
    const source = (readPackageFile(workspaceRoot) ?? {}) as Manifest
    // why: where the root manifest states no value for a field, the build keeps the package's own, which is then the one published.
    const written = INHERITED_FIELDS.filter((field) => source[field] !== undefined)
    const placed = gainsDirectory(source['repository'])
    return {
      document(node) {
        const root = rootObject(node)
        if (root === null) return
        root.properties.forEach((property, index) => {
          // why: a property's key is always a string literal.
          const field = property.key.value as string
          // why: every property that states a field is reported, since a key written twice still states it once one of the two is gone.
          if (!written.includes(field)) return
          context.report({
            start: property.start,
            end: property.end,
            message: `Remove "${field}": the build writes it from the workspace's root manifest${field === 'repository' && placed ? " and adds this package's directory" : ''}, so a value stated here is never published.`,
            fix: removal(root, index),
          })
        })
      },
    }
  },
})
