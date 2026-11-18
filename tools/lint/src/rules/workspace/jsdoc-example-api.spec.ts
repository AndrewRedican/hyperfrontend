import type { ExpectedError } from '@hyperfrontend/linter/testing'
import { existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { testRule } from '@hyperfrontend/linter/testing'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createDocsWorkspace } from './__test-utils__/docs-workspace.ts'
import rule from './jsdoc-example-api.ts'

const root = createDocsWorkspace()
const SOURCE = join(root, 'libs/alpha/src/widget.ts')

const ADVICE = 'Update the example to the API as it is now.'

/**
 * The error on the first occurrence of a name after a marker in a file.
 *
 * @param text - The file
 * @param needle - The reported text
 * @param message - What the rule must report
 * @param after - Text the occurrence follows, when an earlier one is not meant
 * @returns The error, spanning the needle
 */
function on(text: string, needle: string, message: string, after = ''): ExpectedError {
  const offset = text.indexOf(needle, text.indexOf(after) + after.length)
  const before = text.slice(0, offset).split(/\r?\n/)
  const column = (before[before.length - 1] as string).length + 1
  return { message, line: before.length, column, endLine: before.length, endColumn: column + needle.length }
}

/**
 * The message for a name an entry point does not export.
 *
 * @param name - The name taken
 * @param specifier - The entry point as the example names it
 * @param elsewhere - The entry points that do export it, as the message lists them
 * @returns The message
 */
function missing(name: string, specifier: string, elsewhere = ''): string {
  const hint = elsewhere === '' ? '' : ` It is exported by ${elsewhere}.`
  return `Example takes \`${name}\` from \`${specifier}\`, which exports no \`${name}\`.${hint} ${ADVICE}`
}

const CURRENT = [
  "// import { gone } from '@ws/alpha'",
  "//* import { gone } from '@ws/alpha'",
  "/* import { gone } from '@ws/alpha' */",
  '/**',
  ' * Builds a widget.',
  ' *',
  ' * ```bash',
  ' * gone --from @ws/alpha',
  ' * ```',
  ' *',
  ' * @param size - How large',
  ' * The size is in pixels, as `gone` never was.',
  ' * @example Building one',
  ' * A widget of the default size:',
  ' * ```typescript',
  " * import { createWidget, thing } from '@ws/alpha'",
  " * import { subOnly } from '@ws/alpha/sub'",
  ' *',
  ' * const widget = createWidget()',
  ' * anythingTheReaderHas(widget, subOnly(thing))',
  ' * ```',
  ' * and nothing after the fence is code: gone().',
  ' * @example',
  " * const { both } = require('@ws/alpha/dir')",
  ' * @returns The widget',
  ' * @example',
  ' * AlphaGlobal.thing',
  ' */',
  'export function createWidget() {}',
  '',
].join('\n')

const STALE = [
  '/**',
  ' * Builds a widget.',
  ' *',
  ' * @example Building one',
  ' * ```typescript',
  " * import { createWidget, gone } from '@ws/alpha'",
  " * import { thing } from '@ws/alpha/sub'",
  ' * ```',
  ' * @example With no language named',
  ' *   ```',
  " *   import { vanished } from '@ws/alpha/nope'",
  ' *   const = ...',
  ' *   ```',
  ' * @example',
  " * const { dropped } = require('@ws/alpha')",
  ' * @returns The widget',
  ' * @example',
  ' * Prose before a fence is not code, whatever it names: AlphaSub.absent()',
  ' * ```ts',
  " * import { neverClosed } from '@ws/alpha'",
  ' */',
  'export function createWidget() {}',
  '',
].join('\r\n')

testRule(rule, {
  valid: [
    { name: 'a file outside any workspace', path: join(tmpdir(), 'lint-example-outside.ts'), root: tmpdir(), text: STALE },
    { name: 'examples that take what the entry points export', path: SOURCE, root, text: CURRENT },
  ],
  invalid: [
    {
      name: 'names and entry points a package no longer has, fenced and not',
      path: SOURCE,
      root,
      text: STALE,
      errors: [
        on(STALE, 'gone', missing('gone', '@ws/alpha')),
        on(STALE, 'thing', missing('thing', '@ws/alpha/sub', '`@ws/alpha`')),
        on(STALE, "'@ws/alpha/nope'", `Example imports from \`@ws/alpha/nope\`, but @ws/alpha has no entry point \`./nope\`. ${ADVICE}`),
        on(STALE, 'dropped', missing('dropped', '@ws/alpha')),
      ],
    },
  ],
})

describe('the disposable workspace', () => {
  it('is removed at the end', () => {
    rmSync(root, { recursive: true, force: true })
    expect(existsSync(root)).toBe(false)
  })
})
