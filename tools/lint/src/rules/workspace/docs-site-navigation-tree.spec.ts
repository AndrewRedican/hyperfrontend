import type { ExpectedError } from '@hyperfrontend/linter/testing'
import { existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { testRule } from '@hyperfrontend/linter/testing'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createSiteWorkspaces } from './__test-utils__/site-workspace.ts'
import rule from './docs-site-navigation-tree.ts'

const workspaces = createSiteWorkspaces()

/** The site's navigation module, workspace-relative. */
const NAVIGATION = 'apps/docs-site/src/lib/navigation.ts'

/** A package subtree listed as the tree its routes form, around entries the rule leaves alone. */
const NESTED = [
  'const libraries = [',
  '  {',
  "    slug: 'alpha',",
  "    packageName: '@ws/alpha',",
  "    href: '/docs/libraries/alpha',",
  '    children: [',
  "      { slug: 'guide', href: '/docs/libraries/alpha/guide' },",
  "      { slug: 'tools', children: [{ 'slug': 'build', href: '/docs/libraries/alpha/tools/build' }, null, ...more] },",
  "      { href: '/docs/libraries/alpha/unnamed' },",
  '      { slug: name, ...rest, [key]: 1 },',
  '      other,',
  '    ],',
  '  },',
  "  { slug: 'beta', packageName: '@ws/beta', href: '/docs/libraries/beta', children: more },",
  "  { slug: 'Guides', href: '/docs/guides', children: [{ slug: 'a/b', href: '/elsewhere' }] },",
  "  { slug: 'gamma', packageName: name, children: [{ slug: 'a/b' }] },",
  "  { slug: 'delta', packageName: '@ws/delta', children: [{ slug: 'a/b' }] },",
  ']',
].join('\n')

/** A package subtree whose entries are listed flat, misplaced, or left unlinked. */
const FLAT = [
  'export const libraries = [',
  '  {',
  "    slug: 'alpha',",
  "    packageName: '@ws/alpha',",
  "    href: '/docs/libraries/alpha',",
  '    children: [',
  "      { slug: 'tools/build', href: '/docs/libraries/alpha/tools/build' },",
  "      { slug: 'nx/tools/run', href: '/docs/libraries/alpha/nx/tools/run' },",
  "      { slug: 'build', href: '/docs/libraries/alpha/tools/build' },",
  "      { slug: 'sub', children: [{ slug: 'deep', href: '/docs/libraries/alpha/deep' }] },",
  '    ],',
  '  },',
  ']',
].join('\n')

/**
 * An error reported on the entry one line of the flat listing opens.
 *
 * @param needle - Text that begins the entry's object
 * @param message - What the rule must report
 * @returns The error, spanning the object to its closing brace on the same line
 */
function onEntry(needle: string, message: string): ExpectedError {
  const lines = FLAT.split(/\r?\n/)
  const index = lines.findIndex((line) => line.includes(needle))
  const text = lines[index] as string
  const column = text.indexOf(needle) + 1
  const close = needle.startsWith("{ slug: 'sub'") ? text.lastIndexOf('}') : text.indexOf('}', column)
  return { message, line: index + 1, column, endLine: index + 1, endColumn: close + 2 }
}

testRule(rule, {
  valid: [
    { name: 'a subtree nested by path segment', path: join(workspaces.full, NAVIGATION), root: workspaces.full, text: NESTED },
    {
      name: 'another file of the site',
      path: join(workspaces.full, 'apps/docs-site/src/lib/other.ts'),
      root: workspaces.full,
      text: FLAT,
    },
    {
      name: 'a navigation module elsewhere in the workspace',
      path: join(workspaces.full, 'libs/alpha/src/navigation.ts'),
      root: workspaces.full,
      text: FLAT,
    },
    { name: 'a navigation module outside any workspace', path: join(tmpdir(), 'x', NAVIGATION), root: tmpdir(), text: FLAT },
  ],
  invalid: [
    {
      name: 'entries listed flat, misplaced and unlinked',
      path: join(workspaces.full, NAVIGATION),
      root: workspaces.full,
      text: FLAT,
      errors: [
        onEntry(
          "{ slug: 'tools/build'",
          "Navigation entry 'tools/build' spans more than one path segment. An entry names one segment: list 'build' in the children of an entry for 'tools'."
        ),
        onEntry(
          "{ slug: 'nx/tools/run'",
          "Navigation entry 'nx/tools/run' spans more than one path segment. An entry names one segment: list 'tools/run' in the children of an entry for 'nx'."
        ),
        onEntry(
          "{ slug: 'build'",
          "Navigation entry 'build' links to '/docs/libraries/alpha/tools/build', but its place in the tree is '/docs/libraries/alpha/build'. List it in the children of the entry for its parent path."
        ),
        onEntry(
          "{ slug: 'sub'",
          "Navigation entry 'sub' groups the pages under '/docs/libraries/alpha/sub', which is a page itself. Give it href: '/docs/libraries/alpha/sub'."
        ),
        onEntry(
          "{ slug: 'deep'",
          "Navigation entry 'deep' links to '/docs/libraries/alpha/deep', but its place in the tree is '/docs/libraries/alpha/sub/deep'. List it in the children of the entry for its parent path."
        ),
      ],
    },
  ],
})

describe('the disposable workspaces', () => {
  it('are removed at the end', () => {
    rmSync(workspaces.full, { recursive: true, force: true })
    rmSync(workspaces.bare, { recursive: true, force: true })
    expect(existsSync(workspaces.full) || existsSync(workspaces.bare)).toBe(false)
  })
})
