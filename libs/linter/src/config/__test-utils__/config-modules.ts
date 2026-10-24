/**
 * Configuration modules the loader and command specs load by path, written to a temporary
 * directory because a configuration is imported from disk.
 *
 * @module config/__test-utils__/config-modules
 */

import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createTempDir } from '@hyperfrontend/testing/fs'

/** Absolute path of the library's source, which the written modules import by address. */
const SRC = resolve(fileURLToPath(import.meta.url), '../../..')

/**
 * The `file:` address of one library module, for a written module's import specifier.
 *
 * @param segments - Path segments under the library's source directory
 * @returns The address Node's loader accepts on every platform; a native absolute path is read as a URL scheme on Windows
 */
function sourceUrl(...segments: readonly string[]): string {
  return pathToFileURL(join(SRC, ...segments)).href
}

/** A rule a family registers in the specs: reports a manifest's `main` field and removes it. */
const NO_MAIN_RULE = `import type { JsonPropertyNode } from '${sourceUrl('languages', 'json-tree.ts')}'
import type { JsonTreeNode } from '${sourceUrl('languages', 'json.ts')}'
import { defineRule } from '${sourceUrl('engine', 'rule.ts')}'
import { propertyOf } from '${sourceUrl('rules', 'shared', 'json.ts')}'

const MESSAGE = 'Remove the "main" field. The "exports" field should be used instead for modern Node.js resolution.'

/**
 * A rule a family registers in the specs: reports a manifest's \`main\` field and removes it.
 */
export default defineRule<undefined, JsonTreeNode>({
  id: 'fixture/no-main',
  language: 'json',
  fixable: true,
  create(context) {
    return {
      document(node) {
        if (node.kind !== 'document' || node.root.kind !== 'object') return
        const properties: readonly JsonPropertyNode[] = node.root.properties
        const main = propertyOf(node.root, 'main')
        if (main === null) return
        const index = properties.indexOf(main)
        const fix =
          index > 0
            ? { start: (properties[index - 1] as JsonPropertyNode).end, end: main.end, text: '' }
            : { start: main.start, end: (properties[1] as JsonPropertyNode).start, text: '' }
        context.report({ start: main.start, end: main.end, message: MESSAGE, fix: properties.length > 1 ? fix : undefined })
      },
    }
  },
})
`

/** Every configuration module, keyed by its file name. */
const CONFIG_MODULES: Readonly<Record<string, string>> = {
  'empty.ts': `export default [{ files: ['**/*.json'], rules: {} }]
`,
  'ignoring.ts': `export default [{ ignores: ['dist/', '**/package.json'] }, { files: ['**/*.json'], rules: {} }]
`,
  'no-main-rule.ts': NO_MAIN_RULE,
  'no-main.ts': `import rule from './no-main-rule'

export default [{ families: { fixture: { 'no-main': rule } } }, { files: ['**/package.json'], rules: { 'fixture/no-main': 'error' } }]
`,
  'not-a-config.ts': `export default 'nothing'
`,
  'not-blocks.ts': `export default [{ files: ['**/*.json'] }, 'nothing']
`,
  'null-config.ts': `export default null
`,
  'warn.ts': `export default [
  { families: { fixture: { 'no-main': () => import('./no-main-rule') } } },
  { files: ['**/package.json'], rules: { 'fixture/no-main': 'warn' } },
]
`,
  'workspace.ts': `export default [{ files: ['**/*.json'], rules: { 'test/no-main': 'error' } }]
`,
}

/**
 * Write every configuration module to a new temporary directory.
 *
 * @returns Absolute path of the directory, which the calling spec file removes when it finishes
 *
 * @example Loading one of the configurations
 * ```typescript
 * const CONFIGS = writeConfigModules()
 * await loadConfig(join(CONFIGS, 'workspace.ts'))
 * rmSync(CONFIGS, { recursive: true, force: true })
 * ```
 */
export function writeConfigModules(): string {
  return createTempDir({ prefix: 'lint-configs-', tree: CONFIG_MODULES }).path
}
