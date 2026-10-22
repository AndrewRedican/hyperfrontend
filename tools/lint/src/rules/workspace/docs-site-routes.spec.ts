import type { ExpectedError } from '../../testing/rule-tester.ts'
import { existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { testRule } from '../../testing/rule-tester.ts'
import { CONTENT, LISTING, createSiteWorkspaces } from './__fixtures__/site-workspace.ts'
import rule from './docs-site-routes.ts'

const workspaces = createSiteWorkspaces()

/**
 * An error reported on one line of the listing.
 *
 * @param line - The 1-based line of the entry
 * @param message - What the rule must report
 * @returns The error, spanning the entry's object
 */
function onEntry(line: number, message: string): ExpectedError {
  const text = LISTING.split(/\r?\n/)[line - 1] as string
  return { message, line, column: text.indexOf('{') + 1, endLine: line, endColumn: text.lastIndexOf('}') + 2 }
}

testRule(rule, {
  valid: [
    {
      name: 'another file of the site',
      path: join(workspaces.full, 'apps/docs-site/src/lib/other.ts'),
      root: workspaces.full,
      text: LISTING,
    },
    { name: 'a content module outside any workspace', path: join(tmpdir(), 'x', CONTENT), root: tmpdir(), text: LISTING },
    {
      name: 'an array that is not exported',
      path: join(workspaces.full, CONTENT),
      root: workspaces.full,
      text: 'const LIBRARIES = [{ name: "A", slug: "a", category: "core" }]',
    },
    {
      name: 'an exported array declared with let',
      path: join(workspaces.full, CONTENT),
      root: workspaces.full,
      text: 'export let LIBRARIES = []',
    },
    {
      name: 'an exported value that is not an array',
      path: join(workspaces.full, CONTENT),
      root: workspaces.full,
      text: 'export const LIBRARIES = {}, OTHER = []',
    },
  ],
  invalid: [
    {
      name: 'entries missing their pages, links and generator entries',
      path: join(workspaces.full, CONTENT),
      root: workspaces.full,
      text: LISTING,
      errors: [
        onEntry(
          3,
          "Library 'Two' (slug: 'two-words') is missing required page.tsx at apps/docs-site/src/app/docs/libraries/two-words/page.tsx"
        ),
        onEntry(3, "Library 'Two' (slug: 'two-words') is missing navigation entry 'href: '/docs/libraries/two-words'' in navigation.ts"),
        onEntry(3, "Library 'Two' (slug: 'two-words') is missing from LIBRARIES array in generate-docs.ts"),
        onEntry(3, "Library 'Two' (slug: 'two-words') is missing from LIBRARY_SLUGS in generate-docs.ts"),
        onEntry(4, "Library 'Beta' (slug: 'beta') is missing required page.tsx at apps/docs-site/src/app/docs/libraries/beta/page.tsx"),
        onEntry(4, "Library 'Beta' (slug: 'beta') is missing navigation entry 'href: '/docs/libraries/beta'' in navigation.ts"),
        onEntry(5, "Library 'Gone' (slug: 'gone') is missing required page.tsx at apps/docs-site/src/app/docs/libraries/gone/page.tsx"),
        onEntry(5, "Library 'Gone' (slug: 'gone') is missing navigation entry 'href: '/docs/libraries/gone'' in navigation.ts"),
      ],
    },
    {
      name: 'a workspace without navigation or generator',
      path: join(workspaces.bare, CONTENT),
      root: workspaces.bare,
      text: 'export const LIBRARIES = [{ name: "Alpha", slug: "alpha", category: "core" }]',
      errors: [
        {
          message: "Library 'Alpha' (slug: 'alpha') is missing required page.tsx at apps/docs-site/src/app/docs/libraries/alpha/page.tsx",
          line: 1,
          column: 27,
          endLine: 1,
          endColumn: 77,
        },
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
