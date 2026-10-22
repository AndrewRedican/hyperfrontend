import type { InvalidCase, RuleCase } from '../../testing/rule-tester.ts'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { testRule } from '../../testing/rule-tester.ts'
import rule from './deepest-import-path.ts'

// why: the rule reads the base configuration and the entry sources, so the fixture is a disposable workspace holding every entry the recorded cases import from.
const ROOT = mkdtempSync(join(tmpdir(), 'lint-deepest-'))
const EMPTY = mkdtempSync(join(tmpdir(), 'lint-deepest-empty-'))
const ORPHAN = mkdtempSync(join(tmpdir(), 'lint-deepest-orphan-'))
const write = (root: string, path: string, text: string): void => {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), text)
}

const PATHS: Record<string, unknown> = {
  '@hyperfrontend/project-scope': ['libs/project-scope/src/index.ts'],
  '@hyperfrontend/project-scope/cli': ['libs/project-scope/src/cli/index.ts'],
  '@hyperfrontend/project-scope/config': ['libs/project-scope/src/config/index.ts'],
  '@hyperfrontend/project-scope/core': ['libs/project-scope/src/core/index.ts'],
  '@hyperfrontend/project-scope/core/deep': ['libs/project-scope/src/core/deep/index.ts'],
  '@hyperfrontend/project-scope/constants': ['libs/project-scope/src/constants/index.ts'],
  '@hyperfrontend/project-scope/classes': ['libs/project-scope/src/classes/index.ts'],
  '@hyperfrontend/project-scope/types': ['libs/project-scope/src/types/index.ts'],
  '@hyperfrontend/project-scope/interfaces': ['libs/project-scope/src/interfaces/index.ts'],
  '@hyperfrontend/project-scope/enums': ['libs/project-scope/src/enums/index.ts'],
  '@hyperfrontend/project-scope/utils': ['libs/project-scope/src/utils/index.ts'],
  '@hyperfrontend/project-scope/empty': [],
  '@hyperfrontend/project-scope/odd': 'libs/project-scope/src/odd/index.ts',
  '@hyperfrontend/project-scope/number': [1],
  '@hyperfrontend/package': ['libs/package/src/index.ts'],
  '@hyperfrontend/package/utils': ['libs/package/src/utils/index.ts'],
  '@hyperfrontend/package/types': ['libs/package/src/types/index.ts'],
  '@hyperfrontend/package/helpers': ['libs/package/src/helpers/index.ts'],
  '@hyperfrontend/package/vars': ['libs/package/src/vars/index.ts'],
  '@hyperfrontend/package/a': ['libs/package/src/a/index.ts'],
  '@hyperfrontend/package/b': ['libs/package/src/b/index.ts'],
  '@hyperfrontend/package/core': ['libs/package/src/core/index.ts'],
  '@hyperfrontend/package/core/deep': ['libs/package/src/core/deep/index.ts'],
  '@hyperfrontend/package/mixed': ['libs/package/src/mixed/index.ts'],
  '@hyperfrontend/package/combined': ['libs/package/src/combined/index.ts'],
  '@hyperfrontend/package/sub': ['libs/package/src/sub/index.ts'],
  '@hyperfrontend/polyfill': ['libs/polyfill/src/index.ts'],
  '@hyperfrontend/missing': ['libs/missing/src/index.ts'],
  '@hyperfrontend/missing/sub': ['libs/missing/src/sub/index.ts'],
  '@myorg/package': ['libs/myorg/src/index.ts'],
  '@myorg/package/sub': ['libs/myorg/src/sub/index.ts'],
  mylib: ['libs/mylib/src/index.ts'],
  'mylib/utils': ['libs/mylib/src/utils/index.ts'],
}
write(ROOT, 'tsconfig.base.json', JSON.stringify({ compilerOptions: { baseUrl: '.', paths: PATHS } }))
write(
  ROOT,
  'libs/project-scope/src/index.ts',
  [
    "export const uniqueSymbol = 'unique'",
    "export * from './cli'",
    "export * from './config'",
    "export * from './core'",
    "export * from './constants'",
    "export * from './classes'",
    "export type * from './types'",
    "export type * from './interfaces'",
    "export * from './enums'",
    "export { aliasedFn } from './utils'",
    'export default {}',
  ].join('\n')
)
write(
  ROOT,
  'libs/project-scope/src/cli/index.ts',
  'export function runCli() {}\nexport function parseArgs() {}\nexport type CliConfig = { verbose: boolean }'
)
write(ROOT, 'libs/project-scope/src/config/index.ts', 'export function parseConfig() {}')
write(ROOT, 'libs/project-scope/src/core/index.ts', "export * from './deep'")
write(ROOT, 'libs/project-scope/src/core/deep/index.ts', 'export function deepFunction() {}')
write(ROOT, 'libs/project-scope/src/constants/index.ts', "export const MY_CONSTANT = 'value'")
write(ROOT, 'libs/project-scope/src/classes/index.ts', 'export class MyClass {}')
write(ROOT, 'libs/project-scope/src/types/index.ts', 'export type MyType = { id: number }')
write(ROOT, 'libs/project-scope/src/interfaces/index.ts', 'export interface MyInterface { id: number }')
write(ROOT, 'libs/project-scope/src/enums/index.ts', 'export enum MyEnum { A, B, C }')
write(
  ROOT,
  'libs/project-scope/src/utils/index.ts',
  "export { internalFn as aliasedFn } from './internal'\nexport function internalFn() {}"
)
write(
  ROOT,
  'libs/package/src/index.ts',
  [
    "export * from './utils'",
    "export type * from './types'",
    "export * from './helpers'",
    "export * from './vars'",
    "export * from './a'",
    "export * from './core'",
    "export * from './mixed'",
    "export * from './combined'",
    "export * from './sub'",
    'export let counter = 0',
  ].join('\n')
)
write(
  ROOT,
  'libs/package/src/utils/index.ts',
  'const _funcA = () => {}\nconst _funcB = () => {}\nexport { _funcA as funcA, _funcB as funcB }\nexport function barrelFn() {}'
)
write(
  ROOT,
  'libs/package/src/types/index.ts',
  'type _TypeA = string\ntype _TypeB = number\nexport type { _TypeA as TypeA, _TypeB as TypeB }'
)
write(ROOT, 'libs/package/src/helpers/index.ts', 'export function myFunction() { return 42 }')
write(ROOT, 'libs/package/src/vars/index.ts', "export var myVar = 'test'")
write(ROOT, 'libs/package/src/a/index.ts', "export * from '../b'\nexport function circularFn() {}")
write(ROOT, 'libs/package/src/b/index.ts', "export * from '../a'")
write(ROOT, 'libs/package/src/core/index.ts', "export * from './deep'")
write(ROOT, 'libs/package/src/core/deep/index.ts', 'export function deepFn() {}')
write(ROOT, 'libs/package/src/mixed/index.ts', "export * from './helpers'\nexport const directExport = 42")
write(ROOT, 'libs/package/src/mixed/helpers.ts', 'export function reExported() {}')
write(ROOT, 'libs/package/src/combined/index.ts', "export * from './a'\nexport * from './b'")
write(ROOT, 'libs/package/src/combined/a.ts', 'export function fromA() {}')
write(ROOT, 'libs/package/src/combined/b.ts', 'export function fromB() {}')
write(ROOT, 'libs/package/src/sub/index.ts', "export * from './impl'")
write(ROOT, 'libs/package/src/sub/impl.ts', 'export function noExtFn() {}')
write(ROOT, 'libs/polyfill/src/index.ts', '// side effects only')
write(ROOT, 'libs/myorg/src/index.ts', "export * from './sub'")
write(ROOT, 'libs/myorg/src/sub/index.ts', "export const foo = 'bar'")
write(ROOT, 'libs/mylib/src/index.ts', "export * from './utils'")
write(ROOT, 'libs/mylib/src/utils/index.ts', 'export function helper() {}')
write(EMPTY, 'tsconfig.base.json', JSON.stringify({ compilerOptions: { paths: {} } }))

const FILE = join(ROOT, 'src', 'test.ts')

/**
 * A case the rule accepts.
 *
 * @param name - The case's name
 * @param text - The import
 * @param options - The rule's options, when not the defaults
 * @param path - The file linted, in the main workspace unless given
 * @returns The case
 */
function allowed(name: string, text: string, options?: unknown, path = FILE): RuleCase {
  return { name, path, text, options }
}

/**
 * A case the rule reports and fixes to a deeper alias.
 *
 * @param name - The case's name
 * @param text - The import, with its source literal ending the line
 * @param current - The alias imported from
 * @param suggested - The alias the rule names
 * @param options - The rule's options, when not the defaults
 * @returns The case with its report over the source literal
 */
function deeper(name: string, text: string, current: string, suggested: string, options?: unknown): InvalidCase {
  const quote = text[text.length - 1] as string
  return {
    name,
    path: FILE,
    text,
    options,
    errors: [
      {
        message: `Import from '${current}' could use a more specific path: '${suggested}'.`,
        line: 1,
        column: text.lastIndexOf(quote, text.length - 2) + 1,
        endLine: 1,
        endColumn: text.length + 1,
      },
    ],
    output: text.replace(`${quote}${current}${quote}`, `${quote}${suggested}${quote}`),
  }
}

const SCOPE = '@hyperfrontend/project-scope'
const PACKAGE = '@hyperfrontend/package'

testRule(rule, {
  valid: [
    allowed('allows external package imports', "import { useState } from 'react'"),
    allowed('allows lodash imports', "import { debounce } from 'lodash'"),
    allowed('allows node built-in imports', "import { readFileSync } from 'node:fs'"),
    allowed('allows relative imports', "import { helper } from './helper'"),
    allowed('allows parent relative imports', "import { config } from '../config'"),
    allowed('allows imports already using subpath', `import { runCli } from '${SCOPE}/cli'`),
    allowed('allows base import when symbol only exists at base level', `import { uniqueSymbol } from '${SCOPE}'`),
    allowed('allows base import when symbols come from different subpaths', `import { runCli, parseConfig } from '${SCOPE}'`),
    allowed('allows default imports', `import ProjectScope from '${SCOPE}'`),
    allowed('allows side effect imports', `import '${SCOPE}'`),
    allowed('allows namespace imports', `import * as ProjectScope from '${SCOPE}'`),
    allowed('works with type-only imports when no deeper path', `import type { Config } from '${SCOPE}'`),
    allowed('handles empty tsconfig paths', `import { foo } from '${SCOPE}'`, undefined, join(EMPTY, 'src', 'test.ts')),
    allowed('ignores imports not matching custom prefix', "import { foo } from '@myorg/package'", { packagePrefix: '@custom/' }),
    allowed(
      'handles missing workspace root gracefully',
      "import { foo } from '@hyperfrontend/package'",
      undefined,
      join(ORPHAN, 'orphan.ts')
    ),
    allowed('handles non-existent source files', "import { foo } from '@hyperfrontend/missing'"),
    allowed('handles export let declarations', `import { counter } from '${PACKAGE}'`),
    allowed('handles various import syntax', "import '@hyperfrontend/polyfill'"),
    allowed('handles circular re-exports without infinite loop', `import { circularFn } from '${PACKAGE}/a'`),
    allowed('a string-named import, which the previous rule never counted', `import { "runCli" as run } from '${SCOPE}'`),
    allowed('an import of a subpath, which already chose its entry', `import { deepFunction } from '${SCOPE}/core'`),
  ],
  invalid: [
    deeper('reports when deeper subpath exports symbol', `import { runCli } from '${SCOPE}'`, SCOPE, `${SCOPE}/cli`),
    deeper('reports when multiple symbols share deeper subpath', `import { runCli, parseArgs } from '${SCOPE}'`, SCOPE, `${SCOPE}/cli`),
    deeper('reports for type-only imports with deeper subpath', `import type { CliConfig } from '${SCOPE}'`, SCOPE, `${SCOPE}/cli`),
    deeper('handles aliased imports correctly', `import { runCli as execute } from '${SCOPE}'`, SCOPE, `${SCOPE}/cli`),
    deeper('handles mixed type and value imports', `import { type CliConfig, runCli } from '${SCOPE}'`, SCOPE, `${SCOPE}/cli`),
    deeper('chooses deepest matching subpath', `import { deepFunction } from '${SCOPE}'`, SCOPE, `${SCOPE}/core/deep`),
    deeper('preserves double quote style', `import { runCli } from "${SCOPE}"`, SCOPE, `${SCOPE}/cli`),
    deeper('respects custom packagePrefix option', "import { foo } from '@myorg/package'", '@myorg/package', '@myorg/package/sub', {
      packagePrefix: '@myorg/',
    }),
    deeper('handles export const declarations', `import { MY_CONSTANT } from '${SCOPE}'`, SCOPE, `${SCOPE}/constants`),
    deeper('handles export class declarations', `import { MyClass } from '${SCOPE}'`, SCOPE, `${SCOPE}/classes`),
    deeper('handles export type declarations', `import type { MyType } from '${SCOPE}'`, SCOPE, `${SCOPE}/types`),
    deeper('handles export interface declarations', `import type { MyInterface } from '${SCOPE}'`, SCOPE, `${SCOPE}/interfaces`),
    deeper('handles export enum declarations', `import { MyEnum } from '${SCOPE}'`, SCOPE, `${SCOPE}/enums`),
    deeper('handles re-exported symbols with aliases', `import { aliasedFn } from '${SCOPE}'`, SCOPE, `${SCOPE}/utils`),
    deeper('parses export list correctly', `import { funcA, funcB } from '${PACKAGE}'`, PACKAGE, `${PACKAGE}/utils`),
    deeper('parses export type list correctly', `import type { TypeA, TypeB } from '${PACKAGE}'`, PACKAGE, `${PACKAGE}/types`),
    deeper('parses export function declaration', `import { myFunction } from '${PACKAGE}'`, PACKAGE, `${PACKAGE}/helpers`),
    deeper('parses export var declaration', `import { myVar } from '${PACKAGE}'`, PACKAGE, `${PACKAGE}/vars`),
    deeper('handles non-scoped package prefix', "import { helper } from 'mylib'", 'mylib', 'mylib/utils', { packagePrefix: 'mylib' }),
    deeper('follows single-level barrel re-export', `import { barrelFn } from '${PACKAGE}'`, PACKAGE, `${PACKAGE}/utils`),
    deeper('follows nested barrel re-exports', `import { deepFn } from '${PACKAGE}'`, PACKAGE, `${PACKAGE}/core/deep`),
    deeper('handles mixed barrel and direct exports', `import { reExported, directExport } from '${PACKAGE}'`, PACKAGE, `${PACKAGE}/mixed`),
    deeper('handles multiple barrel re-exports in same file', `import { fromA, fromB } from '${PACKAGE}'`, PACKAGE, `${PACKAGE}/combined`),
    deeper('resolves barrel re-export without extension', `import { noExtFn } from '${PACKAGE}'`, PACKAGE, `${PACKAGE}/sub`),
    deeper(
      'follows a re-export cycle to the entry declaring the symbol',
      `import { circularFn } from '${PACKAGE}'`,
      PACKAGE,
      `${PACKAGE}/a`
    ),
    deeper('counts the named imports beside a default import', `import ProjectScope, { runCli } from '${SCOPE}'`, SCOPE, `${SCOPE}/cli`),
  ],
})

describe('the disposable workspaces', () => {
  it('are removed once the cases have run', () => {
    for (const root of [ROOT, EMPTY, ORPHAN]) rmSync(root, { recursive: true })
    expect([ROOT, EMPTY, ORPHAN].some(existsSync)).toBe(false)
  })
})
