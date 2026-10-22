import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-useless-catch.ts'

testRule(rule, {
  valid: [
    {
      name: '#1 try {',
      path: '/root/file.ts',
      text: '\n            try {\n                foo();\n            } catch (err) {\n                console.error(err);\n            }\n        ',
    },
    {
      name: '#8 try {',
      path: '/root/file.ts',
      text: '\n                try {\n                    foo();\n                } catch ({ err }) {\n                    throw err;\n                }\n            ',
    },
    {
      name: '#9 try {',
      path: '/root/file.ts',
      text: '\n                try {\n                    foo();\n                } catch ([ err ]) {\n                    throw err;\n                }\n            ',
    },
    {
      name: '#11 try {',
      path: '/root/file.ts',
      text: "\n                try {\n                    throw new Error('foo');\n                } catch {\n                    throw new Error('foo');\n                }\n            ",
    },
    {
      name: '#12 a rethrow wrapped in a nested block is not the first statement',
      path: '/root/file.ts',
      text: 'try { foo() } catch (err) { { throw err } }',
    },
    {
      name: '#13 a rethrow under a type assertion throws a different expression',
      path: '/root/file.ts',
      text: 'try { foo() } catch (err) { throw err as Error }',
    },
    {
      name: '#14 a rethrow under a non-null assertion throws a different expression',
      path: '/root/file.ts',
      text: 'try { foo() } catch (err) { throw err! }',
    },
    {
      name: '#16 a catch without a parameter that throws an outer variable',
      path: '/root/file.ts',
      text: 'let err; try { foo() } catch { throw err }',
    },
  ],
  invalid: [
    {
      name: '#20 try {',
      path: '/root/file.ts',
      text: '\n                try {\n                    foo();\n                } catch (err) {\n                    /* some comment */\n                    throw err;\n                } finally {\n                    foo();\n                }\n            ',
      errors: [{ message: 'Unnecessary catch clause.', line: 4, column: 19, endLine: 7, endColumn: 18 }],
    },
    {
      name: '#21 async () => {',
      path: '/root/file.ts',
      text: '\n                async () => {\n                    try {\n                        await doSomething();\n                    } catch (e) {\n                        throw e;\n                    }\n                }\n            ',
      errors: [{ message: 'Unnecessary try/catch wrapper.', line: 3, column: 21, endLine: 7, endColumn: 22 }],
    },
    {
      name: '#24 a typed catch parameter is still a plain rethrow',
      path: '/root/file.ts',
      text: 'try { foo() } catch (err: unknown) { throw err }',
      errors: [{ message: 'Unnecessary try/catch wrapper.', line: 1, column: 1, endLine: 1, endColumn: 49 }],
    },
    {
      name: '#25 parentheses around the rethrown identifier do not hide it',
      path: '/root/file.ts',
      text: 'try { foo() } catch (err) { throw (err) }',
      errors: [{ message: 'Unnecessary try/catch wrapper.', line: 1, column: 1, endLine: 1, endColumn: 42 }],
    },
  ],
})
