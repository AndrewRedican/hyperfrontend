import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-restricted-imports.ts'

// why: the workspace restricts imports with the `patterns` form only, by `group`, `importNames`, `allowImportNames` and `message`; the cases recorded with `paths`, string or regex patterns, name patterns, case sensitivity or type-import allowances are left out.
testRule(rule, {
  valid: [
    {
      name: '#30 a side-effect import of a pattern with restricted names',
      path: '/root/file.ts',
      text: "import 'lodash/fp'",
      options: { patterns: [{ group: ['lodash/*'], importNames: ['map'] }] },
    },
    {
      name: '#33 an export without a source',
      path: '/root/file.ts',
      text: 'export const local = 1',
      options: { patterns: [{ group: ['*'] }] },
    },
    { name: '#91 import os from "os";', path: '/root/file.ts', text: 'import os from "os";' },
    {
      name: '#250 an import equals declaration of a namespace under a pattern',
      path: '/root/file.ts',
      text: 'import z = Foo.Bar',
      options: { patterns: [{ group: ['*'] }] },
    },
    {
      name: '#255 a type from the workspace configuration',
      path: '/root/file.ts',
      text: "import type { Stats } from 'fs'",
      options: {
        patterns: [
          {
            group: ['node:fs', 'fs'],
            importNames: ['existsSync', 'readFileSync', 'writeFileSync', 'statSync', 'lstatSync', 'readdirSync'],
            message: 'Use wrappers from core/fs instead of direct Node.js fs imports.',
          },
        ],
      },
    },
  ],
  invalid: [
    {
      name: '#36 import withPatterns from "foo/baz";',
      path: '/root/file.ts',
      text: 'import withPatterns from "foo/baz";',
      options: { patterns: [{ group: ['foo/*', '!foo/bar'], message: 'foo is forbidden, use foo/bar instead' }] },
      errors: [
        {
          message: "'foo/baz' import is restricted from being used by a pattern. foo is forbidden, use foo/bar instead",
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 36,
        },
      ],
    },
    {
      name: '#37 import withPatterns from "foo/baz";',
      path: '/root/file.ts',
      text: 'import withPatterns from "foo/baz";',
      options: { patterns: [{ group: ['foo/bar', 'foo/baz'], message: 'some foo subimports are restricted' }] },
      errors: [
        {
          message: "'foo/baz' import is restricted from being used by a pattern. some foo subimports are restricted",
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 36,
        },
      ],
    },
    {
      name: "#45 import { Foo, Bar } from '../../my/relative-module';",
      path: '/root/file.ts',
      text: "import { Foo, Bar } from '../../my/relative-module';",
      options: { patterns: [{ group: ['**/my/relative-module'], importNames: ['Foo', 'Bar'], message: 'Import from @/utils instead.' }] },
      errors: [
        {
          message: "'Foo' import from '../../my/relative-module' is restricted from being used by a pattern. Import from @/utils instead.",
          line: 1,
          column: 10,
          endLine: 1,
          endColumn: 13,
        },
        {
          message: "'Bar' import from '../../my/relative-module' is restricted from being used by a pattern. Import from @/utils instead.",
          line: 1,
          column: 15,
          endLine: 1,
          endColumn: 18,
        },
      ],
    },
    {
      name: "#47 import * as AllWithCustomMessage from '../../my/relative-mod…",
      path: '/root/file.ts',
      text: "import * as AllWithCustomMessage from '../../my/relative-module';",
      options: { patterns: [{ group: ['**/my/relative-module'], importNames: ['Foo'], message: 'Import from @/utils instead.' }] },
      errors: [
        {
          message:
            "* import is invalid because 'Foo' from '../../my/relative-module' is restricted from being used by a pattern. Import from @/utils instead.",
          line: 1,
          column: 8,
          endLine: 1,
          endColumn: 33,
        },
      ],
    },
    {
      name: "#48 import def, * as ns from 'mod';",
      path: '/root/file.ts',
      text: "import def, * as ns from 'mod';",
      options: { patterns: [{ group: ['mod'], importNames: ['default'] }] },
      errors: [
        {
          message: "'default' import from 'mod' is restricted from being used by a pattern.",
          line: 1,
          column: 8,
          endLine: 1,
          endColumn: 11,
        },
        {
          message: "* import is invalid because 'default' from 'mod' is restricted from being used by a pattern.",
          line: 1,
          column: 13,
          endLine: 1,
          endColumn: 20,
        },
      ],
    },
    {
      name: '#73 import { AllowedObject, DisallowedObject } from "foo";',
      path: '/root/file.ts',
      text: 'import { AllowedObject, DisallowedObject } from "foo";',
      options: {
        patterns: [
          { group: ['foo'], allowImportNames: ['AllowedObject'], message: "Only 'AllowedObject' is allowed to be imported from 'foo'." },
        ],
      },
      errors: [
        {
          message:
            "'DisallowedObject' import from 'foo' is restricted because only 'AllowedObject' import(s) is/are allowed. Only 'AllowedObject' is allowed to be imported from 'foo'.",
          line: 1,
          column: 25,
          endLine: 1,
          endColumn: 41,
        },
      ],
    },
    {
      name: '#74 import * as AllowedObject from "foo/bar";',
      path: '/root/file.ts',
      text: 'import * as AllowedObject from "foo/bar";',
      options: { patterns: [{ group: ['foo/*'], allowImportNames: ['AllowedObject'] }] },
      errors: [
        {
          message: "* import is invalid because only 'AllowedObject' from 'foo/bar' is/are allowed.",
          line: 1,
          column: 8,
          endLine: 1,
          endColumn: 26,
        },
      ],
    },
    {
      name: '#75 import * as AllowedObject from "foo/bar";',
      path: '/root/file.ts',
      text: 'import * as AllowedObject from "foo/bar";',
      options: {
        patterns: [
          { group: ['foo/*'], allowImportNames: ['AllowedObject'], message: "Only 'AllowedObject' is allowed to be imported from 'foo'." },
        ],
      },
      errors: [
        {
          message:
            "* import is invalid because only 'AllowedObject' from 'foo/bar' is/are allowed. Only 'AllowedObject' is allowed to be imported from 'foo'.",
          line: 1,
          column: 8,
          endLine: 1,
          endColumn: 26,
        },
      ],
    },
    {
      name: '#85 an export of everything as a namespace under restricted names',
      path: '/root/file.ts',
      text: "export * as ns from 'mod'",
      options: { patterns: [{ group: ['mod'], importNames: ['a'] }] },
      errors: [
        {
          message: "* import is invalid because 'a' from 'mod' is restricted from being used by a pattern.",
          line: 1,
          column: 8,
          endLine: 1,
          endColumn: 9,
        },
      ],
    },
    {
      name: '#86 a default import under allowed names',
      path: '/root/file.ts',
      text: "import def from 'mod'",
      options: { patterns: [{ group: ['mod'], allowImportNames: ['a'] }] },
      errors: [
        {
          message: "'default' import from 'mod' is restricted because only 'a' import(s) is/are allowed.",
          line: 1,
          column: 8,
          endLine: 1,
          endColumn: 11,
        },
      ],
    },
    {
      name: "#269 export { foo } from 'import1/private/foo';",
      path: '/root/file.ts',
      text: "export { foo } from 'import1/private/foo';",
      options: {
        patterns: [
          { group: ['import1/private/*'], message: 'usage of import1 private modules not allowed.' },
          { group: ['import2/*', '!import2/good'], message: 'import2 is deprecated, except the modules in import2/good.' },
        ],
      },
      errors: [
        {
          message: "'import1/private/foo' import is restricted from being used by a pattern. usage of import1 private modules not allowed.",
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 43,
        },
      ],
    },
    {
      name: '#289 import fs = require("fs");',
      path: '/root/file.ts',
      text: 'import fs = require("fs");',
      options: { patterns: [{ group: ['f*'] }] },
      errors: [{ message: "'fs' import is restricted from being used by a pattern.", line: 1, column: 1, endLine: 1, endColumn: 27 }],
    },
    {
      name: '#297 a restricted name renamed on import from the workspace configuration',
      path: '/root/file.ts',
      text: "import { existsSync as exists, mkdirSync } from 'fs'",
      options: {
        patterns: [
          {
            group: ['node:fs', 'fs'],
            importNames: ['existsSync', 'readFileSync', 'writeFileSync', 'statSync', 'lstatSync', 'readdirSync'],
            message: 'Use wrappers from core/fs instead of direct Node.js fs imports.',
          },
        ],
      },
      errors: [
        {
          message:
            "'existsSync' import from 'fs' is restricted from being used by a pattern. Use wrappers from core/fs instead of direct Node.js fs imports.",
          line: 1,
          column: 10,
          endLine: 1,
          endColumn: 30,
        },
      ],
    },
    {
      name: '#298 a namespace import from the workspace configuration',
      path: '/root/file.ts',
      text: "import * as fs from 'fs'",
      options: {
        patterns: [
          {
            group: ['node:fs', 'fs'],
            importNames: ['existsSync', 'readFileSync', 'writeFileSync', 'statSync', 'lstatSync', 'readdirSync'],
            message: 'Use wrappers from core/fs instead of direct Node.js fs imports.',
          },
        ],
      },
      errors: [
        {
          message:
            "* import is invalid because 'existsSync,readFileSync,writeFileSync,statSync,lstatSync,readdirSync' from 'fs' is restricted from being used by a pattern. Use wrappers from core/fs instead of direct Node.js fs imports.",
          line: 1,
          column: 8,
          endLine: 1,
          endColumn: 15,
        },
      ],
    },
  ],
})

const PATH = '/w/a.ts'
const RESTRICTED = "'lib/x' import is restricted from being used by a pattern."

testRule(rule, {
  valid: [
    {
      name: 'an anchored pattern against a deeper path',
      path: PATH,
      text: "import 'src/lib/x'",
      options: { patterns: [{ group: ['/lib/*'] }] },
    },
    { name: 'a segment pattern that is too long', path: PATH, text: "import 'lib/x'", options: { patterns: [{ group: ['lib/x?'] }] } },
    { name: 'a pattern with more segments than the path', path: PATH, text: "import 'lib'", options: { patterns: [{ group: ['lib/x'] }] } },
    {
      name: 'a name that is neither restricted nor outside the allowed ones',
      path: PATH,
      text: "import { a } from 'lib'",
      options: { patterns: [{ group: ['lib'], importNames: ['b'], allowImportNames: ['a'] }] },
    },
    {
      name: 'a double star that matches nothing',
      path: PATH,
      text: "import 'lib/a/b/y'",
      options: { patterns: [{ group: ['lib/**/x'] }] },
    },
    {
      name: 'a star followed by text that matches nothing',
      path: PATH,
      text: "import 'foo/bar'",
      options: { patterns: [{ group: ['foo/*x'] }] },
    },
  ],
  invalid: [
    {
      name: 'a name imported twice',
      path: PATH,
      text: "import { a, a as b } from 'lib'",
      options: { patterns: [{ group: ['lib'], importNames: ['a'] }] },
      errors: [
        { message: "'a' import from 'lib' is restricted from being used by a pattern.", line: 1, column: 10, endLine: 1, endColumn: 11 },
        { message: "'a' import from 'lib' is restricted from being used by a pattern.", line: 1, column: 13, endLine: 1, endColumn: 19 },
      ],
    },
    {
      name: 'an anchored pattern with a leading slash',
      path: PATH,
      text: "import 'lib/x'",
      options: { patterns: [{ group: ['/lib/*'] }] },
      errors: [{ message: RESTRICTED, line: 1, column: 1, endLine: 1, endColumn: 15 }],
    },
    {
      name: 'a pattern with a double star inside',
      path: PATH,
      text: "import 'lib/a/b/x'",
      options: { patterns: [{ group: ['lib/**/x'] }] },
      errors: [
        { message: "'lib/a/b/x' import is restricted from being used by a pattern.", line: 1, column: 1, endLine: 1, endColumn: 19 },
      ],
    },
    {
      name: 'a pattern with a single-character wildcard',
      path: PATH,
      text: "import 'lib/x'",
      options: { patterns: [{ group: ['lib/?'] }] },
      errors: [{ message: RESTRICTED, line: 1, column: 1, endLine: 1, endColumn: 15 }],
    },
    {
      name: 'a string export name',
      path: PATH,
      text: "export { 'a b' } from 'lib'",
      options: { patterns: [{ group: ['lib'], importNames: ['a b'] }] },
      errors: [
        { message: "'a b' import from 'lib' is restricted from being used by a pattern.", line: 1, column: 10, endLine: 1, endColumn: 15 },
      ],
    },
  ],
})
