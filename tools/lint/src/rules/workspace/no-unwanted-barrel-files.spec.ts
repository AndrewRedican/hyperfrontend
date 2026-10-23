import type { InvalidCase, RuleCase } from '@hyperfrontend/linter/testing'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { testRule } from '@hyperfrontend/linter/testing'
import { describe, expect, it } from '@hyperfrontend/testing'
import rule from './no-unwanted-barrel-files.ts'

// why: the rule reads each library's project file and manifest, so the cases lint libraries of a disposable workspace.
const ROOT = mkdtempSync(join(tmpdir(), 'lint-barrels-'))

/**
 * A library in the workspace.
 *
 * @param name - Its directory
 * @param manifest - Its manifest, or null for none
 * @param publishable - Whether the project file makes it publishable
 * @returns The library's root
 */
function library(name: string, manifest: unknown, publishable = true): string {
  const root = join(ROOT, name)
  mkdirSync(root, { recursive: true })
  writeFileSync(
    join(root, 'project.json'),
    JSON.stringify({ projectType: 'library', targets: publishable ? { build: {}, publish: {} } : { build: {} } })
  )
  if (manifest !== null) writeFileSync(join(root, 'package.json'), JSON.stringify(manifest))
  return root
}

const PLAIN = library('plain', { name: 'plain' })
const SPLIT = library('split', {
  name: 'split',
  exports: {
    './browser': './src/browser/index.js',
    './node': { import: './src/node/index.js' },
    './default': { default: './src/default/index.mjs' },
    './special': { require: './src/special/index.cjs' },
    './types': { types: './src/types.d.ts' },
    './empty': null,
  },
})
const EMPTY = library('empty', { name: 'empty', exports: {} })
const INTERNAL = library('internal', { name: 'internal' }, false)
const BARE = library('bare', null)

/**
 * A case linting a file.
 *
 * @param name - What the case shows
 * @param root - The library's root
 * @param file - The file below the root
 * @returns The case
 */
function lint(name: string, root: string, file: string): RuleCase {
  return { name, path: join(root, file), root, text: 'export {}' }
}

/**
 * A case expecting the barrel reported.
 *
 * @param name - What the case shows
 * @param root - The library's root
 * @param file - The file below the root
 * @param allowed - What the message says is allowed
 * @returns The case
 */
function unwanted(name: string, root: string, file: string, allowed: string): InvalidCase {
  return {
    ...lint(name, root, file),
    errors: [
      {
        message: `Unexpected barrel file: "${file}".\nThis library only allows index.ts files for declared entry points.\n\n${allowed}\n\nTo fix: Either delete this barrel file (and update imports to reference implementation files directly), or add a corresponding export to package.json.`,
        line: 1,
        column: 1,
        endLine: 1,
        endColumn: 10,
      },
    ],
  }
}

const NO_EXPORTS = 'This library has no "exports" field in package.json, so only the main entry point (src/index.ts) is allowed.'

testRule(rule, {
  valid: [
    lint('a file that is not a barrel', PLAIN, 'src/utils.ts'),
    lint('the main entry', PLAIN, 'src/index.ts'),
    lint('an exported entry', SPLIT, 'src/browser/index.ts'),
    lint('an entry exported through import', SPLIT, 'src/node/index.ts'),
    lint('an entry exported through default', SPLIT, 'src/default/index.ts'),
    lint('an entry exported through require', SPLIT, 'src/special/index.ts'),
    lint('a barrel of a library that is not publishable', INTERNAL, 'src/lib/index.ts'),
    lint('a barrel of a library without a manifest', BARE, 'src/lib/index.ts'),
    lint('a barrel outside any project', ROOT, 'loose/index.ts'),
  ],
  invalid: [
    unwanted('a barrel of a library without exports', PLAIN, 'src/lib/creators/index.ts', NO_EXPORTS),
    unwanted('a barrel of a library with empty exports', EMPTY, 'src/lib/index.ts', NO_EXPORTS),
    unwanted(
      'a barrel no export maps to',
      SPLIT,
      'src/lib/utils/index.ts',
      'Allowed entry points based on package.json exports:\n  "./browser" → ./src/browser/index.ts\n  "./node" → ./src/node/index.ts\n  "./default" → ./src/default/index.mjs\n  "./special" → ./src/special/index.cjs\n  "./types" → [object Object]\n  "./empty" → null'
    ),
  ],
})

describe('the disposable workspace', () => {
  it('is removed at the end', () => {
    rmSync(ROOT, { recursive: true, force: true })
    expect(existsSync(ROOT)).toBe(false)
  })
})
