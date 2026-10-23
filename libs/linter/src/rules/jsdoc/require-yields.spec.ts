import { testRule } from '../../testing/rule-tester'
import rule from './require-yields'

// why: the workspace runs the rule with its default options and settings, the cases with others are left out; a `with` statement is a syntax error to the new parser by design.
testRule(rule, {
  valid: [
    {
      name: '#76 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @yields {Array}\n           */\n          function * quux (bar) {\n            yield bar.doSomething(function * (baz) {\n              yield baz.corge();\n            })\n          }\n      ',
    },
    {
      name: '#78 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @override\n           */\n          function * quux (foo) {\n          }\n      ',
    },
    {
      name: '#96 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           *\n           */\n          const quux = async function * () {}\n      ',
    },
    {
      name: '#103 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @generator\n           */\n      ',
      options: { withGeneratorTag: true },
    },
    {
      name: '#116 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           *\n           */\n          function * quux (foo) {\n            const a = function * bar () {\n              yield foo;\n            }\n          }\n      ',
    },
  ],
  invalid: [
    {
      name: '#2 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           *\n           */\n          function * quux (foo) {\n            someLabel: {\n              yield foo;\n            }\n          }\n      ',
      errors: [{ message: 'Missing JSDoc @yields declaration.', line: 2, column: 11, endLine: 4, endColumn: 14 }],
    },
    {
      name: '#18 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @yields {undefined}\n           * @yields {void}\n           */\n          function * quux (foo) {\n\n            return foo;\n          }\n      ',
      errors: [{ message: 'Found more than one @yields declaration.', line: 2, column: 11, endLine: 5, endColumn: 14 }],
    },
    {
      name: '#29 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           *\n           */\n          function * quux () {\n            b ? yield false : true\n          }\n      ',
      errors: [{ message: 'Missing JSDoc @yields declaration.', line: 2, column: 11, endLine: 4, endColumn: 14 }],
    },
    {
      name: '#30 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           *\n           */\n          function * quux () {\n            try {\n              yield true;\n            } catch (err) {\n            }\n            yield;\n          }\n      ',
      errors: [{ message: 'Missing JSDoc @yields declaration.', line: 2, column: 11, endLine: 4, endColumn: 14 }],
    },
    {
      name: '#31 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           *\n           */\n          function * quux () {\n            try {\n            } finally {\n              yield true;\n            }\n            yield;\n          }\n      ',
      errors: [{ message: 'Missing JSDoc @yields declaration.', line: 2, column: 11, endLine: 4, endColumn: 14 }],
    },
    {
      name: '#34 /**',
      path: '/root/file.ts',
      text: "\n          /**\n           *\n           */\n          function * quux () {\n            switch (true) {\n            case 'abc':\n              yield true;\n            }\n            yield;\n          }\n      ",
      errors: [{ message: 'Missing JSDoc @yields declaration.', line: 2, column: 11, endLine: 4, endColumn: 14 }],
    },
    {
      name: '#36 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           *\n           */\n          function * quux () {\n            for (const i of abc) {\n              yield true;\n            }\n            yield;\n          }\n      ',
      errors: [{ message: 'Missing JSDoc @yields declaration.', line: 2, column: 11, endLine: 4, endColumn: 14 }],
    },
    {
      name: '#37 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           *\n           */\n          function * quux () {\n            for (const a in b) {\n              yield true;\n            }\n          }\n      ',
      errors: [{ message: 'Missing JSDoc @yields declaration.', line: 2, column: 11, endLine: 4, endColumn: 14 }],
    },
    {
      name: '#38 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           *\n           */\n          function * quux () {\n            for (let i=0; i<n; i+=1) {\n              yield true;\n            }\n          }\n      ',
      errors: [{ message: 'Missing JSDoc @yields declaration.', line: 2, column: 11, endLine: 4, endColumn: 14 }],
    },
    {
      name: '#39 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           *\n           */\n          function * quux () {\n            while(true) {\n              yield true\n            }\n          }\n      ',
      errors: [{ message: 'Missing JSDoc @yields declaration.', line: 2, column: 11, endLine: 4, endColumn: 14 }],
    },
    {
      name: '#40 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           *\n           */\n          function * quux () {\n            do {\n              yield true\n            }\n            while(true)\n          }\n      ',
      errors: [{ message: 'Missing JSDoc @yields declaration.', line: 2, column: 11, endLine: 4, endColumn: 14 }],
    },
    {
      name: '#43 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           *\n           */\n          function * quux () {\n            if (true) {\n              yield;\n            } else {\n              yield true;\n            }\n            yield;\n          }\n      ',
      errors: [{ message: 'Missing JSDoc @yields declaration.', line: 2, column: 11, endLine: 4, endColumn: 14 }],
    },
    {
      name: '#44 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           *\n           */\n          function * quux () {\n            if (false) {\n              return;\n            }\n            return yield true;\n          }\n      ',
      errors: [{ message: 'Missing JSDoc @yields declaration.', line: 2, column: 11, endLine: 4, endColumn: 14 }],
    },
    {
      name: '#45 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           *\n           */\n          function * quux () {\n            [yield true];\n          }\n      ',
      errors: [{ message: 'Missing JSDoc @yields declaration.', line: 2, column: 11, endLine: 4, endColumn: 14 }],
    },
    {
      name: '#46 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           *\n           */\n          function * quux () {\n            const [a = yield true] = [];\n          }\n      ',
      errors: [{ message: 'Missing JSDoc @yields declaration.', line: 2, column: 11, endLine: 4, endColumn: 14 }],
    },
    {
      name: '#47 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           *\n           */\n          function * quux () {\n            a || (yield true);\n          }\n      ',
      errors: [{ message: 'Missing JSDoc @yields declaration.', line: 2, column: 11, endLine: 4, endColumn: 14 }],
    },
    {
      name: '#48 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           *\n           */\n          function * quux () {\n            (r = yield true);\n          }\n      ',
      errors: [{ message: 'Missing JSDoc @yields declaration.', line: 2, column: 11, endLine: 4, endColumn: 14 }],
    },
    {
      name: '#50 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           *\n           */\n          function * quux () {\n            a, yield true;\n          }\n      ',
      errors: [{ message: 'Missing JSDoc @yields declaration.', line: 2, column: 11, endLine: 4, endColumn: 14 }],
    },
    {
      name: '#51 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           *\n           */\n          function * quux () {\n            +(yield);\n            [...yield];\n            [...+(yield true)];\n          }\n      ',
      errors: [{ message: 'Missing JSDoc @yields declaration.', line: 2, column: 11, endLine: 4, endColumn: 14 }],
    },
    {
      name: '#53 /**',
      path: '/root/file.ts',
      text: "\n          /**\n           *\n           */\n          function * quux () {\n            var obj = {\n              [someKey]: 'val',\n              anotherKey: yield true\n            }\n          }\n      ",
      errors: [{ message: 'Missing JSDoc @yields declaration.', line: 2, column: 11, endLine: 4, endColumn: 14 }],
    },
    {
      name: '#55 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           *\n           */\n          function * quux () {\n            `abc${yield true}`;\n          }\n      ',
      errors: [{ message: 'Missing JSDoc @yields declaration.', line: 2, column: 11, endLine: 4, endColumn: 14 }],
    },
    {
      name: '#56 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           *\n           */\n          function * quux () {\n            tagTemp`abc${yield true}`;\n          }\n      ',
      errors: [{ message: 'Missing JSDoc @yields declaration.', line: 2, column: 11, endLine: 4, endColumn: 14 }],
    },
    {
      name: '#57 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           *\n           */\n          function * quux () {\n            a.b[yield true].c;\n          }\n      ',
      errors: [{ message: 'Missing JSDoc @yields declaration.', line: 2, column: 11, endLine: 4, endColumn: 14 }],
    },
    {
      name: '#58 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           *\n           */\n          function * quux () {\n            abc?.[yield true].d?.e(yield true);\n          }\n      ',
      errors: [{ message: 'Missing JSDoc @yields declaration.', line: 2, column: 11, endLine: 4, endColumn: 14 }],
    },
    {
      name: '#60 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           *\n           */\n          function * quux () {\n            const {a = yield true} = obj;\n          }\n      ',
      errors: [{ message: 'Missing JSDoc @yields declaration.', line: 2, column: 11, endLine: 4, endColumn: 14 }],
    },
    {
      name: '#61 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           *\n           */\n          function * quux () {\n            import(yield true);\n          }\n      ',
      errors: [{ message: 'Missing JSDoc @yields declaration.', line: 2, column: 11, endLine: 4, endColumn: 14 }],
    },
    {
      name: '#64 /**',
      path: '/root/file.ts',
      text: '\n/**\n * Counts upwards.\n *\n * @param limit - Where to stop\n */\nexport function * count(limit: number): Generator<number> {\n  for (let index = 0; index < limit; index++) {\n    yield index\n  }\n}\n',
      errors: [{ message: 'Missing JSDoc @yields declaration.', line: 2, column: 1, endLine: 6, endColumn: 4 }],
    },
    {
      name: '#65 class Bag {',
      path: '/root/file.ts',
      text: '\nclass Bag {\n  /**\n   * Lists the items.\n   */\n  * items () {\n    yield 1\n  }\n}\n',
      errors: [{ message: 'Missing JSDoc @yields declaration.', line: 3, column: 3, endLine: 5, endColumn: 6 }],
    },
    {
      name: '#66 /**',
      path: '/root/file.ts',
      text: "\n/**\n * Streams chunks.\n */\nasync function * chunks () {\n  yield await Promise.resolve('x')\n}\n",
      errors: [{ message: 'Missing JSDoc @yields declaration.', line: 2, column: 1, endLine: 4, endColumn: 4 }],
    },
  ],
})
