/**
 * The documentation site lists every publishable library: the `LIBRARIES` array of the site's
 * content, navigation and documentation generator names each by package, and the content's
 * array also has each one placed on a level of the ecosystem hierarchy.
 *
 * @module rules/workspace/docs-site-libraries
 */

import type { Node } from '../../code/model.ts'
import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, join, posix, sep } from 'node:path'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '../../engine/rule.ts'
import { publishableLibraries } from './shared/libraries.ts'
import { workspaceRootOf } from './shared/locate.ts'
import { readPackageFile } from './shared/project-file.ts'

/** A publishable library and its package name. */
interface NamedLibrary {
  /** The package name. */
  readonly packageName: string
  /** The library's root, workspace-relative. */
  readonly path: string
}

/** The file placing libraries on the ecosystem hierarchy, workspace-relative. */
const ECOSYSTEM = 'apps/docs-site/src/lib/ecosystem.ts'

/** The files whose `LIBRARIES` array is checked, by where they sit in the site. */
const LISTING_FILES: Readonly<Record<string, string>> = {
  'content.ts': 'apps/docs-site/src/lib',
  'navigation.ts': 'apps/docs-site/src/lib',
  'generate-docs.ts': 'apps/docs-site/scripts',
}

/**
 * The package names an array of library entries lists.
 *
 * @param array - The array expression
 * @returns The names written as string literals
 */
function listedPackages(array: Node): Set<string> {
  const names = createSet<string>()
  for (const element of array.elements as readonly (Node | null)[]) {
    if (element?.kind !== 'ObjectExpression') continue
    for (const property of element.properties as readonly Node[]) {
      const key = property.key as Node | undefined
      const keyName = key?.kind === 'Identifier' ? key.name : key?.kind === 'Literal' ? key.value : null
      const value = property.value as Node | undefined
      if (keyName === 'packageName' && value?.kind === 'Literal' && typeof value.value === 'string') names.add(value.value)
    }
  }
  return names
}

export default defineRule<undefined, Node>({
  id: 'workspace/docs-site-libraries',
  language: 'code',
  fixable: false,
  create(context) {
    const path = context.file.path
    const name = basename(path)
    const location = LISTING_FILES[name]
    if (location === undefined || !dirname(path).split(sep).join(posix.sep).endsWith(`/${location}`)) return {}
    const root = workspaceRootOf(dirname(path))
    if (root === null) return {}
    const content = name === 'content.ts'
    return {
      VariableDeclaration(node) {
        if (node.variableKind !== 'const' || (content && (node.parent as Node).kind !== 'ExportNamedDeclaration')) return
        for (const declarator of node.declarations as readonly Node[]) {
          const init = declarator.init as Node | null
          if ((declarator.id as Node).name !== 'LIBRARIES' || init?.kind !== 'ArrayExpression') continue
          const listed = listedPackages(init)
          const ecosystemFile = join(root, ECOSYSTEM)
          // context: only the content drives the index page, so only it answers for a library missing from the hierarchy.
          const ecosystem = content && existsSync(ecosystemFile) ? readFileSync(ecosystemFile, 'utf8') : null
          const libraries: NamedLibrary[] = []
          for (const library of publishableLibraries(root)) {
            const packageName = readPackageFile(library.directory)?.name
            if (typeof packageName === 'string') libraries.push({ packageName, path: library.path })
          }
          libraries.sort((a, b) => a.packageName.localeCompare(b.packageName))
          for (const { packageName, path: libraryPath } of libraries) {
            const report = (message: string): void => context.report({ start: declarator.start, end: declarator.end, message })
            if (!listed.has(packageName))
              report(`Publishable library '${packageName}' (${libraryPath}) is not listed in the LIBRARIES array`)
            if (ecosystem !== null && !ecosystem.includes(`'${packageName}'`)) {
              report(
                `Publishable library '${packageName}' (${libraryPath}) is not placed on any level of ECOSYSTEM_TIERS in ${ECOSYSTEM}, so it would not appear on /docs/libraries`
              )
            }
          }
        }
      },
    }
  },
})
