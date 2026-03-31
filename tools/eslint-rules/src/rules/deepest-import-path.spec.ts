import { join } from 'node:path'
import { createTempWorkspaceManager, createTypeScriptRuleTester } from '../testing'
import rule, { clearCache } from './deepest-import-path'

const manager = createTempWorkspaceManager()

/**
 * Creates a temporary workspace structure for testing.
 *
 * @param config - Configuration for the temporary workspace.
 * @param config.tsconfigBasePaths - Path mappings for tsconfig.base.json.
 * @param config.sourceFiles - Map of file paths to their content.
 * @returns The path to the temporary workspace directory.
 */
function createTempWorkspace(config: { tsconfigBasePaths?: Record<string, string[]>; sourceFiles?: Record<string, string> }): string {
  const files: Record<string, string> = {
    'tsconfig.base.json': JSON.stringify(
      {
        compilerOptions: {
          baseUrl: '.',
          paths: config.tsconfigBasePaths ?? {},
        },
      },
      null,
      2
    ),
  }

  if (config.sourceFiles) {
    for (const [filePath, content] of Object.entries(config.sourceFiles)) {
      files[filePath] = content
    }
  }

  const workspace = manager.create({ files })
  return workspace.root
}

const ruleTester = createTypeScriptRuleTester()

describe('deepest-import-path', () => {
  beforeEach(() => {
    clearCache()
  })

  afterAll(() => {
    manager.cleanupAll()
  })

  describe('valid cases', () => {
    ruleTester.run('deepest-import-path - valid', rule, {
      valid: [
        {
          name: 'allows external package imports',
          code: `import { useState } from 'react'`,
          filename: (() => {
            const workspace = createTempWorkspace({})
            return join(workspace, 'src/test.ts')
          })(),
        },
        {
          name: 'allows lodash imports',
          code: `import { debounce } from 'lodash'`,
          filename: (() => {
            const workspace = createTempWorkspace({})
            return join(workspace, 'src/test.ts')
          })(),
        },

        {
          name: 'allows node built-in imports',
          code: `import { readFileSync } from 'node:fs'`,
          filename: (() => {
            const workspace = createTempWorkspace({})
            return join(workspace, 'src/test.ts')
          })(),
        },

        {
          name: 'allows relative imports',
          code: `import { helper } from './helper'`,
          filename: (() => {
            const workspace = createTempWorkspace({})
            return join(workspace, 'src/test.ts')
          })(),
        },
        {
          name: 'allows parent relative imports',
          code: `import { config } from '../config'`,
          filename: (() => {
            const workspace = createTempWorkspace({})
            return join(workspace, 'src/test.ts')
          })(),
        },

        {
          name: 'allows imports already using subpath',
          code: `import { runCli } from '@hyperfrontend/project-scope/cli'`,
          filename: (() => {
            const workspace = createTempWorkspace({
              tsconfigBasePaths: {
                '@hyperfrontend/project-scope': ['libs/project-scope/src/index.ts'],
                '@hyperfrontend/project-scope/cli': ['libs/project-scope/src/cli/index.ts'],
              },
              sourceFiles: {
                'libs/project-scope/src/index.ts': `export * from './cli'`,
                'libs/project-scope/src/cli/index.ts': `export function runCli() {}`,
              },
            })
            return join(workspace, 'src/test.ts')
          })(),
        },

        {
          name: 'allows base import when symbol only exists at base level',
          code: `import { uniqueSymbol } from '@hyperfrontend/project-scope'`,
          filename: (() => {
            const workspace = createTempWorkspace({
              tsconfigBasePaths: {
                '@hyperfrontend/project-scope': ['libs/project-scope/src/index.ts'],
                '@hyperfrontend/project-scope/cli': ['libs/project-scope/src/cli/index.ts'],
              },
              sourceFiles: {
                'libs/project-scope/src/index.ts': `export const uniqueSymbol = 'unique'\nexport * from './cli'`,
                'libs/project-scope/src/cli/index.ts': `export function runCli() {}`,
              },
            })
            return join(workspace, 'src/test.ts')
          })(),
        },

        {
          name: 'allows base import when symbols come from different subpaths',
          code: `import { runCli, parseConfig } from '@hyperfrontend/project-scope'`,
          filename: (() => {
            const workspace = createTempWorkspace({
              tsconfigBasePaths: {
                '@hyperfrontend/project-scope': ['libs/project-scope/src/index.ts'],
                '@hyperfrontend/project-scope/cli': ['libs/project-scope/src/cli/index.ts'],
                '@hyperfrontend/project-scope/config': ['libs/project-scope/src/config/index.ts'],
              },
              sourceFiles: {
                'libs/project-scope/src/index.ts': `export * from './cli'\nexport * from './config'`,
                'libs/project-scope/src/cli/index.ts': `export function runCli() {}`,
                'libs/project-scope/src/config/index.ts': `export function parseConfig() {}`,
              },
            })
            return join(workspace, 'src/test.ts')
          })(),
        },

        {
          name: 'allows default imports',
          code: `import ProjectScope from '@hyperfrontend/project-scope'`,
          filename: (() => {
            const workspace = createTempWorkspace({
              tsconfigBasePaths: {
                '@hyperfrontend/project-scope': ['libs/project-scope/src/index.ts'],
              },
              sourceFiles: {
                'libs/project-scope/src/index.ts': `export default {}`,
              },
            })
            return join(workspace, 'src/test.ts')
          })(),
        },

        {
          name: 'allows side effect imports',
          code: `import '@hyperfrontend/project-scope'`,
          filename: (() => {
            const workspace = createTempWorkspace({
              tsconfigBasePaths: {
                '@hyperfrontend/project-scope': ['libs/project-scope/src/index.ts'],
              },
              sourceFiles: {
                'libs/project-scope/src/index.ts': `// side effect`,
              },
            })
            return join(workspace, 'src/test.ts')
          })(),
        },

        {
          name: 'allows namespace imports',
          code: `import * as ProjectScope from '@hyperfrontend/project-scope'`,
          filename: (() => {
            const workspace = createTempWorkspace({
              tsconfigBasePaths: {
                '@hyperfrontend/project-scope': ['libs/project-scope/src/index.ts'],
              },
              sourceFiles: {
                'libs/project-scope/src/index.ts': `export const foo = 'bar'`,
              },
            })
            return join(workspace, 'src/test.ts')
          })(),
        },

        {
          name: 'works with type-only imports when no deeper path',
          code: `import type { Config } from '@hyperfrontend/project-scope'`,
          filename: (() => {
            const workspace = createTempWorkspace({
              tsconfigBasePaths: {
                '@hyperfrontend/project-scope': ['libs/project-scope/src/index.ts'],
              },
              sourceFiles: {
                'libs/project-scope/src/index.ts': `export type Config = { key: string }`,
              },
            })
            return join(workspace, 'src/test.ts')
          })(),
        },

        {
          name: 'handles empty tsconfig paths',
          code: `import { foo } from '@hyperfrontend/project-scope'`,
          filename: (() => {
            const workspace = createTempWorkspace({
              tsconfigBasePaths: {},
            })
            return join(workspace, 'src/test.ts')
          })(),
        },

        {
          name: 'ignores imports not matching custom prefix',
          code: `import { foo } from '@myorg/package'`,
          options: [{ packagePrefix: '@custom/' }],
          filename: (() => {
            const workspace = createTempWorkspace({
              tsconfigBasePaths: {
                '@myorg/package': ['libs/package/src/index.ts'],
                '@myorg/package/sub': ['libs/package/src/sub/index.ts'],
              },
              sourceFiles: {
                'libs/package/src/index.ts': `export * from './sub'`,
                'libs/package/src/sub/index.ts': `export const foo = 'bar'`,
              },
            })
            return join(workspace, 'src/test.ts')
          })(),
        },
      ],
      invalid: [],
    })
  })

  describe('invalid cases', () => {
    ruleTester.run('deepest-import-path - invalid', rule, {
      valid: [],
      invalid: [
        {
          name: 'reports when deeper subpath exports symbol',
          code: `import { runCli } from '@hyperfrontend/project-scope'`,
          output: `import { runCli } from '@hyperfrontend/project-scope/cli'`,
          errors: [
            {
              messageId: 'useDeeperImport',
              data: {
                currentPath: '@hyperfrontend/project-scope',
                suggestedPath: '@hyperfrontend/project-scope/cli',
              },
            },
          ],
          filename: (() => {
            const workspace = createTempWorkspace({
              tsconfigBasePaths: {
                '@hyperfrontend/project-scope': ['libs/project-scope/src/index.ts'],
                '@hyperfrontend/project-scope/cli': ['libs/project-scope/src/cli/index.ts'],
              },
              sourceFiles: {
                'libs/project-scope/src/index.ts': `export * from './cli'`,
                'libs/project-scope/src/cli/index.ts': `export function runCli() {}`,
              },
            })
            return join(workspace, 'src/test.ts')
          })(),
        },

        {
          name: 'reports when multiple symbols share deeper subpath',
          code: `import { runCli, parseArgs } from '@hyperfrontend/project-scope'`,
          output: `import { runCli, parseArgs } from '@hyperfrontend/project-scope/cli'`,
          errors: [
            {
              messageId: 'useDeeperImport',
              data: {
                currentPath: '@hyperfrontend/project-scope',
                suggestedPath: '@hyperfrontend/project-scope/cli',
              },
            },
          ],
          filename: (() => {
            const workspace = createTempWorkspace({
              tsconfigBasePaths: {
                '@hyperfrontend/project-scope': ['libs/project-scope/src/index.ts'],
                '@hyperfrontend/project-scope/cli': ['libs/project-scope/src/cli/index.ts'],
              },
              sourceFiles: {
                'libs/project-scope/src/index.ts': `export * from './cli'`,
                'libs/project-scope/src/cli/index.ts': `export function runCli() {}\nexport function parseArgs() {}`,
              },
            })
            return join(workspace, 'src/test.ts')
          })(),
        },

        {
          name: 'reports for type-only imports with deeper subpath',
          code: `import type { CliConfig } from '@hyperfrontend/project-scope'`,
          output: `import type { CliConfig } from '@hyperfrontend/project-scope/cli'`,
          errors: [
            {
              messageId: 'useDeeperImport',
              data: {
                currentPath: '@hyperfrontend/project-scope',
                suggestedPath: '@hyperfrontend/project-scope/cli',
              },
            },
          ],
          filename: (() => {
            const workspace = createTempWorkspace({
              tsconfigBasePaths: {
                '@hyperfrontend/project-scope': ['libs/project-scope/src/index.ts'],
                '@hyperfrontend/project-scope/cli': ['libs/project-scope/src/cli/index.ts'],
              },
              sourceFiles: {
                'libs/project-scope/src/index.ts': `export type * from './cli'`,
                'libs/project-scope/src/cli/index.ts': `export type CliConfig = { verbose: boolean }`,
              },
            })
            return join(workspace, 'src/test.ts')
          })(),
        },

        {
          name: 'handles aliased imports correctly',
          code: `import { runCli as execute } from '@hyperfrontend/project-scope'`,
          output: `import { runCli as execute } from '@hyperfrontend/project-scope/cli'`,
          errors: [
            {
              messageId: 'useDeeperImport',
              data: {
                currentPath: '@hyperfrontend/project-scope',
                suggestedPath: '@hyperfrontend/project-scope/cli',
              },
            },
          ],
          filename: (() => {
            const workspace = createTempWorkspace({
              tsconfigBasePaths: {
                '@hyperfrontend/project-scope': ['libs/project-scope/src/index.ts'],
                '@hyperfrontend/project-scope/cli': ['libs/project-scope/src/cli/index.ts'],
              },
              sourceFiles: {
                'libs/project-scope/src/index.ts': `export * from './cli'`,
                'libs/project-scope/src/cli/index.ts': `export function runCli() {}`,
              },
            })
            return join(workspace, 'src/test.ts')
          })(),
        },

        {
          name: 'handles mixed type and value imports',
          code: `import { type CliConfig, runCli } from '@hyperfrontend/project-scope'`,
          output: `import { type CliConfig, runCli } from '@hyperfrontend/project-scope/cli'`,
          errors: [
            {
              messageId: 'useDeeperImport',
              data: {
                currentPath: '@hyperfrontend/project-scope',
                suggestedPath: '@hyperfrontend/project-scope/cli',
              },
            },
          ],
          filename: (() => {
            const workspace = createTempWorkspace({
              tsconfigBasePaths: {
                '@hyperfrontend/project-scope': ['libs/project-scope/src/index.ts'],
                '@hyperfrontend/project-scope/cli': ['libs/project-scope/src/cli/index.ts'],
              },
              sourceFiles: {
                'libs/project-scope/src/index.ts': `export * from './cli'`,
                'libs/project-scope/src/cli/index.ts': `export type CliConfig = { verbose: boolean }\nexport function runCli() {}`,
              },
            })
            return join(workspace, 'src/test.ts')
          })(),
        },

        {
          name: 'chooses deepest matching subpath',
          code: `import { deepFunction } from '@hyperfrontend/project-scope'`,
          output: `import { deepFunction } from '@hyperfrontend/project-scope/core/deep'`,
          errors: [
            {
              messageId: 'useDeeperImport',
              data: {
                currentPath: '@hyperfrontend/project-scope',
                suggestedPath: '@hyperfrontend/project-scope/core/deep',
              },
            },
          ],
          filename: (() => {
            const workspace = createTempWorkspace({
              tsconfigBasePaths: {
                '@hyperfrontend/project-scope': ['libs/project-scope/src/index.ts'],
                '@hyperfrontend/project-scope/core': ['libs/project-scope/src/core/index.ts'],
                '@hyperfrontend/project-scope/core/deep': ['libs/project-scope/src/core/deep/index.ts'],
              },
              sourceFiles: {
                'libs/project-scope/src/index.ts': `export * from './core'`,
                'libs/project-scope/src/core/index.ts': `export * from './deep'`,
                'libs/project-scope/src/core/deep/index.ts': `export function deepFunction() {}`,
              },
            })
            return join(workspace, 'src/test.ts')
          })(),
        },

        {
          name: 'preserves double quote style',
          code: `import { runCli } from "@hyperfrontend/project-scope"`,
          output: `import { runCli } from "@hyperfrontend/project-scope/cli"`,
          errors: [
            {
              messageId: 'useDeeperImport',
              data: {
                currentPath: '@hyperfrontend/project-scope',
                suggestedPath: '@hyperfrontend/project-scope/cli',
              },
            },
          ],
          filename: (() => {
            const workspace = createTempWorkspace({
              tsconfigBasePaths: {
                '@hyperfrontend/project-scope': ['libs/project-scope/src/index.ts'],
                '@hyperfrontend/project-scope/cli': ['libs/project-scope/src/cli/index.ts'],
              },
              sourceFiles: {
                'libs/project-scope/src/index.ts': `export * from './cli'`,
                'libs/project-scope/src/cli/index.ts': `export function runCli() {}`,
              },
            })
            return join(workspace, 'src/test.ts')
          })(),
        },

        {
          name: 'respects custom packagePrefix option',
          code: `import { foo } from '@myorg/package'`,
          output: `import { foo } from '@myorg/package/sub'`,
          options: [{ packagePrefix: '@myorg/' }],
          errors: [
            {
              messageId: 'useDeeperImport',
              data: {
                currentPath: '@myorg/package',
                suggestedPath: '@myorg/package/sub',
              },
            },
          ],
          filename: (() => {
            const workspace = createTempWorkspace({
              tsconfigBasePaths: {
                '@myorg/package': ['libs/package/src/index.ts'],
                '@myorg/package/sub': ['libs/package/src/sub/index.ts'],
              },
              sourceFiles: {
                'libs/package/src/index.ts': `export * from './sub'`,
                'libs/package/src/sub/index.ts': `export const foo = 'bar'`,
              },
            })
            return join(workspace, 'src/test.ts')
          })(),
        },

        {
          name: 'handles export const declarations',
          code: `import { MY_CONSTANT } from '@hyperfrontend/project-scope'`,
          output: `import { MY_CONSTANT } from '@hyperfrontend/project-scope/constants'`,
          errors: [
            {
              messageId: 'useDeeperImport',
              data: {
                currentPath: '@hyperfrontend/project-scope',
                suggestedPath: '@hyperfrontend/project-scope/constants',
              },
            },
          ],
          filename: (() => {
            const workspace = createTempWorkspace({
              tsconfigBasePaths: {
                '@hyperfrontend/project-scope': ['libs/project-scope/src/index.ts'],
                '@hyperfrontend/project-scope/constants': ['libs/project-scope/src/constants/index.ts'],
              },
              sourceFiles: {
                'libs/project-scope/src/index.ts': `export * from './constants'`,
                'libs/project-scope/src/constants/index.ts': `export const MY_CONSTANT = 'value'`,
              },
            })
            return join(workspace, 'src/test.ts')
          })(),
        },

        {
          name: 'handles export class declarations',
          code: `import { MyClass } from '@hyperfrontend/project-scope'`,
          output: `import { MyClass } from '@hyperfrontend/project-scope/classes'`,
          errors: [
            {
              messageId: 'useDeeperImport',
              data: {
                currentPath: '@hyperfrontend/project-scope',
                suggestedPath: '@hyperfrontend/project-scope/classes',
              },
            },
          ],
          filename: (() => {
            const workspace = createTempWorkspace({
              tsconfigBasePaths: {
                '@hyperfrontend/project-scope': ['libs/project-scope/src/index.ts'],
                '@hyperfrontend/project-scope/classes': ['libs/project-scope/src/classes/index.ts'],
              },
              sourceFiles: {
                'libs/project-scope/src/index.ts': `export * from './classes'`,
                'libs/project-scope/src/classes/index.ts': `export class MyClass {}`,
              },
            })
            return join(workspace, 'src/test.ts')
          })(),
        },

        {
          name: 'handles export type declarations',
          code: `import type { MyType } from '@hyperfrontend/project-scope'`,
          output: `import type { MyType } from '@hyperfrontend/project-scope/types'`,
          errors: [
            {
              messageId: 'useDeeperImport',
              data: {
                currentPath: '@hyperfrontend/project-scope',
                suggestedPath: '@hyperfrontend/project-scope/types',
              },
            },
          ],
          filename: (() => {
            const workspace = createTempWorkspace({
              tsconfigBasePaths: {
                '@hyperfrontend/project-scope': ['libs/project-scope/src/index.ts'],
                '@hyperfrontend/project-scope/types': ['libs/project-scope/src/types/index.ts'],
              },
              sourceFiles: {
                'libs/project-scope/src/index.ts': `export type * from './types'`,
                'libs/project-scope/src/types/index.ts': `export type MyType = { id: number }`,
              },
            })
            return join(workspace, 'src/test.ts')
          })(),
        },

        {
          name: 'handles export interface declarations',
          code: `import type { MyInterface } from '@hyperfrontend/project-scope'`,
          output: `import type { MyInterface } from '@hyperfrontend/project-scope/interfaces'`,
          errors: [
            {
              messageId: 'useDeeperImport',
              data: {
                currentPath: '@hyperfrontend/project-scope',
                suggestedPath: '@hyperfrontend/project-scope/interfaces',
              },
            },
          ],
          filename: (() => {
            const workspace = createTempWorkspace({
              tsconfigBasePaths: {
                '@hyperfrontend/project-scope': ['libs/project-scope/src/index.ts'],
                '@hyperfrontend/project-scope/interfaces': ['libs/project-scope/src/interfaces/index.ts'],
              },
              sourceFiles: {
                'libs/project-scope/src/index.ts': `export type * from './interfaces'`,
                'libs/project-scope/src/interfaces/index.ts': `export interface MyInterface { id: number }`,
              },
            })
            return join(workspace, 'src/test.ts')
          })(),
        },

        {
          name: 'handles export enum declarations',
          code: `import { MyEnum } from '@hyperfrontend/project-scope'`,
          output: `import { MyEnum } from '@hyperfrontend/project-scope/enums'`,
          errors: [
            {
              messageId: 'useDeeperImport',
              data: {
                currentPath: '@hyperfrontend/project-scope',
                suggestedPath: '@hyperfrontend/project-scope/enums',
              },
            },
          ],
          filename: (() => {
            const workspace = createTempWorkspace({
              tsconfigBasePaths: {
                '@hyperfrontend/project-scope': ['libs/project-scope/src/index.ts'],
                '@hyperfrontend/project-scope/enums': ['libs/project-scope/src/enums/index.ts'],
              },
              sourceFiles: {
                'libs/project-scope/src/index.ts': `export * from './enums'`,
                'libs/project-scope/src/enums/index.ts': `export enum MyEnum { A, B, C }`,
              },
            })
            return join(workspace, 'src/test.ts')
          })(),
        },

        {
          name: 'handles re-exported symbols with aliases',
          code: `import { aliasedFn } from '@hyperfrontend/project-scope'`,
          output: `import { aliasedFn } from '@hyperfrontend/project-scope/utils'`,
          errors: [
            {
              messageId: 'useDeeperImport',
              data: {
                currentPath: '@hyperfrontend/project-scope',
                suggestedPath: '@hyperfrontend/project-scope/utils',
              },
            },
          ],
          filename: (() => {
            const workspace = createTempWorkspace({
              tsconfigBasePaths: {
                '@hyperfrontend/project-scope': ['libs/project-scope/src/index.ts'],
                '@hyperfrontend/project-scope/utils': ['libs/project-scope/src/utils/index.ts'],
              },
              sourceFiles: {
                'libs/project-scope/src/index.ts': `export { aliasedFn } from './utils'`,
                'libs/project-scope/src/utils/index.ts': `export { internalFn as aliasedFn } from './internal'\nexport function internalFn() {}`,
              },
            })
            return join(workspace, 'src/test.ts')
          })(),
        },
      ],
    })
  })

  describe('edge cases', () => {
    ruleTester.run('deepest-import-path - edge cases', rule, {
      valid: [
        {
          name: 'handles missing workspace root gracefully',
          code: `import { foo } from '@hyperfrontend/package'`,
          filename: '/tmp/orphan-file.ts',
        },

        {
          name: 'handles non-existent source files',
          code: `import { foo } from '@hyperfrontend/package'`,
          filename: (() => {
            const workspace = createTempWorkspace({
              tsconfigBasePaths: {
                '@hyperfrontend/package': ['libs/package/src/index.ts'],
                '@hyperfrontend/package/sub': ['libs/package/src/sub/index.ts'],
                // Note: we don't create the source files
              },
            })
            return join(workspace, 'src/test.ts')
          })(),
        },

        {
          name: 'handles export let declarations',
          code: `import { counter } from '@hyperfrontend/package'`,
          filename: (() => {
            const workspace = createTempWorkspace({
              tsconfigBasePaths: {
                '@hyperfrontend/package': ['libs/package/src/index.ts'],
              },
              sourceFiles: {
                'libs/package/src/index.ts': `export let counter = 0`,
              },
            })
            return join(workspace, 'src/test.ts')
          })(),
        },

        {
          name: 'handles various import syntax',
          code: `import '@hyperfrontend/polyfill'`,
          filename: (() => {
            const workspace = createTempWorkspace({
              tsconfigBasePaths: {
                '@hyperfrontend/polyfill': ['libs/polyfill/src/index.ts'],
              },
              sourceFiles: {
                'libs/polyfill/src/index.ts': `// side effects only`,
              },
            })
            return join(workspace, 'src/test.ts')
          })(),
        },
      ],
      invalid: [],
    })
  })

  describe('export parsing coverage', () => {
    ruleTester.run('deepest-import-path - export parsing', rule, {
      valid: [],
      invalid: [
        {
          name: 'parses export list correctly',
          code: `import { funcA, funcB } from '@hyperfrontend/package'`,
          output: `import { funcA, funcB } from '@hyperfrontend/package/utils'`,
          errors: [{ messageId: 'useDeeperImport' }],
          filename: (() => {
            const workspace = createTempWorkspace({
              tsconfigBasePaths: {
                '@hyperfrontend/package': ['libs/package/src/index.ts'],
                '@hyperfrontend/package/utils': ['libs/package/src/utils/index.ts'],
              },
              sourceFiles: {
                'libs/package/src/index.ts': `export * from './utils'`,
                'libs/package/src/utils/index.ts': `
const _funcA = () => {}
const _funcB = () => {}
export { _funcA as funcA, _funcB as funcB }`,
              },
            })
            return join(workspace, 'src/test.ts')
          })(),
        },

        {
          name: 'parses export type list correctly',
          code: `import type { TypeA, TypeB } from '@hyperfrontend/package'`,
          output: `import type { TypeA, TypeB } from '@hyperfrontend/package/types'`,
          errors: [{ messageId: 'useDeeperImport' }],
          filename: (() => {
            const workspace = createTempWorkspace({
              tsconfigBasePaths: {
                '@hyperfrontend/package': ['libs/package/src/index.ts'],
                '@hyperfrontend/package/types': ['libs/package/src/types/index.ts'],
              },
              sourceFiles: {
                'libs/package/src/index.ts': `export type * from './types'`,
                'libs/package/src/types/index.ts': `
type _TypeA = string
type _TypeB = number
export type { _TypeA as TypeA, _TypeB as TypeB }`,
              },
            })
            return join(workspace, 'src/test.ts')
          })(),
        },

        {
          name: 'parses export function declaration',
          code: `import { myFunction } from '@hyperfrontend/package'`,
          output: `import { myFunction } from '@hyperfrontend/package/helpers'`,
          errors: [{ messageId: 'useDeeperImport' }],
          filename: (() => {
            const workspace = createTempWorkspace({
              tsconfigBasePaths: {
                '@hyperfrontend/package': ['libs/package/src/index.ts'],
                '@hyperfrontend/package/helpers': ['libs/package/src/helpers/index.ts'],
              },
              sourceFiles: {
                'libs/package/src/index.ts': `export * from './helpers'`,
                'libs/package/src/helpers/index.ts': `export function myFunction() { return 42 }`,
              },
            })
            return join(workspace, 'src/test.ts')
          })(),
        },

        {
          name: 'parses export var declaration',
          code: `import { myVar } from '@hyperfrontend/package'`,
          output: `import { myVar } from '@hyperfrontend/package/vars'`,
          errors: [{ messageId: 'useDeeperImport' }],
          filename: (() => {
            const workspace = createTempWorkspace({
              tsconfigBasePaths: {
                '@hyperfrontend/package': ['libs/package/src/index.ts'],
                '@hyperfrontend/package/vars': ['libs/package/src/vars/index.ts'],
              },
              sourceFiles: {
                'libs/package/src/index.ts': `export * from './vars'`,
                'libs/package/src/vars/index.ts': `export var myVar = 'test'`,
              },
            })
            return join(workspace, 'src/test.ts')
          })(),
        },
      ],
    })
  })

  describe('non-scoped package prefix', () => {
    ruleTester.run('deepest-import-path - non-scoped prefix', rule, {
      valid: [],
      invalid: [
        {
          name: 'handles non-scoped package prefix',
          code: `import { helper } from 'mylib'`,
          output: `import { helper } from 'mylib/utils'`,
          options: [{ packagePrefix: 'mylib' }],
          errors: [{ messageId: 'useDeeperImport' }],
          filename: (() => {
            const workspace = createTempWorkspace({
              tsconfigBasePaths: {
                mylib: ['libs/mylib/src/index.ts'],
                'mylib/utils': ['libs/mylib/src/utils/index.ts'],
              },
              sourceFiles: {
                'libs/mylib/src/index.ts': `export * from './utils'`,
                'libs/mylib/src/utils/index.ts': `export function helper() {}`,
              },
            })
            return join(workspace, 'src/test.ts')
          })(),
        },
      ],
    })
  })

  describe('barrel re-exports (export * from)', () => {
    ruleTester.run('deepest-import-path - barrel re-exports', rule, {
      valid: [
        {
          name: 'handles circular re-exports without infinite loop',
          code: `import { circularFn } from '@hyperfrontend/package/a'`,
          filename: (() => {
            const workspace = createTempWorkspace({
              tsconfigBasePaths: {
                '@hyperfrontend/package': ['libs/package/src/index.ts'],
                '@hyperfrontend/package/a': ['libs/package/src/a/index.ts'],
                '@hyperfrontend/package/b': ['libs/package/src/b/index.ts'],
              },
              sourceFiles: {
                'libs/package/src/index.ts': `export * from './a'`,
                'libs/package/src/a/index.ts': `
export * from '../b'
export function circularFn() {}`,
                'libs/package/src/b/index.ts': `export * from '../a'`,
              },
            })
            return join(workspace, 'src/test.ts')
          })(),
        },
      ],
      invalid: [
        {
          name: 'follows single-level barrel re-export',
          code: `import { barrelFn } from '@hyperfrontend/package'`,
          output: `import { barrelFn } from '@hyperfrontend/package/utils'`,
          errors: [{ messageId: 'useDeeperImport' }],
          filename: (() => {
            const workspace = createTempWorkspace({
              tsconfigBasePaths: {
                '@hyperfrontend/package': ['libs/package/src/index.ts'],
                '@hyperfrontend/package/utils': ['libs/package/src/utils/index.ts'],
              },
              sourceFiles: {
                'libs/package/src/index.ts': `export * from './utils'`,
                'libs/package/src/utils/index.ts': `export function barrelFn() {}`,
              },
            })
            return join(workspace, 'src/test.ts')
          })(),
        },

        {
          name: 'follows nested barrel re-exports',
          code: `import { deepFn } from '@hyperfrontend/package'`,
          output: `import { deepFn } from '@hyperfrontend/package/core/deep'`,
          errors: [{ messageId: 'useDeeperImport' }],
          filename: (() => {
            const workspace = createTempWorkspace({
              tsconfigBasePaths: {
                '@hyperfrontend/package': ['libs/package/src/index.ts'],
                '@hyperfrontend/package/core': ['libs/package/src/core/index.ts'],
                '@hyperfrontend/package/core/deep': ['libs/package/src/core/deep/index.ts'],
              },
              sourceFiles: {
                'libs/package/src/index.ts': `export * from './core'`,
                'libs/package/src/core/index.ts': `export * from './deep'`,
                'libs/package/src/core/deep/index.ts': `export function deepFn() {}`,
              },
            })
            return join(workspace, 'src/test.ts')
          })(),
        },

        {
          name: 'handles mixed barrel and direct exports',
          code: `import { reExported, directExport } from '@hyperfrontend/package'`,
          output: `import { reExported, directExport } from '@hyperfrontend/package/mixed'`,
          errors: [{ messageId: 'useDeeperImport' }],
          filename: (() => {
            const workspace = createTempWorkspace({
              tsconfigBasePaths: {
                '@hyperfrontend/package': ['libs/package/src/index.ts'],
                '@hyperfrontend/package/mixed': ['libs/package/src/mixed/index.ts'],
              },
              sourceFiles: {
                'libs/package/src/index.ts': `export * from './mixed'`,
                'libs/package/src/mixed/index.ts': `
export * from './helpers'
export const directExport = 42`,
                'libs/package/src/mixed/helpers.ts': `export function reExported() {}`,
              },
            })
            return join(workspace, 'src/test.ts')
          })(),
        },

        {
          name: 'handles multiple barrel re-exports in same file',
          code: `import { fromA, fromB } from '@hyperfrontend/package'`,
          output: `import { fromA, fromB } from '@hyperfrontend/package/combined'`,
          errors: [{ messageId: 'useDeeperImport' }],
          filename: (() => {
            const workspace = createTempWorkspace({
              tsconfigBasePaths: {
                '@hyperfrontend/package': ['libs/package/src/index.ts'],
                '@hyperfrontend/package/combined': ['libs/package/src/combined/index.ts'],
              },
              sourceFiles: {
                'libs/package/src/index.ts': `export * from './combined'`,
                'libs/package/src/combined/index.ts': `
export * from './a'
export * from './b'`,
                'libs/package/src/combined/a.ts': `export function fromA() {}`,
                'libs/package/src/combined/b.ts': `export function fromB() {}`,
              },
            })
            return join(workspace, 'src/test.ts')
          })(),
        },

        {
          name: 'resolves barrel re-export without extension',
          code: `import { noExtFn } from '@hyperfrontend/package'`,
          output: `import { noExtFn } from '@hyperfrontend/package/sub'`,
          errors: [{ messageId: 'useDeeperImport' }],
          filename: (() => {
            const workspace = createTempWorkspace({
              tsconfigBasePaths: {
                '@hyperfrontend/package': ['libs/package/src/index.ts'],
                '@hyperfrontend/package/sub': ['libs/package/src/sub/index.ts'],
              },
              sourceFiles: {
                'libs/package/src/index.ts': `export * from './sub'`,
                'libs/package/src/sub/index.ts': `export * from './impl'`,
                'libs/package/src/sub/impl.ts': `export function noExtFn() {}`,
              },
            })
            return join(workspace, 'src/test.ts')
          })(),
        },
      ],
    })
  })
})
