import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-useless-assignment.ts'

// why: the previous linter read `/* globals */`, `/* exported */` and `/*lint */` comments, which no workspace file carries; those cases are left out.
testRule(rule, {
  valid: [
    {
      name: '#3 function foo() {',
      path: '/root/file.ts',
      text: "function foo() {\n            let v = 'used';\n            if (condition) {\n                v = 'used-2';\n                console.log(v);\n                return\n            }\n            console.log(v);\n        }",
    },
    {
      name: '#4 function foo() {',
      path: '/root/file.ts',
      text: "function foo() {\n            let v = 'used';\n            if (condition) {\n                console.log(v);\n            } else {\n                v = 'used-2';\n                console.log(v);\n            }\n        }",
    },
    {
      name: '#6 var foo = function () {',
      path: '/root/file.ts',
      text: "var foo = function () {\n            let v = 'used';\n            console.log(v);\n            v = 'used-2'\n            console.log(v);\n        }",
    },
    {
      name: '#7 var foo = () => {',
      path: '/root/file.ts',
      text: "var foo = () => {\n            let v = 'used';\n            console.log(v);\n            v = 'used-2'\n            console.log(v);\n        }",
    },
    {
      name: '#8 class foo {',
      path: '/root/file.ts',
      text: "class foo {\n            static {\n                let v = 'used';\n                console.log(v);\n                v = 'used-2'\n                console.log(v);\n            }\n        }",
    },
    {
      name: '#12 export function foo () {};',
      path: '/root/file.ts',
      text: "export function foo () {};\n        console.log(foo);\n        foo = 'unused like but exported';",
    },
    {
      name: '#14 export default function foo () {};',
      path: '/root/file.ts',
      text: "export default function foo () {};\n        console.log(foo);\n        foo = 'unused like but exported';",
    },
    {
      name: '#15 export default class foo {};',
      path: '/root/file.ts',
      text: "export default class foo {};\n        console.log(foo);\n        foo = 'unused like but exported';",
    },
    {
      name: "#16 let foo = 'used';",
      path: '/root/file.ts',
      text: "let foo = 'used';\n        export { foo };\n        console.log(foo);\n        foo = 'unused like but exported';",
    },
    {
      name: '#29 function foo() {',
      path: '/root/file.ts',
      text: "function foo() {\n            let a = 'used', b = 'used', c = 'used', d = 'used';\n            console.log(a, b, c, d);\n            ({ a, arr: [b, c, ...d] } = fn());\n            console.log(a, b, c, d);\n        }",
    },
    {
      name: '#30 function foo() {',
      path: '/root/file.ts',
      text: "function foo() {\n            let a = 'used', b = 'used', c = 'used';\n            console.log(a, b, c);\n            ({ a = 'unused', foo: b, ...c } = fn());\n            console.log(a, b, c);\n        }",
    },
    {
      name: '#32 function foo() {',
      path: '/root/file.ts',
      text: 'function foo() {\n            let a = { b: 42 };\n            console.log(a);\n            a.b++;\n        }',
    },
    {
      name: '#34 function foo () {',
      path: '/root/file.ts',
      text: "function foo () {\n            let v = 'used';\n            console.log(v);\n            setTimeout(() => console.log(v), 1);\n            v = 'used in other scope';\n        }",
    },
    {
      name: '#37 const bk = console;',
      path: '/root/file.ts',
      text: '\n            const bk = console;\n            console = { log () {} };\n            try {\n                // process\n            } finally {\n                console = bk;\n            }',
      language: { globals: { console: 'readonly' } },
    },
    {
      name: '#42 function App() {',
      path: '/root/react.tsx',
      text: '                function App() {\n                    const A = "";\n                    return <A/>;\n                }\n            ',
    },
    {
      name: '#46 a type query reads the assigned value',
      path: '/root/file.ts',
      text: 'let v = 1\nuse(v)\nv = 2\ntype T = typeof v\nexport type { T }',
    },
    {
      name: '#47 a value asserted on assignment is read afterwards',
      path: '/root/file.ts',
      text: 'let v = 1\nuse(v)\nv = 2 as number\nuse(v)',
    },
    {
      name: '#48 an assignment in a class field initializer belongs to another code path',
      path: '/root/file.ts',
      text: 'let v = 1\nclass C {\n  f = (v = 2)\n}\nuse(v, C)',
    },
    { name: '#53 a member assignment is not a variable assignment', path: '/root/file.ts', text: 'globalThis.x = 1\nuse(globalThis.x)' },
    {
      name: '#54 a declared ambient variable assigned and never read',
      path: '/root/file.ts',
      text: 'declare let ambient: number\nambient = 2',
    },
    {
      name: '#55 a compound assignment reads the value before the next one',
      path: '/root/file.ts',
      text: 'function f() {\n  let v = 1\n  v += 1\n  return v\n}',
    },
    {
      name: "#101 let v = 'init';",
      path: '/root/file.ts',
      text: "let v = 'init';\n        try {\n            v = callA();\n            try {\n                v = callB();\n            } catch (e) {\n                // ignore\n            }\n        } catch (e) {\n            // ignore\n        }\n        console.log(v)",
    },
    {
      name: '#104 function foo(){',
      path: '/root/file.ts',
      text: 'function foo(){\n            let bar;\n            try {\n                bar = 2;\n                unsafeFn();\n                return { error: undefined };\n            } catch {\n                return { bar }; \n            }\n        }   \n        function unsafeFn() {\n            throw new Error();\n        }',
    },
    {
      name: '#106 function foo(){',
      path: '/root/file.ts',
      text: 'function foo(){\n            let bar;\n            try {\n                bar = 2;\n                unsafeFn();\n                bar = 4;\n            } catch {\n               // handle error\n            }\n            return bar;\n        }   \n        function unsafeFn() {\n            throw new Error();\n        }',
    },
  ],
  invalid: [
    {
      name: '#73 function foo() {',
      path: '/root/file.ts',
      text: "function foo() {\n                let a = 'used', b = 'used', c = 'used', d = 'used';\n                console.log(a, b, c, d);\n                ({ a, arr: [b, c,, ...d] } = fn());\n                console.log(c);\n            }",
      errors: [
        { message: 'This assigned value is not used in subsequent statements.', line: 4, column: 20, endLine: 4, endColumn: 21 },
        { message: 'This assigned value is not used in subsequent statements.', line: 4, column: 29, endLine: 4, endColumn: 30 },
        { message: 'This assigned value is not used in subsequent statements.', line: 4, column: 39, endLine: 4, endColumn: 40 },
      ],
    },
    {
      name: '#80 function foo () {',
      path: '/root/file.ts',
      text: "function foo () {\n                let v = 'used';\n                console.log(v);\n                for (let i = 0; i < 10; i++) {\n                    v = 'unused';\n                    continue;\n                    console.log(v);\n                }\n            }\n            function bar () {\n                let v = 'used';\n                console.log(v);\n                for (let i = 0; i < 10; i++) {\n                    v = 'unused';\n                    break;\n                    console.log(v);\n                }\n            }",
      errors: [
        { message: 'This assigned value is not used in subsequent statements.', line: 5, column: 21, endLine: 5, endColumn: 22 },
        { message: 'This assigned value is not used in subsequent statements.', line: 14, column: 21, endLine: 14, endColumn: 22 },
      ],
    },
    {
      name: '#85 a parameter assigned twice before it is read',
      path: '/root/file.ts',
      text: 'function f(p: number) {\np = 2\np = 3\nreturn p\n}',
      errors: [{ message: 'This assigned value is not used in subsequent statements.', line: 2, column: 1, endLine: 2, endColumn: 2 }],
    },
    {
      name: '#90 a loop body assignment overwritten after the loop and the initial value it hides',
      path: '/root/file.ts',
      text: 'function f() {\nlet v = 0\nwhile (cond) { v = 1 }\nv = 2\nreturn v\n}',
      errors: [
        { message: 'This assigned value is not used in subsequent statements.', line: 2, column: 5, endLine: 2, endColumn: 6 },
        { message: 'This assigned value is not used in subsequent statements.', line: 3, column: 16, endLine: 3, endColumn: 17 },
      ],
    },
    {
      name: '#91 an initial value overwritten by every switch case',
      path: '/root/file.ts',
      text: 'function f() {\nlet v = 1\nswitch (obj) { case 1: v = 2; break; default: v = 3 }\nreturn v\n}',
      errors: [{ message: 'This assigned value is not used in subsequent statements.', line: 2, column: 5, endLine: 2, endColumn: 6 }],
    },
    {
      name: '#92 an initial value overwritten in a labelled block',
      path: '/root/file.ts',
      text: 'function f() {\nlet v = 1\nlabel: { v = 2; break label }\nreturn v\n}',
      errors: [{ message: 'This assigned value is not used in subsequent statements.', line: 2, column: 5, endLine: 2, endColumn: 6 }],
    },
    {
      name: '#95 a branch default assignment and the pattern assignment it follows are both overwritten',
      path: '/root/file.ts',
      text: 'let { a, b = cond ? (a = 2) : 0 } = obj\na = 3\nuse(a, b)',
      errors: [
        { message: 'This assigned value is not used in subsequent statements.', line: 1, column: 7, endLine: 1, endColumn: 8 },
        { message: 'This assigned value is not used in subsequent statements.', line: 1, column: 22, endLine: 1, endColumn: 23 },
      ],
    },
    {
      name: '#97 a class method is its own code path',
      path: '/root/file.ts',
      text: 'class K {\n  m() {\n    let q = 1\n    q = 2\n    return q\n  }\n}\nuse(K)',
      errors: [{ message: 'This assigned value is not used in subsequent statements.', line: 3, column: 9, endLine: 3, endColumn: 10 }],
    },
  ],
})

testRule(rule, {
  valid: [
    {
      name: 'a write on the right of a do-while test, read on the next pass and after the loop',
      path: '/root/file.ts',
      text: 'export function f(a: boolean): boolean {\n  let times = 3\n  do {\n    a = !a\n  } while (a && --times > 0)\n  return times === 0\n}\n',
    },
    {
      name: 'a write on the right of a while test whose body always returns, read after the loop',
      path: '/root/file.ts',
      text: 'export function f(x: boolean, g: () => number): number {\n  let y = 0\n  while (x && (y = g())) {\n    return 1\n  }\n  return y\n}\n',
    },
  ],
  invalid: [],
})
