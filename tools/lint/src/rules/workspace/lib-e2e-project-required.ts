/**
 * Every publishable library under `libs/` has an e2e project under `apps/package-e2e/` named
 * after it without the `lib-` prefix, where the published package is exercised.
 *
 * @module rules/workspace/lib-e2e-project-required
 */

import { existsSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { isString, propertyOf, wholeDocument } from '@hyperfrontend/linter/helpers'
import { workspaceRootOf } from '@hyperfrontend/workspace/lint'
import { manifestRule } from './shared/manifest-rule.ts'

export default manifestRule('workspace/lib-e2e-project-required', 'project.json', (root, context) => {
  const workspace = workspaceRootOf(dirname(context.file.path))
  if (workspace === null || !relative(workspace, dirname(context.file.path)).startsWith(`libs${sep}`)) return
  const name = propertyOf(root, 'name')
  if (name === null || !isString(name.value)) return
  const libraryName = name.value.value
  const folder = libraryName.startsWith('lib-') ? libraryName.slice(4) : libraryName
  if (existsSync(join(workspace, 'apps', 'package-e2e', folder, 'project.json'))) return
  context.report({
    ...wholeDocument(context.file),
    message: `Publishable library '${libraryName}' is missing a corresponding e2e project. Expected: apps/package-e2e/${folder}/project.json`,
  })
})
