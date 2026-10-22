import type { DocsPackage } from './docs-catalog.ts'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createDocsWorkspace } from '../__fixtures__/docs-workspace.ts'
import {
  docsIndex,
  entryOfFile,
  entryOfRoute,
  markdownOfRoute,
  packageOfFile,
  repositoryUrl,
  routeExists,
  routeKey,
} from './docs-catalog.ts'

const root = createDocsWorkspace()
const site = join(root, 'apps/docs-site')
const index = docsIndex(root, site)
const alpha = index.packages.get('@ws/alpha') as DocsPackage

describe('docsIndex', () => {
  it('builds once per workspace and site', () => {
    expect(docsIndex(root, site)).toBe(index)
  })

  it('indexes the publishable libraries under libs, named by their manifests or directories', () => {
    expect([...index.packages.keys()].sort()).toEqual([
      '@hyperfrontend/delta',
      '@hyperfrontend/gamma',
      '@ws/alpha',
      '@ws/beta-utils',
      'epsilon',
      'nameless',
    ])
  })

  it('routes a utilities library under the utilities', () => {
    expect([alpha.route, index.packages.get('@ws/beta-utils')?.route]).toEqual(['/docs/libraries/alpha/', '/docs/libraries/utils/beta/'])
  })

  it('reads the entries whose sources exist', () => {
    expect([...alpha.entries.values()].map((entry) => `${entry.subpath}=${entry.route}`)).toEqual([
      '=/docs/libraries/alpha/',
      'sub=/docs/libraries/alpha/sub/',
      'deep/inner=/docs/libraries/alpha/deep/inner/',
      'dir=/docs/libraries/alpha/dir/',
    ])
  })

  it('reads the bundle globals', () => {
    expect([...alpha.globals]).toEqual([
      ['AlphaGlobal', ''],
      ['AlphaSub', 'sub'],
      ['AlphaUmd', ''],
    ])
  })

  it('indexes symbols and members by name', () => {
    expect([index.symbols.get('sharedName')?.length, index.members.get('level')?.map((hit) => hit.parent.name)]).toEqual([
      4,
      ['Options', 'settings', 'Options'],
    ])
  })
})

describe('packageOfFile and entryOfFile', () => {
  it('finds the package and entry a file belongs to', () => {
    const file = join(root, 'libs/alpha/src/sub/README.md')
    expect([packageOfFile(index, file)?.name, entryOfFile(alpha, file)?.subpath]).toEqual(['@ws/alpha', 'sub'])
  })

  it('finds nothing for a file outside every package or beside no entry', () => {
    expect([packageOfFile(index, join(root, 'README.md')), entryOfFile(alpha, join(root, 'libs/alpha/README.md'))]).toEqual([null, null])
  })
})

describe('routeExists', () => {
  it('knows pages, guides and articles', () => {
    expect(
      [
        '/',
        '/docs/libraries/alpha/',
        '/docs/guides/start',
        '/docs/guides/none',
        '/articles/story',
        '/articles/none',
        '/articles/a/b',
        '/docs/none',
      ].map((route) => routeExists(index, route))
    ).toEqual([true, true, true, false, true, false, false, false])
  })
})

describe('routeKey', () => {
  it('resolves dot segments and drops empty ones', () => {
    expect(routeKey('//docs/./libraries/x/../alpha/')).toBe('docs/libraries/alpha')
  })
})

describe('markdownOfRoute', () => {
  it('finds the documents routes render', () => {
    const shown = (route: string): string | null => markdownOfRoute(index, route)?.slice(root.length + 1) ?? null
    expect(
      [
        '/architecture',
        '/docs/guides/start',
        '/articles/story',
        '/docs/libraries/alpha',
        '/docs/libraries/alpha/architecture',
        '/docs/libraries/alpha/sub',
        '/docs/libraries/alpha/extra',
        '/docs/libraries/alpha/none',
        '/elsewhere',
      ].map(shown)
    ).toEqual([
      'ARCHITECTURE.md',
      'apps/docs-site/content/guides/start/guide.md',
      'apps/docs-site/content/articles/story.md',
      'libs/alpha/README.md',
      'libs/alpha/ARCHITECTURE.md',
      'libs/alpha/src/sub/README.md',
      'libs/alpha/src/lib/extra/README.md',
      null,
      null,
    ])
  })
})

describe('entryOfRoute', () => {
  it('finds the package and entry of a route', () => {
    expect(
      ['/docs/libraries/alpha/', '/docs/libraries/alpha/sub/', '/docs/libraries/alpha/none', '/docs/other'].map((route) => {
        const owner = entryOfRoute(index, route)
        return owner === null ? null : `${owner.pkg.name} ${owner.entry?.subpath ?? '-'}`
      })
    ).toEqual(['@ws/alpha -', '@ws/alpha sub', '@ws/alpha -', null])
  })
})

describe('repositoryUrl', () => {
  it('normalises the declared repository', () => {
    expect(repositoryUrl(root)).toBe('https://github.com/org/repo')
  })

  it('answers null without a manifest, a repository or a string', () => {
    const bare = mkdtempSync(join(tmpdir(), 'lint-docs-repo-'))
    const answers = [repositoryUrl(bare)]
    for (const manifest of ['{}', '{"repository":""}', '{"repository":"https://example.com/x.git/"}']) {
      writeFileSync(join(bare, 'package.json'), manifest)
      answers.push(repositoryUrl(bare))
    }
    rmSync(bare, { recursive: true, force: true })
    expect(answers).toEqual([null, null, null, 'https://example.com/x.git'])
  })
})

describe('the disposable workspace', () => {
  it('is removed at the end', () => {
    rmSync(root, { recursive: true, force: true })
    expect(existsSync(root)).toBe(false)
  })
})
