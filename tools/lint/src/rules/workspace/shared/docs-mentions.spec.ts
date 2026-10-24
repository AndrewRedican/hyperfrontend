import type { CodeMention } from './docs-mentions.ts'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createDocsWorkspace } from '../__test-utils__/docs-workspace.ts'
import { docsIndex } from './docs-catalog.ts'
import { exemptionOf, resolveMention } from './docs-mentions.ts'

const root = createDocsWorkspace()
const index = docsIndex(root, join(root, 'apps/docs-site'))
const origins = { siteUrl: 'https://site', repoUrl: 'https://github.com/org/repo' }
const README = join(root, 'libs/alpha/README.md')
const SUB = join(root, 'libs/alpha/src/sub/notes.md')
const ALPHA = 'https://site/docs/libraries/alpha/'

/**
 * A mention resolved from a file, compactly.
 *
 * @param text - The inline code
 * @param file - The file it sits in
 * @param repoUrl - The repository, the fixture's unless given
 * @returns The kind with its URL, its parent or its candidates
 */
function resolved(text: string, file = README, repoUrl = origins.repoUrl): string {
  const mention: CodeMention = resolveMention(index, { ...origins, repoUrl }, text, file)
  if (mention.kind === 'resolved') return `${mention.target} ${mention.url}${mention.via === undefined ? '' : ` via ${mention.via}`}`
  if (mention.kind === 'ambiguous' || mention.kind === 'elsewhere') return `${mention.kind} ${mention.candidates.join(' | ')}`
  return mention.kind
}

/**
 * The verdicts for a list of mentions.
 *
 * @param mentions - The inline code texts
 * @returns Each text with whether it is exempt
 */
function verdicts(mentions: readonly string[]): string[] {
  return mentions.map((mention) => `${mention} ${exemptionOf(mention) ? 'exempt' : 'checked'}`)
}

describe('exemptionOf', () => {
  it('exempts keywords, characters, numbers, quoted values and flags', () => {
    expect(verdicts(['null', 'x', '-1', '"a"', '--flag'])).toEqual(['null exempt', 'x exempt', '-1 exempt', '"a" exempt', '--flag exempt'])
  })

  it('exempts commands, files and paths', () => {
    expect(verdicts(['npm install', 'index.ts', './x', '~/x', 'dir/', 'a/b'])).toEqual([
      'npm install exempt',
      'index.ts exempt',
      './x exempt',
      '~/x exempt',
      'dir/ exempt',
      'a/b exempt',
    ])
  })

  it('exempts expressions, reserved names, kebab values, non-names and platform globals', () => {
    expect(verdicts(['f(x)', '__dirname', 'some-value', 'a.1', 'Map.prototype'])).toEqual([
      'f(x) exempt',
      '__dirname exempt',
      'some-value exempt',
      'a.1 exempt',
      'Map.prototype exempt',
    ])
  })

  it('checks names, scoped packages and subpaths', () => {
    expect(verdicts(['createThing', 'Thing.member', '@ws/pkg', '/sub'])).toEqual([
      'createThing checked',
      'Thing.member checked',
      '@ws/pkg checked',
      '/sub checked',
    ])
  })
})

describe('resolveMention', () => {
  it('exempts what needs no link', () => {
    expect([resolved('null'), resolved('@other/pkg'), resolved('@ws'), resolved('/sub', join(root, 'README.md'))]).toEqual([
      'exempt',
      'exempt',
      'exempt',
      'exempt',
    ])
  })

  it('resolves packages and their entries and pages', () => {
    expect([
      resolved('@ws/alpha'),
      resolved('@ws/alpha/sub'),
      resolved('@ws/alpha/extra'),
      resolved('@ws/alpha/nothing'),
      resolved('/sub'),
      resolved('/nothing'),
    ]).toEqual([`package ${ALPHA}`, `entry ${ALPHA}sub/`, `entry ${ALPHA}extra/`, 'unknown', `entry ${ALPHA}sub/`, 'exempt'])
  })

  it('resolves symbols at their deepest entry, or the package page when several are deepest, a lower-case name within its own entry', () => {
    expect([resolved('Widget'), resolved('sharedName'), resolved('both', SUB), resolved('Options'), resolved('both')]).toEqual([
      `symbol ${ALPHA}#api-Widget`,
      `symbol ${ALPHA}deep/inner/#api-sharedName`,
      `symbol ${ALPHA}sub/#api-both`,
      `symbol ${ALPHA}sub/#api-Options`,
      `symbol ${ALPHA}#api-both`,
    ])
  })

  it('resolves members through a named variable or their parent', () => {
    expect([resolved('widget.size'), resolved('run'), resolved('mode'), resolved('size')]).toEqual([
      `member ${ALPHA}#api-Widget-prop-size via Widget`,
      `member ${ALPHA}#api-Widget-method-run via Widget`,
      `member ${ALPHA}#api-config via config`,
      `member ${ALPHA}#api-Widget-prop-size via Widget`,
    ])
  })

  it('holds a lone lower-case member to the entry beside the document', () => {
    expect([resolved('level', SUB), resolved('size', SUB)]).toEqual([
      `member ${ALPHA}sub/#api-Options-prop-level via Options`,
      `elsewhere Widget (@ws/alpha): ${ALPHA}#api-Widget`,
    ])
  })

  it('reports a member several parents declare as ambiguous', () => {
    expect(resolved('width')).toBe(`ambiguous Shape: ${ALPHA}#api-Shape | Other: ${ALPHA}#api-Other`)
  })

  it('resolves a bundle global to its entry', () => {
    expect([resolved('AlphaSub'), resolved('AlphaUmd')]).toEqual([`global ${ALPHA}sub/`, `global ${ALPHA}`])
  })

  it('lists where a name is documented elsewhere', () => {
    expect([resolved('betaOnly'), resolved('thing', SUB), resolved('betaKey'), resolved('Widget', join(root, 'README.md'))]).toEqual([
      'elsewhere @ws/beta-utils: https://site/docs/libraries/utils/beta/#api-betaOnly',
      `elsewhere @ws/alpha: ${ALPHA}#api-thing`,
      'elsewhere BetaOpts (@ws/beta-utils): https://site/docs/libraries/utils/beta/#api-BetaOpts',
      `elsewhere @ws/alpha: ${ALPHA}#api-Widget`,
    ])
  })

  it('resolves a declaration to its file in the repository', () => {
    expect([resolved('onlyHere'), resolved('twice'), resolved('onlyHere', README, '')]).toEqual([
      'declaration https://github.com/org/repo/blob/main/libs/alpha/src/local.ts',
      'ambiguous https://github.com/org/repo/blob/main/libs/alpha/src/local.ts | https://github.com/org/repo/blob/main/libs/alpha/src/other.ts',
      'unknown',
    ])
  })

  it('groups the hits of another package on one candidate', () => {
    expect(resolved('both', join(root, 'libs/utils/beta/README.md'))).toBe(`elsewhere @ws/alpha: ${ALPHA}#api-both`)
  })

  it('leaves a member of a named variable found nowhere unknown', () => {
    expect(resolved('widget.nothing')).toBe('unknown')
  })

  it('leaves a name found nowhere unknown', () => {
    expect([resolved('nothingAtAll'), resolved('nothingAtAll', join(root, 'README.md'))]).toEqual(['unknown', 'unknown'])
  })
})

describe('the disposable workspace', () => {
  it('is removed at the end', () => {
    rmSync(root, { recursive: true, force: true })
    expect(existsSync(root)).toBe(false)
  })
})
