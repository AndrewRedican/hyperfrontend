import { testRule } from '../../testing/rule-tester'
import rule from './require-yields-check'

// why: the workspace runs the rule with its default options and settings, the cases with others are left out; a `with` statement is a syntax error to the new parser by design.
testRule(rule, {
  valid: [
    {
      name: '#3 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           *\n           */\n          function * quux () {\n          }\n      ',
    },
    {
      name: '#4 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @yields {undefined} Foo.\n           */\n          function * quux () {}\n      ',
    },
    {
      name: '#6 /**',
      path: '/root/file.ts',
      text: "\n          /**\n           * @yields Foo.\n           * @abstract\n           */\n          function * quux () {\n            throw new Error('must be implemented by subclass!');\n          }\n      ",
    },
    {
      name: '#9 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @interface\n           */\n          class Foo {\n            /**\n             * @yields {string}\n             */\n            * bar () {\n            }\n          }\n      ',
    },
    {
      name: '#19 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @yields {true}\n           */\n          function * quux () {\n            try {\n            } finally {\n              yield true;\n            }\n            yield;\n          }\n      ',
    },
    {
      name: '#21 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @yields {true}\n           */\n          function * quux () {\n            try {\n              something();\n            } catch (err) {\n              yield true;\n            }\n            yield;\n          }\n      ',
    },
    {
      name: '#22 /**',
      path: '/root/file.ts',
      text: "\n          /**\n           * @yields {true}\n           */\n          function * quux () {\n            switch (true) {\n            case 'abc':\n              yield true;\n            }\n            yield;\n          }\n      ",
    },
    {
      name: '#24 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @yields {true}\n           */\n          function * quux () {\n            for (const i of abc) {\n              yield true;\n            }\n            yield;\n          }\n      ',
    },
    {
      name: '#25 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @yields {true}\n           */\n          function * quux () {\n            for (const a in b) {\n              yield true;\n            }\n          }\n      ',
    },
    {
      name: '#26 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @yields {true}\n           */\n          function * quux () {\n            for (let i=0; i<n; i+=1) {\n              yield true;\n            }\n          }\n      ',
    },
    {
      name: '#27 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @yields {true}\n           */\n          function * quux () {\n            while(true) {\n              yield true\n            }\n          }\n      ',
    },
    {
      name: '#28 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @yields {true}\n           */\n          function * quux () {\n            do {\n              yield true\n            }\n            while(true)\n          }\n      ',
    },
    {
      name: '#29 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @yields {true}\n           */\n          function * quux () {\n            if (true) {\n              yield;\n            }\n            yield true;\n          }\n      ',
    },
    {
      name: '#32 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @yields {true}\n           */\n          function * quux () {\n            if (true) {\n              yield;\n            } else {\n              yield true;\n            }\n            yield;\n          }\n      ',
    },
    {
      name: '#37 /**',
      path: '/root/file.ts',
      text: '\n/**\n * Counts upwards.\n *\n * @param limit - Where to stop\n * @yields The next count\n */\nexport function * count(limit: number): Generator<number> {\n  for (let index = 0; index < limit; index++) {\n    yield index\n  }\n}\n',
    },
  ],
  invalid: [
    {
      name: '#52 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @yields {undefined} Foo.\n           * @yields {String} Foo.\n           */\n          function * quux () {\n\n            yield foo;\n          }\n        ',
      errors: [{ message: 'Found more than one @yields declaration.', line: 2, column: 11, endLine: 5, endColumn: 14 }],
    },
    {
      name: '#53 class Foo {',
      path: '/root/file.ts',
      text: '\n          class Foo {\n            /**\n             * @yields {string}\n             */\n            * bar () {\n            }\n          }\n      ',
      errors: [
        {
          message: 'JSDoc @yields declaration present but yield expression not available in function.',
          line: 3,
          column: 13,
          endLine: 5,
          endColumn: 16,
        },
      ],
    },
    {
      name: '#56 /**',
      path: '/root/file.ts',
      text: "\n        /**\n         * @yields {string}\n         */\n        function * f () {\n          function * g() {\n            yield 'foo'\n          }\n        }\n      ",
      errors: [
        {
          message: 'JSDoc @yields declaration present but yield expression not available in function.',
          line: 2,
          column: 9,
          endLine: 4,
          endColumn: 12,
        },
      ],
    },
    {
      name: '#57 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @yields {Promise<void>}\n           */\n          async function * quux() {}\n      ',
      errors: [
        {
          message: 'JSDoc @yields declaration present but yield expression not available in function.',
          line: 2,
          column: 11,
          endLine: 4,
          endColumn: 14,
        },
      ],
    },
    {
      name: '#58 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @yields {Promise<void>}\n           */\n          const quux = async function * () {}\n      ',
      errors: [
        {
          message: 'JSDoc @yields declaration present but yield expression not available in function.',
          line: 2,
          column: 11,
          endLine: 4,
          endColumn: 14,
        },
      ],
    },
    {
      name: '#59 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @yields {never} Foo.\n           */\n          function * quux () {\n            yield 5;\n          }\n      ',
      errors: [
        {
          message: 'JSDoc @yields declaration set with "never" but yield expression is present in function.',
          line: 2,
          column: 11,
          endLine: 4,
          endColumn: 14,
        },
      ],
    },
    {
      name: '#61 /**',
      path: '/root/file.ts',
      text: '\n/**\n * Counts upwards.\n *\n * @yields The next count\n */\nexport function * count(): Generator<number> {\n  return\n}\n',
      errors: [
        {
          message: 'JSDoc @yields declaration present but yield expression not available in function.',
          line: 2,
          column: 1,
          endLine: 6,
          endColumn: 4,
        },
      ],
    },
  ],
})
