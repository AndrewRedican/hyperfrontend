import { testRule } from '../../testing/rule-tester.ts'
import rule from './consistent-type-imports.ts'

// why: the workspace prefers type imports in separate declarations; the cases with the other preference or fix style, and the decorated cases recorded as silenced, are left out.
testRule(rule, {
  valid: [
    {
      name: "#119 import type { ClassA } from './classA';",
      path: '/root/file.ts',
      text: "\n        import type { ClassA } from './classA';\n\n        export class ClassB {\n          public constructor(node: ClassA) {}\n        }\n      ",
    },
    {
      name: "#131 import Foo from 'foo';",
      path: '/root/file.ts',
      text: "\n          import Foo from 'foo';\n          const foo: Foo = new Foo();\n        ",
    },
    {
      name: "#135 import Foo from 'foo';",
      path: '/root/file.ts',
      text: "\n          import Foo from 'foo';\n          type T<Foo> = Foo; // shadowing\n        ",
    },
    {
      name: "#138 import { A, B, C as c } from 'foo';",
      path: '/root/file.ts',
      text: "\n          import { A, B, C as c } from 'foo';\n          const d = c;\n        ",
    },
    {
      name: "#140 let foo: import('foo');",
      path: '/root/file.ts',
      text: "\nlet foo: import('foo');\nlet bar: import('foo').Bar;\n          ",
      options: { disallowTypeAnnotations: false },
    },
    {
      name: "#159 import Type from 'foo';",
      path: '/root/file.ts',
      text: "\n          import Type from 'foo';\n\n          export { Type }; // is a value export\n          export default Type; // is a value export\n        ",
    },
    {
      name: "#168 import React from 'react';",
      path: '/root/react.tsx',
      text: "\nimport React from 'react';\n\nexport const ComponentFoo: React.FC = () => {\n  return <div>Foo Foo</div>;\n};\n          ",
    },
    {
      name: "#170 import { Fragment } from 'react';",
      path: '/root/react.tsx',
      text: "\nimport { Fragment } from 'react';\n\nexport const ComponentFoo: Fragment = () => {\n  return <>Foo Foo</>;\n};\n          ",
      language: { jsxFragmentName: 'Fragment' },
    },
    {
      name: "#172 import type * as constants from './constants';",
      path: '/root/file.ts',
      text: "\n          import type * as constants from './constants';\n\n          export type Y = {\n            [constants.X]: ReadonlyArray<string>;\n          };\n        ",
    },
    {
      name: "#173 import A from 'foo';",
      path: '/root/file.ts',
      text: "\n          import A from 'foo';\n          export = A;\n        ",
    },
    {
      name: "#176 import { type A } from 'foo';",
      path: '/root/file.ts',
      text: "\n          import { type A } from 'foo';\n          export = {} as A;\n        ",
    },
    {
      name: '#182 an import with attributes used only as a type is left alone',
      path: '/root/file.ts',
      text: "import data from './data.json' with { type: 'json' };\ntype T = typeof data;",
    },
    { name: '#186 a parser without decorator settings reads them as off', path: '/root/file.ts', text: '123;' },
    { name: '#187 a side-effect import', path: '/root/file.ts', text: "import 'foo';" },
  ],
  invalid: [
    {
      name: "#190 import Foo from 'foo';",
      path: '/root/file.ts',
      text: "\nimport Foo from 'foo';\nlet foo: Foo;\ntype Bar = Foo;\ninterface Baz {\n  foo: Foo;\n}\nfunction fn(a: Foo): Foo {}\n          ",
      errors: [
        {
          message: 'All imports in the declaration are only used as types. Use `import type`.',
          line: 2,
          column: 1,
          endLine: 2,
          endColumn: 23,
        },
      ],
      output:
        "\nimport type Foo from 'foo';\nlet foo: Foo;\ntype Bar = Foo;\ninterface Baz {\n  foo: Foo;\n}\nfunction fn(a: Foo): Foo {}\n          ",
    },
    {
      name: "#197 import foo from 'foo';",
      path: '/root/file.ts',
      text: "\nimport foo from 'foo';\ntype Baz = (typeof foo.bar)['Baz']; // TSQualifiedName & TSTypeQuery\n          ",
      errors: [
        {
          message: 'All imports in the declaration are only used as types. Use `import type`.',
          line: 2,
          column: 1,
          endLine: 2,
          endColumn: 23,
        },
      ],
      output: "\nimport type foo from 'foo';\ntype Baz = (typeof foo.bar)['Baz']; // TSQualifiedName & TSTypeQuery\n          ",
    },
    {
      name: "#200 import A, {} from 'foo';",
      path: '/root/file.ts',
      text: "\nimport A, {} from 'foo';\nlet foo: A;\n          ",
      errors: [
        {
          message: 'All imports in the declaration are only used as types. Use `import type`.',
          line: 2,
          column: 1,
          endLine: 2,
          endColumn: 25,
        },
      ],
      output: "\nimport type A from 'foo';\nlet foo: A;\n          ",
    },
    {
      name: "#204 import A, { B, C, D } from 'foo';",
      path: '/root/file.ts',
      text: "\nimport A, { B, C, D } from 'foo';\nB();\ntype T = { foo: A; bar: C; baz: D };\n          ",
      errors: [{ message: 'Imports "A", "C" and "D" are only used as type.', line: 2, column: 1, endLine: 2, endColumn: 34 }],
      output:
        "\nimport type { C, D } from 'foo';\nimport type A from 'foo';\nimport { B } from 'foo';\nB();\ntype T = { foo: A; bar: C; baz: D };\n          ",
    },
    {
      name: "#206 import type Already1Def from 'foo';",
      path: '/root/file.ts',
      text: "\nimport type Already1Def from 'foo';\nimport type { Already1 } from 'foo';\nimport A, { B } from 'foo';\nimport { C, D, E } from 'bar';\nimport type { Already2 } from 'bar';\ntype T = { b: B; c: C; d: D };\n          ",
      errors: [
        { message: 'Imports "B" are only used as type.', line: 4, column: 1, endLine: 4, endColumn: 28 },
        { message: 'Imports "C" and "D" are only used as type.', line: 5, column: 1, endLine: 5, endColumn: 31 },
      ],
      output:
        "\nimport type Already1Def from 'foo';\nimport type { Already1 , B } from 'foo';\nimport A from 'foo';\nimport { E } from 'bar';\nimport type { Already2 , C, D} from 'bar';\ntype T = { b: B; c: C; d: D };\n          ",
    },
    {
      name: "#211 import { Type1, Type2 } from 'named_types';",
      path: '/root/file.ts',
      text: "\nimport { Type1, Type2 } from 'named_types';\nimport Type from 'default_type';\nimport * as Types from 'namespace_type';\nimport Default, { Named } from 'default_and_named_type';\ntype T = Type1 | Type2 | Type | Types.A | Default | Named;\n          ",
      errors: [
        {
          message: 'All imports in the declaration are only used as types. Use `import type`.',
          line: 2,
          column: 1,
          endLine: 2,
          endColumn: 44,
        },
        {
          message: 'All imports in the declaration are only used as types. Use `import type`.',
          line: 3,
          column: 1,
          endLine: 3,
          endColumn: 33,
        },
        {
          message: 'All imports in the declaration are only used as types. Use `import type`.',
          line: 4,
          column: 1,
          endLine: 4,
          endColumn: 41,
        },
        {
          message: 'All imports in the declaration are only used as types. Use `import type`.',
          line: 5,
          column: 1,
          endLine: 5,
          endColumn: 57,
        },
      ],
      output:
        "\nimport type { Type1, Type2 } from 'named_types';\nimport type Type from 'default_type';\nimport type * as Types from 'namespace_type';\nimport type { Named } from 'default_and_named_type';\nimport type Default from 'default_and_named_type';\ntype T = Type1 | Type2 | Type | Types.A | Default | Named;\n          ",
    },
    {
      name: "#213 let foo: import('foo');",
      path: '/root/file.ts',
      text: "\nlet foo: import('foo');\nlet bar: import('foo').Bar;\n          ",
      errors: [
        { message: '`import()` type annotations are forbidden.', line: 2, column: 10, endLine: 2, endColumn: 23 },
        { message: '`import()` type annotations are forbidden.', line: 3, column: 10, endLine: 3, endColumn: 27 },
      ],
      output: null,
    },
    {
      name: "#220 import * as Type from 'foo';",
      path: '/root/file.ts',
      text: "\nimport * as Type from 'foo';\n\nexport type { Type }; // is a type-only export\n          ",
      errors: [
        {
          message: 'All imports in the declaration are only used as types. Use `import type`.',
          line: 2,
          column: 1,
          endLine: 2,
          endColumn: 29,
        },
      ],
      output: "\nimport type * as Type from 'foo';\n\nexport type { Type }; // is a type-only export\n          ",
    },
    {
      name: "#221 import Default, * as Rest from 'module';",
      path: '/root/file.ts',
      text: "\nimport Default, * as Rest from 'module';\nconst a: Rest.A = '';\n          ",
      options: { prefer: 'type-imports' },
      errors: [{ message: 'Imports "Rest" are only used as type.', line: 2, column: 1, endLine: 2, endColumn: 41 }],
      output: "\nimport type * as Rest from 'module';\nimport Default from 'module';\nconst a: Rest.A = '';\n          ",
    },
    {
      name: "#224 import Default, /*comment*/ * as Rest from 'module';",
      path: '/root/file.ts',
      text: "\nimport Default, /*comment*/ * as Rest from 'module';\nconst a: Default = '';\n          ",
      options: { prefer: 'type-imports' },
      errors: [{ message: 'Imports "Default" are only used as type.', line: 2, column: 1, endLine: 2, endColumn: 53 }],
      output: "\nimport type Default from 'module';\nimport /*comment*/ * as Rest from 'module';\nconst a: Default = '';\n          ",
    },
    {
      name: "#229 import Foo from 'foo';",
      path: '/root/file.ts',
      text: "\n            import Foo from 'foo';\n            class A {\n              @deco\n              foo: Foo;\n            }\n          ",
      errors: [
        {
          message: 'All imports in the declaration are only used as types. Use `import type`.',
          line: 2,
          column: 13,
          endLine: 2,
          endColumn: 35,
        },
      ],
      output:
        "\n            import type Foo from 'foo';\n            class A {\n              @deco\n              foo: Foo;\n            }\n          ",
    },
    {
      name: "#232 import Foo from 'foo';",
      path: '/root/file.ts',
      text: "\n            import Foo from 'foo';\n            class A {\n              foo(@deco foo: Foo) {}\n            }\n          ",
      errors: [
        {
          message: 'All imports in the declaration are only used as types. Use `import type`.',
          line: 2,
          column: 13,
          endLine: 2,
          endColumn: 35,
        },
      ],
      output:
        "\n            import type Foo from 'foo';\n            class A {\n              foo(@deco foo: Foo) {}\n            }\n          ",
    },
    {
      name: "#235 import Foo from 'foo';",
      path: '/root/file.ts',
      text: "\n            import Foo from 'foo';\n            class A {\n              @deco\n              get foo() {}\n\n              set ['foo'](value: Foo) {}\n            }\n          ",
      errors: [
        {
          message: 'All imports in the declaration are only used as types. Use `import type`.',
          line: 2,
          column: 13,
          endLine: 2,
          endColumn: 35,
        },
      ],
      output:
        "\n            import type Foo from 'foo';\n            class A {\n              @deco\n              get foo() {}\n\n              set ['foo'](value: Foo) {}\n            }\n          ",
    },
    {
      name: "#236 import * as foo from 'foo';",
      path: '/root/file.ts',
      text: "\n            import * as foo from 'foo';\n            @deco\n            class A {\n              constructor(foo: foo.Foo) {}\n            }\n          ",
      errors: [
        {
          message: 'All imports in the declaration are only used as types. Use `import type`.',
          line: 2,
          column: 13,
          endLine: 2,
          endColumn: 40,
        },
      ],
      output:
        "\n            import type * as foo from 'foo';\n            @deco\n            class A {\n              constructor(foo: foo.Foo) {}\n            }\n          ",
    },
    {
      name: '#244 a member chain of a type literal key splits the object from the property',
      path: '/root/file.ts',
      text: "import { a, b } from 'x';\ntype T = { [a[b]]: string };",
      errors: [{ message: 'Imports "a" are only used as type.', line: 1, column: 1, endLine: 1, endColumn: 26 }],
      output: "import type { a} from 'x';\nimport { b } from 'x';\ntype T = { [a[b]]: string };",
    },
    {
      name: '#248 a type-only reference in a class heritage of a type position',
      path: '/root/file.ts',
      text: "import { Base } from 'foo';\ninterface A extends Base {}",
      errors: [
        {
          message: 'All imports in the declaration are only used as types. Use `import type`.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 28,
        },
      ],
      output: "import type { Base } from 'foo';\ninterface A extends Base {}",
    },
  ],
})

testRule(rule, {
  valid: [],
  invalid: [
    {
      name: 'a binding moved into a type import with a trailing comma',
      path: '/w/a.ts',
      text: "import type { A, } from 'x';\nimport { B, c } from 'x';\ntype T = A | B;\nc();\n",
      errors: [{ message: 'Imports "B" are only used as type.', line: 2, column: 1, endLine: 2, endColumn: 26 }],
      output: "import type { A,  B} from 'x';\nimport { c } from 'x';\ntype T = A | B;\nc();\n",
    },
    {
      name: 'a binding moved into an empty type import',
      path: '/w/a.ts',
      text: "import type {} from 'x';\nimport { B, c } from 'x';\ntype T = B;\nc();\n",
      errors: [{ message: 'Imports "B" are only used as type.', line: 2, column: 1, endLine: 2, endColumn: 26 }],
      output: "import type { B} from 'x';\nimport { c } from 'x';\ntype T = B;\nc();\n",
    },
    {
      name: 'a binding moved into the first of two type imports',
      path: '/w/a.ts',
      text: "import type { A } from 'x';\nimport type { B } from 'x';\nimport { C, d } from 'x';\ntype T = A | B | C;\nd();\n",
      errors: [{ message: 'Imports "C" are only used as type.', line: 3, column: 1, endLine: 3, endColumn: 26 }],
      output: "import type { A , C} from 'x';\nimport type { B } from 'x';\nimport { d } from 'x';\ntype T = A | B | C;\nd();\n",
    },
    {
      name: 'a default import split off before a comment later in the file',
      path: '/w/a.ts',
      text: "import A, { b } from 'x'; // note\ntype T = A;\nb();\n",
      errors: [{ message: 'Imports "A" are only used as type.', line: 1, column: 1, endLine: 1, endColumn: 26 }],
      output: "import type A from 'x';\nimport { b } from 'x'; // note\ntype T = A;\nb();\n",
    },
  ],
})
