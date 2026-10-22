import { testRule } from '../../testing/rule-tester.ts'
import rule from './informative-docs.ts'

// why: the workspace runs the rule with its default options and settings; the cases with others are left out.
testRule(rule, {
  valid: [
    {
      name: '#3 /** Informative info user id. */',
      path: '/root/file.ts',
      text: '\n        /** Informative info user id. */\n        let userId: string;\n      ',
    },
    {
      name: '#7 const value = {',
      path: '/root/file.ts',
      text: "\n        const value = {\n          /**\n           * the truthiness of the prop.\n           */\n          ['prop']: true,\n        }\n      ",
    },
    {
      name: '#8 /**',
      path: '/root/file.ts',
      text: '\n        /**\n         * abc def ghi\n         */\n        const abc = function def() {}\n      ',
    },
    {
      name: '#14 class Abc {',
      path: '/root/file.ts',
      text: '\n        class Abc {\n          /** ghi */\n          abstract accessor def;\n        }\n      ',
    },
    {
      name: '#15 class Abc {',
      path: '/root/file.ts',
      text: '\n        class Abc {\n          /** ghi */\n          abstract def();\n        }\n      ',
    },
    {
      name: '#16 class Abc {',
      path: '/root/file.ts',
      text: '\n        class Abc {\n          /** ghi */\n          abstract def;\n        }\n      ',
    },
    { name: '#17 /** abc */', path: '/root/file.ts', text: '\n        /** abc */\n        namespace Def {}\n      ' },
    { name: '#19 /** abc */', path: '/root/file.ts', text: '\n        /** abc */\n        declare function def();\n      ' },
    {
      name: '#21 enum Abc {',
      path: '/root/file.ts',
      text: '\n        enum Abc {\n          /** def */\n          ghi,\n        }\n      ',
    },
    { name: '#22 /** abc */', path: '/root/file.ts', text: '\n        /** abc */\n        interface Def {}\n      ' },
    { name: '#23 /** abc */', path: '/root/file.ts', text: '\n        /** abc */\n        type Def = {};\n      ' },
    {
      name: '#25 /**',
      path: '/root/file.ts',
      text: '\n        /**\n         * count\n         *\n         * @unknownTag - increment value\n         */\n        let value = 3;\n      ',
    },
    {
      name: '#28 /**',
      path: '/root/file.ts',
      text: '\n        /**\n         * @class\n         *\n         * @param {number} value - Some useful text\n         */\n        function MyAmazingThing(value) {}\n      ',
    },
    {
      name: '#31 /**',
      path: '/root/file.ts',
      text: '\n/**\n * Formats a value as text for the console.\n *\n * @param value - Anything printable\n * @returns The text, trimmed\n */\nexport function format(value: unknown): string {\n  return String(value).trim()\n}\n',
    },
  ],
  invalid: [
    {
      name: '#45 const _ = class Abc {',
      path: '/root/file.ts',
      text: '\n        const _ = class Abc {\n          /** the abc def! */\n          def;\n        }\n      ',
      errors: [{ message: 'This description only repeats the name it describes.', line: 3, column: 11, endLine: 3, endColumn: 30 }],
    },
    {
      name: '#46 class Abc {',
      path: '/root/file.ts',
      text: '\n        class Abc {\n          /** the abc def! */\n          def() {};\n        }\n      ',
      errors: [{ message: 'This description only repeats the name it describes.', line: 3, column: 11, endLine: 3, endColumn: 30 }],
    },
    {
      name: '#60 /** @param {number} param - the param */',
      path: '/root/file.ts',
      text: '\n        /** @param {number} param - the param */\n        function takesOne(param) {}\n      ',
      errors: [{ message: 'This tag description only repeats the name it describes.', line: 2, column: 1, endLine: 2, endColumn: 1 }],
    },
    {
      name: '#62 /**',
      path: '/root/file.ts',
      text: '\n        /**\n         * takes one\n         * @other param - takes one\n         */\n        function takesOne(param) {}\n      ',
      errors: [
        { message: 'This description only repeats the name it describes.', line: 2, column: 9, endLine: 5, endColumn: 12 },
        { message: 'This tag description only repeats the name it describes.', line: 4, column: 1, endLine: 4, endColumn: 1 },
      ],
    },
    {
      name: '#65 /**',
      path: '/root/file.ts',
      text: '\n        /**\n         * package name from path\n         */\n        export function packageNameFromPath(path) {\n          const base = basename(path);\n          return /^v\\d+(\\.\\d+)?$/.exec(base) || /^ts\\d\\.\\d/.exec(base) ? basename(dirname(path)) : base;\n        }\n      ',
      errors: [{ message: 'This description only repeats the name it describes.', line: 2, column: 9, endLine: 4, endColumn: 12 }],
    },
    {
      name: '#66 /**',
      path: '/root/file.ts',
      text: '\n        /**\n         * package name from path\n         */\n        export default function packageNameFromPath(path) {\n          const base = basename(path);\n          return /^v\\d+(\\.\\d+)?$/.exec(base) || /^ts\\d\\.\\d/.exec(base) ? basename(dirname(path)) : base;\n        }\n      ',
      errors: [{ message: 'This description only repeats the name it describes.', line: 2, column: 9, endLine: 4, endColumn: 12 }],
    },
  ],
})
