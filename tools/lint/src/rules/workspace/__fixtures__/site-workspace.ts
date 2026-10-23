/**
 * A disposable workspace for the documentation-site rules: a library with documents at every
 * depth and secondary entries, a plugin, the site's navigation and generator, and some pages.
 *
 * @module rules/workspace/__fixtures__/site-workspace
 */

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

/** The site's pages directory, workspace-relative. */
const PAGES = 'apps/docs-site/src/app/docs'

/** The files of the full workspace, by workspace-relative path. */
const FILES: Readonly<Record<string, string>> = {
  'nx.json': '{}',
  'libs/alpha/README.md': '# alpha\n',
  'libs/alpha/CHANGELOG.md': '# changes\n',
  'libs/alpha/docs/GUIDE.md': '# guide\n',
  'libs/alpha/docs/rules/no-var.md': '# no-var\n',
  'libs/alpha/docs/rules/typescript/no-namespace.md': '# typescript/no-namespace\n',
  'libs/alpha/NOTICE.md': '# notice\n',
  'libs/alpha/src/__fixtures__/input.md': '# a spec input\n',
  'libs/alpha/src/README.md': '# source\n',
  'libs/alpha/src/lib/README.md': '# lib\n',
  'libs/alpha/src/lib/deep/README.md': '# deep\n',
  'libs/alpha/src/other/README.md': '# other\n',
  'libs/alpha/lib/README.md': '# top lib\n',
  'libs/alpha/lib/x/README.md': '# top lib x\n',
  'libs/alpha/node_modules/x/README.md': '# skipped\n',
  'libs/alpha/notes.txt': 'not markdown\n',
  'libs/alpha/package.json': JSON.stringify({
    name: '@ws/alpha',
    exports: {
      '.': './src/index.js',
      './package.json': './package.json',
      './sub': './src/sub/index.js',
      './missing': './src/missing/index.js',
      './glob/*': './x.js',
      bare: './y.js',
    },
  }),
  'libs/beta/package.json': JSON.stringify({ name: '@ws/beta', exports: './index.js' }),
  'plugins/plug/README.md': '# plug\n',
  [`${PAGES}/libraries/alpha/page.tsx`]: '',
  [`${PAGES}/libraries/alpha/guide/page.tsx`]: '',
  [`${PAGES}/libraries/alpha/sub/page.tsx`]: '',
  [`${PAGES}/plugins/plug/page.tsx`]: '',
  'apps/docs-site/src/lib/navigation.ts': "export const NAV = [{ href: '/docs/libraries/alpha' }, { href: '/docs/plugins/plug' }]\n",
  'apps/docs-site/scripts/generate-docs.ts': "const LIBRARIES = [{ packageName: '@ws/alpha' }]\nconst LIBRARY_SLUGS = { alpha: 'alpha' }\n",
}

/** The workspaces the site rules are linted in. */
export interface SiteWorkspaces {
  /** The full workspace. */
  readonly full: string
  /** A workspace with the library alone: no navigation, generator or pages. */
  readonly bare: string
}

/**
 * Writes files under a new temporary directory.
 *
 * @param files - The files, by relative path
 * @returns The directory
 */
function write(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(join(tmpdir(), 'lint-site-'))
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  return root
}

/**
 * Creates both workspaces.
 *
 * @returns Their roots
 */
export function createSiteWorkspaces(): SiteWorkspaces {
  return { full: write(FILES), bare: write({ 'nx.json': '{}', 'libs/alpha/README.md': '# alpha\n' }) }
}

/** The site's content module, workspace-relative. */
export const CONTENT = 'apps/docs-site/src/lib/content.ts'

/** A `LIBRARIES` array exercising every shape of entry the rules read. */
export const LISTING = [
  'export const LIBRARIES = [',
  "  { name: 'Alpha', slug: 'alpha', category: 'core', packageName: '@ws/alpha', readmePath: 'libs/alpha/README.md' },",
  "  { name: 'Two', 'slug': 'two-words', category: 'supporting', packageName: '@ws/two' },",
  "  { name: 'Beta', slug: 'beta', category: 'utils', readmePath: 'libs/beta/README.md' },",
  "  { name: 'Gone', slug: 'gone', category: 'utils', readmePath: 'libs/gone/README.md' },",
  "  { name: 'Plug', slug: 'plug', category: 'plugin', readmePath: 'plugins/plug/README.md' },",
  "  { name: 'Half', slug: 'half', ...rest, [key]: 1, category: 2 },",
  '  null,',
  '  other,',
  ']',
].join('\n')
