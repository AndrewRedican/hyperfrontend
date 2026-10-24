import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createDocsWorkspace } from '../__test-utils__/docs-workspace.ts'
import { headingAnchors, headingSlug, linkProblem } from './docs-anchors.ts'
import { docsIndex } from './docs-catalog.ts'

const root = createDocsWorkspace()
const index = docsIndex(root, join(root, 'apps/docs-site'))
const README = join(root, 'libs/alpha/README.md')
const SITE = 'https://www.hyperfrontend.dev'
const REPO = 'https://github.com/org/repo'

/**
 * The verdict on a link from the alpha README.
 *
 * @param href - The link
 * @param repoUrl - The repository, the fixture's unless given
 * @returns The reason it does not resolve, or `ok`
 */
function verdict(href: string, repoUrl = REPO): string {
  return linkProblem(index, { siteUrl: SITE, repoUrl }, href, README) ?? 'ok'
}

describe('headingSlug', () => {
  it('drops markup, punctuation and tags, and dashes the spaces', () => {
    expect(headingSlug('The `api` of [links](x) and ![img](y) **bold** *em* <span>tag</span>, too!')).toBe(
      'the-api-of-links-and-img-bold-em-tag-too'
    )
  })
})

describe('headingAnchors', () => {
  it('numbers repeats and skips fences and empty slugs', () => {
    expect([...headingAnchors('# A\n## A\n## A\n```\n# Fenced\n```\n~~~\n# Tilde\n~~~\n# !!!\ntext')]).toEqual(['a', 'a-1', 'a-2'])
  })
})

describe('linkProblem', () => {
  it('checks an anchor of the same document', () => {
    expect([verdict('#usage-1'), verdict('#missing')]).toEqual(['ok', "this document has no heading with the anchor 'missing'"])
  })

  it('checks a page of the site and its document anchors', () => {
    expect([
      verdict(`${SITE}/docs/libraries/alpha/`),
      verdict(`${SITE}/docs/libraries/alpha/#usage`),
      verdict(`${SITE}/docs/libraries/alpha/#nope`),
      verdict('https://hyperfrontend.dev/architecture#layers'),
      verdict('https://www.hyperfrontend.dev/docs/guides/start#install'),
      verdict(`${SITE}/docs/contributing#x`),
      verdict(`${SITE}/#top`),
      verdict(`${SITE}/docs/nothing`),
    ]).toEqual([
      'ok',
      'ok',
      "libs/alpha/README.md has no heading with the anchor 'nope'",
      'ok',
      'ok',
      '/docs/contributing renders CONTRIBUTING.md, which does not exist',
      'ok',
      'the site has no page at /docs/nothing',
    ])
  })

  it('checks API anchors against the entries', () => {
    const api = (route: string, anchor: string): string => verdict(`${SITE}${route}#api-${anchor}`)
    expect([
      api('/docs/libraries/alpha/', 'reference'),
      api('/docs/libraries/alpha/', 'Widget'),
      api('/docs/libraries/alpha/', 'Widget-prop-size'),
      api('/docs/libraries/alpha/', 'Widget-prop-run'),
      api('/docs/libraries/alpha/', 'Widget-method-run'),
      api('/docs/libraries/alpha/', 'Widget-method-size'),
      api('/docs/libraries/alpha/', 'subOnly'),
      api('/docs/libraries/alpha/dir/', 'subOnly'),
      api('/docs/libraries/alpha/', 'Nope'),
      api('/architecture', 'x'),
    ]).toEqual([
      'ok',
      'ok',
      'ok',
      "Widget has no property 'run' with an anchor of its own",
      'ok',
      "Widget has no method 'size' with an anchor of its own",
      'ok',
      "@ws/alpha does not export 'subOnly' from /docs/libraries/alpha/dir/; it is exported by /docs/libraries/alpha/sub/",
      "@ws/alpha does not export 'Nope' from /docs/libraries/alpha/",
      '/architecture is not a package page, so it has no api-* anchors',
    ])
  })

  it('checks links into the repository', () => {
    expect([
      verdict(`${REPO}/blob/main/libs/alpha/README.md`),
      verdict(`${REPO}/blob/main/missing.md`),
      verdict(`${REPO}/blob/main/libs`),
      verdict(`${REPO}/tree/main/libs`),
      verdict(`${REPO}/issues`),
      verdict(`${REPO}/blob/main`),
      verdict('https://github.com/other/x'),
      verdict(`${REPO}/blob/main/missing.md`, ''),
      verdict('https://example.com/x'),
    ]).toEqual([
      'ok',
      'the repository has no file at missing.md',
      'libs is a directory; link it with /tree/ rather than /blob/',
      'ok',
      'ok',
      'ok',
      'ok',
      'ok',
      'ok',
    ])
  })

  it('reports a URL that does not parse', () => {
    expect(verdict('http://[')).toBe("'http://[' is not a valid URL")
  })

  it('checks a relative file and its heading', () => {
    expect([
      verdict('./ARCHITECTURE.md'),
      verdict('./ARCHITECTURE.md#design'),
      verdict('./ARCHITECTURE.md#nope'),
      verdict('./src#x'),
      verdict('./missing.md'),
    ]).toEqual([
      'ok',
      'ok',
      "libs/alpha/ARCHITECTURE.md has no heading with the anchor 'nope'",
      'ok',
      'libs/alpha/missing.md does not exist',
    ])
  })

  it('reads the anchors of a document that is missing as none', () => {
    expect(linkProblem(index, { siteUrl: SITE, repoUrl: REPO }, '#x', join(root, 'libs/alpha/GONE.md'))).toBe(
      "this document has no heading with the anchor 'x'"
    )
  })
})

describe('the disposable workspace', () => {
  it('is removed at the end', () => {
    rmSync(root, { recursive: true, force: true })
    expect(existsSync(root)).toBe(false)
  })
})
