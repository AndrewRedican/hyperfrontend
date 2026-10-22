import { testRule } from '../../testing/rule-tester.ts'
import rule from './require-returns-check.ts'

// why: the workspace runs the rule with its default options and settings, the cases with others are left out; a `with` statement is a syntax error to the new parser by design.
testRule(rule, {
  valid: [
    {
      name: '#44 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           *\n           */\n          function quux () {\n          }\n      ',
    },
    {
      name: '#46 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @returns {undefined} Foo.\n           */\n          function quux () {}\n      ',
    },
    {
      name: '#48 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @returns {Promise<void>}\n           */\n          async function quux() {}\n      ',
    },
    {
      name: '#49 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @returns {Promise<void>}\n           */\n          const quux = async function () {}\n      ',
    },
    {
      name: '#50 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @returns {Promise<void>}\n           */\n          const quux = async () => {}\n      ',
    },
    {
      name: '#54 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @interface\n           */\n          class Foo {\n            /**\n             * @returns {string}\n             */\n            bar () {\n            }\n          }\n      ',
    },
    {
      name: '#68 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @returns {true}\n           */\n          function quux () {\n            for (const a in b) {\n              return true;\n            }\n          }\n      ',
    },
    {
      name: '#70 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @returns {true}\n           */\n          function quux () {\n            loop: for (const a of b) {\n              return true;\n            }\n          }\n      ',
    },
    {
      name: '#71 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @returns {true}\n           */\n          function quux () {\n            for (let i=0; i<n; i+=1) {\n              return true;\n            }\n          }\n      ',
    },
    {
      name: '#73 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @returns {true}\n           */\n          function quux () {\n            do {\n              return true\n            }\n            while(true)\n          }\n      ',
    },
    {
      name: '#85 /**',
      path: '/root/file.ts',
      text: "\n      /**\n       * @param {unknown} val\n       * @returns { asserts val is number }\n       */\n      function assertNumber(val) {\n        assert(typeof val === 'number');\n      }\n      ",
    },
    {
      name: '#87 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * Reads a test fixture.\n       *\n       * @param path The path to resolve relative to the fixture base. It will be normalized for the\n       * operating system.\n       *\n       * @returns {SomeType} The file contents as buffer.\n       */\n      export function readFixture(path: string): Promise<Buffer>;\n      ',
    },
    {
      name: '#88 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * Reads a test fixture.\n       *\n       * @param path The path to resolve relative to the fixture base. It will be normalized for the\n       * operating system.\n       *\n       * @returns The file contents as buffer.\n       */\n      export function readFixture(path: string): Promise<Buffer> {\n        return new Promise(() => {});\n      }\n      ',
    },
    {
      name: '#91 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * @returns {SomeType} Foo.\n       */\n      const quux = () => new Promise((resolve) => {\n        resolve(3);\n      });\n      ',
    },
    {
      name: '#93 /**',
      path: '/root/file.ts',
      text: "\n          /**\n           * @returns {true}\n           */\n          function quux () {\n            if (true) {\n              return true;\n            }\n\n            throw new Error('Fail');\n          }\n      ",
    },
    {
      name: '#94 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * @returns Baz.\n       */\n      function foo() {\n          switch (true) {\n              default:\n                  switch (false) {\n                      default: break;\n                  }\n                  return "baz";\n          }\n      };\n      ',
    },
    {
      name: '#96 /**',
      path: '/root/file.ts',
      text: "\n      /**\n       * Parses the required header fields for the given SIP message.\n       *\n       * @param {string} logPrefix - The log prefix.\n       * @param {string} sipMessage - The SIP message.\n       * @param {string[]} headers - The header fields to be parsed.\n       * @returns {object} Object with parsed header fields.\n       */\n      function parseSipHeaders(logPrefix, sipMessage, headers) {\n          try {\n              return esappSip.parseHeaders(sipMessage, headers);\n          } catch (err) {\n              logger.error(logPrefix, 'Failed to parse');\n              return {};\n          }\n      }\n      ",
    },
    {
      name: '#97 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @returns {true}\n           */\n          function quux () {\n            try {\n            } catch (error) {\n            } finally {\n              return true;\n            }\n          }\n      ',
    },
    {
      name: '#98 /** Returns true.',
      path: '/root/file.ts',
      text: "\n      /** Returns true.\n       *\n       * @returns {boolean} true\n       */\n      function getTrue() {\n        try {\n          return true;\n        } finally {\n          console.log('returning...');\n        }\n      }\n      ",
    },
    {
      name: '#99 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * Maybe return a boolean.\n       * @returns {boolean|void} true, or undefined.\n       */\n      function maybeTrue() {\n        if (Math.random() > 0.5) {\n          return true;\n        }\n      }\n      ',
    },
    {
      name: '#101 /**',
      path: '/root/file.ts',
      text: "\n      /**\n       * @param {AST} astNode\n       * @returns {AST}\n       */\n      const getTSFunctionComment = function (astNode) {\n        switch (greatGrandparent.type) {\n        case 'VariableDeclarator':\n          if (greatGreatGrandparent.type === 'VariableDeclaration') {\n            return greatGreatGrandparent;\n          }\n\n        default:\n          return astNode;\n        }\n      };\n      ",
    },
    {
      name: '#102 const f =',
      path: '/root/file.ts',
      text: '\n      const f =\n        /**\n         * Description.\n         *\n         * @returns Result.\n         */\n        () => {\n          return function () {};\n        };\n      ',
    },
    {
      name: '#103 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * Description.\n       *\n       * @returns Result.\n       */\n      export function f(): string {\n        return "";\n\n        interface I {}\n      }\n      ',
    },
    {
      name: '#108 /**',
      path: '/root/file.ts',
      text: '\n        /**\n         * @returns {number}\n         */\n        function foo() {\n          for (;;) {\n            const n = Math.random();\n            if (n < 0.5) {\n              return n;\n            }\n          }\n        }\n      ',
    },
    {
      name: '#113 class Widget {',
      path: '/root/file.ts',
      text: '\nclass Widget {\n  /**\n   * @returns {Widget} The widget\n   */\n  constructor () {}\n}\n',
    },
    {
      name: '#114 /**',
      path: '/root/file.ts',
      text: '\n/**\n * @returns {Iterable<number>} The values\n */\nfunction * values () {\n  yield 1\n}\n',
    },
  ],
  invalid: [
    {
      name: '#4 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @returns {undefined} Foo.\n           * @returns {String} Foo.\n           */\n          function quux () {\n\n            return foo;\n          }\n        ',
      errors: [{ message: 'Found more than one @returns declaration.', line: 2, column: 11, endLine: 5, endColumn: 14 }],
    },
    {
      name: '#5 const language = {',
      path: '/root/file.ts',
      text: '\n      const language = {\n        /**\n         * @param {string} name\n         * @returns {string}\n         */\n        get name() {\n          this._name = name;\n        }\n      }\n      ',
      errors: [
        {
          message: 'JSDoc @returns declaration present but return expression not available in function.',
          line: 3,
          column: 9,
          endLine: 6,
          endColumn: 12,
        },
      ],
    },
    {
      name: '#8 /**',
      path: '/root/file.ts',
      text: "\n        /**\n         * @returns {string}\n         */\n        function f () {\n          function g() {\n            return 'foo'\n          }\n\n          () => {\n            return 5\n          }\n        }\n      ",
      errors: [
        {
          message: 'JSDoc @returns declaration present but return expression not available in function.',
          line: 2,
          column: 9,
          endLine: 4,
          endColumn: 12,
        },
      ],
    },
    {
      name: '#17 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @returns {never} Foo.\n           */\n          function quux () {\n            return undefined;\n          }\n      ',
      errors: [
        {
          message: 'JSDoc @returns declaration set with "never" but return expression is present in function.',
          line: 2,
          column: 11,
          endLine: 4,
          endColumn: 14,
        },
      ],
    },
    {
      name: '#19 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * Reads a test fixture.\n       *\n       * @param path The path to resolve relative to the fixture base. It will be normalized for the\n       * operating system.\n       *\n       * @returns The file contents as buffer.\n       */\n      export function readFixture(path: string): void;\n      ',
      errors: [
        {
          message: 'JSDoc @returns declaration present but return expression not available in function.',
          line: 2,
          column: 7,
          endLine: 9,
          endColumn: 10,
        },
      ],
    },
    {
      name: '#24 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @returns {true}\n           */\n          function quux () {\n            if (true) {\n            } else {\n              return;\n            }\n          }\n      ',
      errors: [
        {
          message: 'JSDoc @returns declaration present but return expression not available in function.',
          line: 2,
          column: 11,
          endLine: 4,
          endColumn: 14,
        },
      ],
    },
    {
      name: '#28 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @returns {true}\n           */\n          function quux () {\n            try {\n              return true;\n            } catch (error) {\n              return true;\n            } finally {\n              return;\n            }\n          }\n      ',
      errors: [
        {
          message: 'JSDoc @returns declaration present but return expression not available in function.',
          line: 2,
          column: 11,
          endLine: 4,
          endColumn: 14,
        },
      ],
    },
    {
      name: '#29 /**',
      path: '/root/file.ts',
      text: "\n          /**\n           * @returns {true}\n           */\n          function quux () {\n            if (true) {\n              throw new Error('abc');\n            }\n\n            throw new Error('def');\n          }\n      ",
      errors: [
        {
          message: 'JSDoc @returns declaration present but return expression not available in function.',
          line: 2,
          column: 11,
          endLine: 4,
          endColumn: 14,
        },
      ],
    },
    {
      name: '#32 /**',
      path: '/root/file.ts',
      text: '\n        /**\n         * @returns {number}\n         */\n        function foo() {\n          let n = 1;\n          while (n > 0.5) {\n            n = Math.random();\n            if (n < 0.2) {\n              return n;\n            }\n          }\n        }\n      ',
      errors: [
        {
          message: 'JSDoc @returns declaration present but return expression not available in function.',
          line: 2,
          column: 9,
          endLine: 4,
          endColumn: 12,
        },
      ],
    },
  ],
})
