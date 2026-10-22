import { testRule } from '../../testing/rule-tester.ts'
import rule from './max-path-occurrences.ts'

// why: the index-file cases name absolute paths the rule reads only the base name of.
testRule(rule, {
  valid: [
    { name: '#1 single import from a path', path: '/root/file.ts', text: "import { foo } from './module'" },
    {
      name: '#7 mixed imports and exports within limits in barrel file',
      path: '/root/project/src/index.ts',
      text: "import type { Config } from './config'\nimport { loadConfig } from './config'\nexport type { User } from './types'\nexport { createUser } from './types'",
    },
    {
      name: '#8 export without source (local export) does not count',
      path: '/root/project/src/index.ts',
      text: 'const foo = 1\nexport { foo }\nexport { foo as bar }\nexport { foo as baz }',
    },
    { name: '#9 side-effect imports from different paths', path: '/root/file.ts', text: "import './polyfills'\nimport './setup'" },
    {
      name: '#10 namespace import with type import (different kinds)',
      path: '/root/file.ts',
      text: "import * as utils from './utils'\nimport type { UtilType } from './utils'",
    },
    { name: '#11 single type import', path: '/root/file.ts', text: "import type { Foo, Bar, Baz } from './types'" },
    {
      name: '#15 export all from same path allowed in non-barrel files',
      path: '/root/project/src/re-export.ts',
      text: "export * from './utils'\nexport * as namedUtils from './utils'",
    },
  ],
  invalid: [
    {
      name: '#16 two type imports from same path',
      path: '/root/file.ts',
      text: "import type { User } from './types'\nimport type { Config } from './types'",
      errors: [
        {
          message: 'Multiple type import statements from "./types" (2 found). Consolidate into a single type import.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 36,
        },
        {
          message: 'Multiple type import statements from "./types" (2 found). Consolidate into a single type import.',
          line: 2,
          column: 1,
          endLine: 2,
          endColumn: 38,
        },
      ],
    },
    {
      name: '#18 two type exports from same path in barrel file',
      path: '/root/project/src/index.ts',
      text: "export type { User } from './types'\nexport type { Config } from './types'",
      errors: [
        {
          message: 'Multiple type export statements from "./types" (2 found). Consolidate into a single type export.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 36,
        },
        {
          message: 'Multiple type export statements from "./types" (2 found). Consolidate into a single type export.',
          line: 2,
          column: 1,
          endLine: 2,
          endColumn: 38,
        },
      ],
    },
    {
      name: '#23 mixed import and export violations (same kind) in barrel file',
      path: '/root/project/src/index.ts',
      text: "import { a } from './shared'\nimport { b } from './shared'\nexport { x } from './shared'\nexport { y } from './shared'",
      errors: [
        {
          message: 'Multiple value import statements from "./shared" (2 found). Consolidate into a single value import.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 29,
        },
        {
          message: 'Multiple value import statements from "./shared" (2 found). Consolidate into a single value import.',
          line: 2,
          column: 1,
          endLine: 2,
          endColumn: 29,
        },
        {
          message: 'Multiple value export statements from "./shared" (2 found). Consolidate into a single value export.',
          line: 3,
          column: 1,
          endLine: 3,
          endColumn: 29,
        },
        {
          message: 'Multiple value export statements from "./shared" (2 found). Consolidate into a single value export.',
          line: 4,
          column: 1,
          endLine: 4,
          endColumn: 29,
        },
      ],
    },
    {
      name: '#25 default and named imports are both value imports',
      path: '/root/file.ts',
      text: "import Default from './module'\nimport { named } from './module'",
      errors: [
        {
          message: 'Multiple value import statements from "./module" (2 found). Consolidate into a single value import.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 31,
        },
        {
          message: 'Multiple value import statements from "./module" (2 found). Consolidate into a single value import.',
          line: 2,
          column: 1,
          endLine: 2,
          endColumn: 33,
        },
      ],
    },
    {
      name: '#27 export violations in index.tsx barrel file',
      path: '/root/project/src/index.tsx',
      text: "export { Component } from './component'\nexport { OtherComponent } from './component'",
      errors: [
        {
          message: 'Multiple value export statements from "./component" (2 found). Consolidate into a single value export.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 40,
        },
        {
          message: 'Multiple value export statements from "./component" (2 found). Consolidate into a single value export.',
          line: 2,
          column: 1,
          endLine: 2,
          endColumn: 45,
        },
      ],
    },
  ],
})
