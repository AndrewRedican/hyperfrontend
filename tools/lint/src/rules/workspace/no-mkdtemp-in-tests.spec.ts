import { testRule } from '@hyperfrontend/linter/testing'
import rule from './no-mkdtemp-in-tests.ts'

const message = (name: string): string =>
  `Create a test's temporary directory with createTempDir or useTempDir from '@hyperfrontend/testing/fs' rather than '${name}': they resolve its real path and remove it for you.`

/**
 * The single-line error a case's text gives at the first occurrence of a span.
 *
 * @param text - The case's text
 * @param span - The reported text
 * @param name - The function the message names
 * @returns The expected error
 */
const at = (
  text: string,
  span: string,
  name: string
): { message: string; line: number; column: number; endLine: number; endColumn: number } => {
  const column = text.indexOf(span) + 1
  return { message: message(name), line: 1, column, endLine: 1, endColumn: column + span.length }
}

const NAMED = "import { existsSync, mkdtempSync } from 'node:fs'"
const RENAMED = "import { mkdtemp as makeTemp } from 'node:fs/promises'"
const QUOTED = "import { 'mkdtempSync' as makeTemp } from 'fs'"
const NAMESPACE = "import * as fs from 'node:fs'; fs.mkdtempSync('/tmp/x-')"
const DEFAULT = "import fsp from 'fs/promises'; await fsp['mkdtemp']('/tmp/x-')"

testRule(rule, {
  valid: [
    {
      name: 'the testing helpers',
      path: '/root/a.spec.ts',
      text: "import { createTempDir } from '@hyperfrontend/testing/fs'; const dir = createTempDir({ prefix: 'x-' })",
    },
    {
      name: 'other names from an fs module',
      path: '/root/a.spec.ts',
      text: "import { mkdirSync, rmSync } from 'node:fs'",
    },
    {
      name: 'a namespace import used for anything but mkdtemp, such as a spy',
      path: '/root/a.spec.ts',
      text: "import * as fs from 'node:fs'; jest.spyOn(fs, 'readFileSync'); fs.existsSync('a')",
    },
    {
      name: 'a bracketed member whose key is not a string literal',
      path: '/root/a.spec.ts',
      text: "import * as fs from 'node:fs'; const key = 'mkdtempSync'; fs[key]('/tmp/x-')",
    },
    {
      name: 'mkdtemp from a module that is not an fs module',
      path: '/root/a.spec.ts',
      text: "import { mkdtempSync } from './fake-fs.ts'; import * as other from 'memfs'; other.mkdtempSync('/x-')",
    },
    {
      name: 'a mkdtemp member on an object no fs import bound, and a mocked node:fs',
      path: '/root/a.spec.ts',
      text: "const vol = { mkdtempSync: () => '/x' }; vol.mkdtempSync(); jest.mock('node:fs', () => ({ mkdtempSync: jest.fn() }))",
    },
    {
      name: 'a mkdtemp member read off a call rather than an identifier',
      path: '/root/a.spec.ts',
      text: "import * as fs from 'node:fs'; load(fs).mkdtempSync('/x-')",
    },
  ],
  invalid: [
    { name: 'a named mkdtempSync import', path: '/root/a.spec.ts', text: NAMED, errors: [at(NAMED, 'mkdtempSync', 'mkdtempSync')] },
    {
      name: 'a renamed mkdtemp import from the promises module',
      path: '/root/a.spec.ts',
      text: RENAMED,
      errors: [at(RENAMED, 'mkdtemp as makeTemp', 'mkdtemp')],
    },
    {
      name: 'an import named by a string literal',
      path: '/root/a.spec.ts',
      text: QUOTED,
      errors: [at(QUOTED, "'mkdtempSync' as makeTemp", 'mkdtempSync')],
    },
    {
      name: 'mkdtempSync read off a namespace import',
      path: '/root/a.spec.ts',
      text: NAMESPACE,
      errors: [at(NAMESPACE, 'fs.mkdtempSync', 'mkdtempSync')],
    },
    {
      name: 'a bracketed mkdtemp read off a default import',
      path: '/root/a.spec.ts',
      text: DEFAULT,
      errors: [at(DEFAULT, "fsp['mkdtemp']", 'mkdtemp')],
    },
  ],
})
