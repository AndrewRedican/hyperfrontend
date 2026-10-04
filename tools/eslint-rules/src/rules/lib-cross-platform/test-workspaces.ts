import type { TempWorkspaceManager } from '../../testing'
import { NON_PUBLISHABLE_LIBRARY_PROJECT_JSON, PUBLISHABLE_LIBRARY_PROJECT_JSON } from '../../testing'

/**
 * Files to lint, one per kind of project lib-cross-platform treats differently.
 */
export interface CrossPlatformFiles {
  /** A file in a publishable library whose runtime sources import from `node:`. */
  node: string
  /** A file in a publishable library whose runtime sources never import from `node:`. */
  browser: string
  /** A file in a library that is not published. */
  unpublished: string
}

/**
 * Creates the temporary projects the lib-cross-platform specs lint against. The browser
 * project carries `node:` imports only where they must not count: specs, setup, fixtures,
 * declarations, and `node_modules`.
 *
 * @param manager - The temp workspace manager owning cleanup.
 * @returns A file path inside each project.
 *
 * @example Linting a case inside the Node project
 * ```typescript
 * const files = createCrossPlatformFiles(manager)
 * ruleTester.run(RULE_NAME, rule, { valid: [{ code: 'x', filename: files.node }], invalid: [] })
 * ```
 */
export function createCrossPlatformFiles(manager: TempWorkspaceManager): CrossPlatformFiles {
  const nodeImport = "import { join } from 'node:path'\n"
  const node = manager.create({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    files: { 'nx.json': '{}', 'src/view.ts': 'export {}\n', 'src/deep/runtime.ts': nodeImport },
  })
  const browser = manager.create({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    files: {
      'nx.json': '{}',
      'src/view.ts': 'export {}\n',
      'src/view.spec.ts': nodeImport,
      'src/test.setup.ts': nodeImport,
      'src/types.d.ts': nodeImport,
      'src/__fixtures__/fixture.ts': nodeImport,
      'src/node_modules/dep/index.ts': nodeImport,
      'src/notes.md': nodeImport,
    },
  })
  const unpublished = manager.create({ projectJson: NON_PUBLISHABLE_LIBRARY_PROJECT_JSON, files: { 'src/runtime.ts': nodeImport } })
  return { node: node.getPath('src/file.ts'), browser: browser.getPath('src/file.ts'), unpublished: unpublished.getPath('src/file.ts') }
}
