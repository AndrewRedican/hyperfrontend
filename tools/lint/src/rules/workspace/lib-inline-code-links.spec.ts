import type { ExpectedError } from '@hyperfrontend/linter/testing'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { testRule } from '@hyperfrontend/linter/testing'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createDocsWorkspace } from './__test-utils__/docs-workspace.ts'
import rule from './lib-inline-code-links.ts'

const root = createDocsWorkspace()
// why: a workspace whose manifest names no repository links nothing into one.
const BARE = mkdtempSync(join(tmpdir(), 'lint-docs-bare-'))
for (const [path, text] of Object.entries({
  'nx.json': '{}',
  'libs/x/project.json': '{"projectType":"library","targets":{"build":{},"publish":{}}}',
  'libs/x/package.json': '{"name":"@ws/x"}',
})) {
  mkdirSync(dirname(join(BARE, path)), { recursive: true })
  writeFileSync(join(BARE, path), text)
}
const README = join(root, 'libs/alpha/README.md')
const ALPHA = 'https://www.hyperfrontend.dev/docs/libraries/alpha/'
const REPO = 'https://github.com/org/repo/blob/main/libs/alpha/src'
const PROSE = 'or, if `{{code}}` is not a navigable code or API concept here, write it as plain prose instead.'

const TEXT = [
  '# Title `Widget`',
  '',
  `Use \`Widget\`, \`null\`, \`Widget.run\`, \`twice\`, \`betaOnly\`, \`nothingAtAll\`, [\`Widget\`](${ALPHA}#api-Widget) and [\`Widget\`](#missing).`,
  '',
].join('\n')

/**
 * An error on an inline code span of the third line.
 *
 * @param code - The span's text, which must occur once after the given offset
 * @param message - What the rule must report
 * @param after - Where the search for the span starts
 * @returns The error
 */
function onSpan(code: string, message: string, after = 0): ExpectedError {
  const line = TEXT.split(/\r?\n/)[2] as string
  const column = line.indexOf(`\`${code}\``, after) + 1
  return { message, line: 3, column, endLine: 3, endColumn: column + code.length + 2 }
}

const own = (code: string): string => PROSE.replace('{{code}}', code)

testRule(rule, {
  valid: [
    { name: 'a changelog', path: join(root, 'libs/alpha/CHANGELOG.md'), root, text: 'Use `Widget`.' },
    { name: 'a file outside any workspace', path: join(tmpdir(), 'lint-docs-outside.md'), root: tmpdir(), text: 'Use `Widget`.' },
    { name: 'a document outside every package', path: join(root, 'NOTES.md'), root, text: 'Use `Widget`.' },
    { name: 'a package of a workspace naming no repository', path: join(BARE, 'libs/x/README.md'), root: BARE, text: 'Use `null`.' },
  ],
  invalid: [
    {
      name: 'mentions to link, to settle and to fix',
      path: README,
      root,
      text: TEXT,
      errors: [
        onSpan(
          'Widget',
          `Inline code \`Widget\` must link to its documentation: the symbol is documented at ${ALPHA}#api-Widget. Link it there, ${own('Widget')}`
        ),
        onSpan(
          'Widget.run',
          `Inline code \`Widget.run\` must link to its documentation: the symbol is documented at ${ALPHA}#api-Widget. Link it there, ${own('Widget.run')}`
        ),
        onSpan(
          'twice',
          `Inline code \`twice\` must link to its documentation, and it is documented in more than one place:\n    ${REPO}/local.ts\n    ${REPO}/other.ts\n  Link the one this sentence means, ${own('twice')}`
        ),
        onSpan(
          'betaOnly',
          `Inline code \`betaOnly\` must link to its documentation. This package does not export it, but it is documented elsewhere:\n    @ws/beta-utils: https://www.hyperfrontend.dev/docs/libraries/utils/beta/#api-betaOnly\n  Link the one this sentence means, ${own('betaOnly')}`
        ),
        onSpan(
          'nothingAtAll',
          'Inline code `nothingAtAll` must link to its documentation, and no package, entry point, exported symbol, member or declaration by that name was found. Link it to the API reference, entry page, guide or concept page that explains it, or, if `nothingAtAll` is not a navigable code or API concept, write it as plain prose instead.'
        ),
        onSpan(
          'Widget',
          "Inline code `Widget` links to #missing, which does not resolve: this document has no heading with the anchor 'missing'.",
          (TEXT.split(/\r?\n/)[2] as string).indexOf('(#missing)') - 10
        ),
      ],
      output: TEXT.replace('Use `Widget`,', `Use [\`Widget\`](${ALPHA}#api-Widget),`).replace(
        '`Widget.run`',
        `[\`Widget.run\`](${ALPHA}#api-Widget)`
      ),
    },
    {
      name: 'a member resolved through its parent',
      path: README,
      root,
      text: 'Call `run` now.',
      errors: [
        {
          message: `Inline code \`run\` must link to its documentation: its parent, Widget, is documented at ${ALPHA}#api-Widget-method-run. Link it there, ${own('run')}`,
          line: 1,
          column: 6,
          endLine: 1,
          endColumn: 11,
        },
      ],
      output: `Call [\`run\`](${ALPHA}#api-Widget-method-run) now.`,
    },
  ],
})

describe('the disposable workspace', () => {
  it('is removed at the end', () => {
    rmSync(root, { recursive: true, force: true })
    rmSync(BARE, { recursive: true, force: true })
    expect(existsSync(root) || existsSync(BARE)).toBe(false)
  })
})
