import type { ExpectedError, RuleCase } from '@hyperfrontend/linter/testing'
import type { TempDir } from '@hyperfrontend/testing/fs'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { testRule } from '@hyperfrontend/linter/testing'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempDir } from '@hyperfrontend/testing/fs'
import rule from './docs-site-libraries.ts'

/** A publishable library's project file. */
const PUBLISHABLE = JSON.stringify({ projectType: 'library', targets: { build: {}, publish: {} } })

/**
 * A disposable workspace.
 *
 * @param files - Its files, by workspace-relative path
 * @returns The root
 */
function workspace(files: Readonly<Record<string, string>>): TempDir {
  return createTempDir({ prefix: 'lint-docs-libraries-', tree: { 'nx.json': '{}', ...files } })
}

const PLACED = workspace({
  'libs/logging/project.json': PUBLISHABLE,
  'libs/logging/package.json': JSON.stringify({ name: '@hyperfrontend/logging' }),
  'libs/utils/json/project.json': PUBLISHABLE,
  'libs/utils/json/package.json': JSON.stringify({ name: '@hyperfrontend/json-utils' }),
  'libs/unnamed/project.json': PUBLISHABLE,
  'libs/unnamed/package.json': '{}',
  'apps/docs-site/src/lib/ecosystem.ts':
    "export const ECOSYSTEM_TIERS = [{ packages: ['@hyperfrontend/logging', '@hyperfrontend/json-utils'] }]\n",
})
const UNPLACED = workspace({
  'plugins/features/project.json': PUBLISHABLE,
  'plugins/features/package.json': JSON.stringify({ name: '@hyperfrontend/features' }),
  'apps/docs-site/src/lib/ecosystem.ts': 'export const ECOSYSTEM_TIERS = []\n',
})
const BARE = workspace({
  'libs/logging/project.json': PUBLISHABLE,
  'libs/logging/package.json': JSON.stringify({ name: '@hyperfrontend/logging' }),
})
const OUTSIDE = createTempDir({ prefix: 'lint-docs-libraries-outside-' })

/**
 * A case linting a site file.
 *
 * @param name - What the case shows
 * @param root - The workspace
 * @param file - The site file, workspace-relative
 * @param text - Its text
 * @returns The case
 */
function site(name: string, root: string, file: string, text: string): RuleCase {
  return { name, path: join(root, file), root, text }
}

/**
 * The errors of a one-line declaration of the array.
 *
 * @param text - The file's text
 * @param messages - The messages expected
 * @returns The errors, each on the declarator
 */
function onDeclarator(text: string, messages: readonly string[]): ExpectedError[] {
  const start = text.indexOf('LIBRARIES')
  return messages.map((message) => ({ message, line: 1, column: start + 1, endLine: 1, endColumn: text.length + 1 }))
}

const CONTENT = 'apps/docs-site/src/lib/content.ts'
const LISTED =
  "export const LIBRARIES = [{ packageName: '@hyperfrontend/logging' }, { 'packageName': '@hyperfrontend/json-utils', ...rest }, null, { name: 1 }]"
const EMPTY = 'export const LIBRARIES = []'
const missing = (name: string, path: string): string => `Publishable library '${name}' (${path}) is not listed in the LIBRARIES array`
const unplaced = (name: string, path: string): string =>
  `Publishable library '${name}' (${path}) is not placed on any level of ECOSYSTEM_TIERS in apps/docs-site/src/lib/ecosystem.ts, so it would not appear on /docs/libraries`

testRule(rule, {
  valid: [
    site(
      'a content file listing and placing every library',
      PLACED.path,
      CONTENT,
      LISTED.replace('[{', "[{ packageName: '@hyperfrontend/json-utils' }, {")
    ),
    site('an array that is not exported from the content', PLACED.path, CONTENT, 'const LIBRARIES = []'),
    site('an array declared with let', PLACED.path, CONTENT, 'export let LIBRARIES = []'),
    site('a value that is not an array', PLACED.path, CONTENT, 'export const LIBRARIES = {}'),
    site('another array', PLACED.path, CONTENT, 'export const OTHER = []'),
    site('a file of the same name elsewhere', PLACED.path, 'src/lib/content.ts', EMPTY),
    site('another file of the site', PLACED.path, 'apps/docs-site/src/lib/other.ts', EMPTY),
    site(
      'a generator listing every library, the hierarchy unread',
      PLACED.path,
      'apps/docs-site/scripts/generate-docs.ts',
      'const LIBRARIES = [{ packageName: "@hyperfrontend/logging" }, { packageName: "@hyperfrontend/json-utils" }]'
    ),
    site('a site outside any workspace', OUTSIDE.path, CONTENT, EMPTY),
  ],
  invalid: [
    {
      ...site('a library missing from the content and the hierarchy', PLACED.path, CONTENT, EMPTY),
      errors: onDeclarator(EMPTY, [
        missing('@hyperfrontend/json-utils', 'libs/utils/json'),
        missing('@hyperfrontend/logging', 'libs/logging'),
      ]),
    },
    {
      ...site('a navigation file missing a library', PLACED.path, 'apps/docs-site/src/lib/navigation.ts', 'const LIBRARIES = []'),
      errors: onDeclarator('const LIBRARIES = []', [
        missing('@hyperfrontend/json-utils', 'libs/utils/json'),
        missing('@hyperfrontend/logging', 'libs/logging'),
      ]),
    },
    {
      ...site('a library the hierarchy does not place', UNPLACED.path, CONTENT, EMPTY),
      errors: onDeclarator(EMPTY, [
        missing('@hyperfrontend/features', 'plugins/features'),
        unplaced('@hyperfrontend/features', 'plugins/features'),
      ]),
    },
    {
      ...site('a workspace without a hierarchy file', BARE.path, CONTENT, EMPTY),
      errors: onDeclarator(EMPTY, [missing('@hyperfrontend/logging', 'libs/logging')]),
    },
  ],
})

describe('the disposable workspaces', () => {
  it('are removed at the end', () => {
    for (const root of [PLACED, UNPLACED, BARE, OUTSIDE]) root.remove()
    expect([PLACED, UNPLACED, BARE, OUTSIDE].some((root) => existsSync(root.path))).toBe(false)
  })
})
