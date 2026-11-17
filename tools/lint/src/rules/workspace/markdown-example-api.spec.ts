import type { ExpectedError } from '@hyperfrontend/linter/testing'
import { existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { testRule } from '@hyperfrontend/linter/testing'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createDocsWorkspace } from './__test-utils__/docs-workspace.ts'
import rule from './markdown-example-api.ts'

const root = createDocsWorkspace()
const README = join(root, 'libs/alpha/README.md')
const NOTES = join(root, 'NOTES.md')

const ADVICE = 'Update the example to the API as it is now.'

/**
 * Wraps code in a fence.
 *
 * @param lines - The example's lines
 * @param language - The fence's language
 * @returns The fenced block, with a heading before it
 */
function fenced(lines: readonly string[], language = 'typescript'): string {
  return ['# Title', '', `\`\`\`${language}`, ...lines, '```', ''].join('\n')
}

/**
 * The error on the first occurrence of a name after a marker in a document.
 *
 * @param text - The document
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

/**
 * The message for a call nothing provides.
 *
 * @param name - The function called
 * @returns The message
 */
function unprovided(name: string): string {
  return `Example calls \`${name}\`, which nothing provides: the example neither declares nor imports it, and no workspace package exports or declares it. Import it from where it lives now, declare it in the example, or mark a counter-example with ❌.`
}

const USES = fenced([
  "import main, { thing, default as again, 'quotedName' as quoted } from '@ws/alpha'",
  "import * as alpha from '@ws/alpha'",
  "import type { Options } from '@ws/alpha/sub'",
  "import manifest from '@ws/alpha/package.json'",
  "import { useState } from 'react'",
  "import { other } from '@elsewhere/pkg/deep'",
  "export { plain as renamed } from '@ws/alpha'",
  "export * from '@ws/alpha/sub'",
  'export const local = 1',
  "const { subOnly, both: second, [key]: computed, 0: first, ...rest } = require('@ws/alpha/sub')",
  "const whole = require('@ws/alpha')",
  "const { fromDir } = await import('@ws/alpha/dir')",
  "const [head] = require('@ws/alpha')",
  'const dynamic = require(name)',
  'const none = require()',
  'const made = factory.create()',
  'let later',
  'let shape: alpha.Shape = alpha.config',
  "whole.thing + alpha['absent'] + deep.inner.value + unknownSpace.member",
])

const CALLS = fenced([
  "import { thing } from '@ws/alpha'",
  'function declared({ a, b: [c, , d = 1], ...others }, ...more) {}',
  'const arrow = (value) => handle(value)',
  'class Service {',
  '  constructor(private store) {}',
  '  run() {',
  '    return missingInMethod()',
  '  }',
  '}',
  'try {',
  '  declared(arrow(1))',
  '} catch (failure) {',
  '  failure()',
  '}',
  'parseInt(value)',
  'fetch(url)',
  'new Map()',
  'betaOnly()',
  'onlyHere()',
  'object.method()',
  'declared()()',
  'new Service(store)',
  '// ❌ what not to write',
  'removedLongAgo()',
  'alsoRemoved()',
])

const OUTSIDE = fenced(["import { thing } from '@ws/alpha'", 'nothingProvidesThis()'])

const SKIPPED = [
  '# Title',
  '',
  '```bash',
  'gone --from @ws/alpha',
  '```',
  '',
  '```',
  "import { gone } from '@ws/alpha'",
  '```',
  '',
  '```ts',
  "import { gone } from '@ws/alpha'",
  'const = ...',
  '```',
  '',
].join('\n')

const STALE = fenced([
  "import { gone, subOnly, both } from '@ws/alpha'",
  "import { thing as renamed } from '@ws/alpha/sub'",
  "import * as alpha from '@ws/alpha'",
  "import { anything } from '@ws/alpha/nope'",
  "export { vanished } from '@ws/alpha'",
  "const { dropped } = require('@ws/alpha/sub')",
  "const whole = require('@ws/alpha')",
  "const { late } = await import('@ws/alpha/dir')",
  "import('@ws/alpha/also-nope')",
  'let shape: alpha.Absent = alpha.removed',
  'whole.erased',
])

const DRIFT = [
  '# Title',
  '',
  '- In a list:',
  '',
  '  ```TS',
  '  const context = createContext({ root })',
  '  const client = new RemovedClient()',
  '  // ❌',
  '  wrongWay()',
  '  // ✅',
  '  rightWay()',
  '  ```',
  '',
].join('\n')

testRule(rule, {
  valid: [
    { name: 'a changelog', path: join(root, 'libs/alpha/CHANGELOG.md'), root, text: STALE },
    { name: 'a file outside any workspace', path: join(tmpdir(), 'lint-example-outside.md'), root: tmpdir(), text: STALE },
    { name: 'every way of taking what an entry point exports', path: README, root, text: USES },
    { name: 'calls the example, the platform or the workspace provides', path: README, root, text: CALLS },
    { name: 'an unprovided call in a document outside every package', path: NOTES, root, text: OUTSIDE },
    { name: 'a shell block, a block naming no language and a block that does not parse', path: README, root, text: SKIPPED },
  ],
  invalid: [
    {
      name: 'names and entry points a package no longer has',
      path: NOTES,
      root,
      text: STALE,
      errors: [
        on(STALE, 'gone', missing('gone', '@ws/alpha')),
        on(STALE, 'subOnly', missing('subOnly', '@ws/alpha', '`@ws/alpha/sub`')),
        on(STALE, 'both', missing('both', '@ws/alpha', '`@ws/alpha/sub`, `@ws/alpha/dir`')),
        on(STALE, 'thing', missing('thing', '@ws/alpha/sub', '`@ws/alpha`')),
        on(STALE, "'@ws/alpha/nope'", `Example imports from \`@ws/alpha/nope\`, but @ws/alpha has no entry point \`./nope\`. ${ADVICE}`),
        on(STALE, 'vanished', missing('vanished', '@ws/alpha')),
        on(STALE, 'dropped', missing('dropped', '@ws/alpha/sub')),
        on(STALE, 'late', missing('late', '@ws/alpha/dir')),
        on(
          STALE,
          "'@ws/alpha/also-nope'",
          `Example imports from \`@ws/alpha/also-nope\`, but @ws/alpha has no entry point \`./also-nope\`. ${ADVICE}`
        ),
        on(STALE, 'Absent', missing('Absent', '@ws/alpha')),
        on(STALE, 'removed', missing('removed', '@ws/alpha')),
        on(STALE, 'erased', missing('erased', '@ws/alpha')),
      ],
    },
    {
      name: 'top-level calls nothing provides, in an indented fence',
      path: README,
      root,
      text: DRIFT,
      errors: [
        on(DRIFT, 'createContext', unprovided('createContext')),
        on(DRIFT, 'RemovedClient', unprovided('RemovedClient')),
        on(DRIFT, 'rightWay', unprovided('rightWay')),
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
