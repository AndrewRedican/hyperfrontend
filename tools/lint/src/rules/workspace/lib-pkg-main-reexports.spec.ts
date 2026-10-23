import type { InvalidCase, RuleCase } from '@hyperfrontend/linter/testing'
import type { MainReexportsOptions } from './lib-pkg-main-reexports.ts'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { testRule } from '@hyperfrontend/linter/testing'
import { describe, expect, it } from '@hyperfrontend/testing'
import rule from './lib-pkg-main-reexports.ts'

// why: the rule reads each library's manifest, so every case lints a library of its own in a disposable workspace.
const ROOT = mkdtempSync(join(tmpdir(), 'lint-reexports-'))
let count = 0

/**
 * A library in the workspace.
 *
 * @param exports - The manifest's exports, or undefined for none
 * @param publishable - Whether the project file makes it publishable
 * @param manifest - Whether it has a manifest
 * @returns The library's root
 */
function library(exports: unknown, publishable = true, manifest = true): string {
  count += 1
  const root = join(ROOT, `lib${count}`)
  mkdirSync(root, { recursive: true })
  writeFileSync(
    join(root, 'project.json'),
    JSON.stringify({ projectType: 'library', targets: publishable ? { build: {}, publish: {} } : { build: {} } })
  )
  if (manifest) writeFileSync(join(root, 'package.json'), JSON.stringify(exports === undefined ? { name: 'x' } : { name: 'x', exports }))
  return root
}

/** A barrel library's exports. */
const BARREL = {
  '.': './src/index.js',
  './package.json': './package.json',
  './actions': './src/actions/index.js',
  './events': { import: './src/events/index.js' },
}

/**
 * A case linting a library's file.
 *
 * @param name - What the case shows
 * @param root - The library's root
 * @param file - The file below the root
 * @param text - The file's text
 * @param options - The rule's options
 * @returns The case
 */
function lint(name: string, root: string, file: string, text: string, options?: MainReexportsOptions): RuleCase {
  return { name, path: join(root, file), root, text, ...(options === undefined ? {} : { options }) }
}

/**
 * A case expecting missing re-exports.
 *
 * @param name - What the case shows
 * @param root - The library's root
 * @param text - The main entry's one-line text
 * @param missing - The directories reported
 * @param options - The rule's options
 * @returns The case
 */
function missing(name: string, root: string, text: string, missing: readonly string[], options?: MainReexportsOptions): InvalidCase {
  return {
    ...lint(name, root, 'src/index.ts', text, options),
    errors: missing.map((directory) => ({
      message: `Main entry point is missing re-export for '${directory}'. Add 'export * from './${directory}'' to re-export all secondary entry point APIs.`,
      line: 1,
      column: 1,
      endLine: 1,
      endColumn: text.length + 1,
    })),
  }
}

const barrel = library(BARREL)

testRule(rule, {
  valid: [
    lint(
      'a main entry re-exporting every secondary entry',
      barrel,
      'src/index.ts',
      "export * from './actions'\nexport { a } from './events/deep'"
    ),
    lint('a secondary entry', barrel, 'src/actions/index.ts', "export * from './create'"),
    lint('another topology', barrel, 'src/index.ts', 'export const v = 1', { topology: 'fragmented' }),
    lint('an excluded entry', barrel, 'src/index.ts', "export * from './actions'", { exclude: ['./events'] }),
    lint('a library that is not publishable', library(BARREL, false), 'src/index.ts', 'export const v = 1'),
    lint('a library without a manifest', library(BARREL, true, false), 'src/index.ts', 'export const v = 1'),
    lint('a manifest without exports', library(undefined), 'src/index.ts', 'export const v = 1'),
    lint('exports without a main entry', library({ './a': './src/a/index.js' }), 'src/index.ts', 'export const v = 1'),
    lint(
      'a main entry naming no file',
      library({ '.': { types: './src/index.d.ts' }, './a': './a.js' }),
      'src/index.ts',
      'export const v = 1'
    ),
    lint(
      'a main entry of exports alone',
      library({ '.': './src/index.js', './package.json': './package.json' }),
      'src/index.ts',
      'export const v = 1'
    ),
    lint('a file outside any project', ROOT, 'loose/index.ts', 'export const v = 1'),
    lint(
      'a main entry read through require',
      library({ '.': { require: './src/index.cjs' }, './a': './a.js' }),
      'src/index.ts',
      "export * from './a'"
    ),
    lint(
      'a main entry read through default',
      library({ '.': { default: './src/index.js' }, './a': './a.js' }),
      'src/index.ts',
      "export * from './a'"
    ),
    lint('a main entry set to null', library({ '.': null, './a': './a.js' }), 'src/index.ts', 'export const v = 1'),
  ],
  invalid: [
    missing('a missing re-export', barrel, "export * from './actions'", ['events']),
    missing('every re-export missing, external re-exports ignored', barrel, "export * from 'lodash'", ['actions', 'events']),
    missing('a re-export named without a source', barrel, 'const a = 1\nexport { a }', ['actions', 'events']),
    missing(
      'a bare-key export, neither a package re-export nor a root re-export counting',
      library({ '.': './src/index.mjs', extra: './x.js' }),
      "export * from 'extra'\nexport * from './'",
      ['extra']
    ),
  ].map((item, index) =>
    index >= 2 ? { ...item, errors: item.errors.map((error) => ({ ...error, endLine: 2, endColumn: index === 2 ? 13 : 19 })) } : item
  ),
})

describe('the disposable workspace', () => {
  it('is removed at the end', () => {
    rmSync(ROOT, { recursive: true, force: true })
    expect(existsSync(ROOT)).toBe(false)
  })
})
