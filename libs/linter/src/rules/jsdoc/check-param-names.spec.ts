import type { InvalidCase } from '../../testing/rule-tester'
import { testRule } from '../../testing/rule-tester'
import rule from './check-param-names'

// why: the workspace runs the rule with its default options and settings; the cases with others are left out.
testRule(rule, {
  valid: [
    {
      name: '#65 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           *\n           */\n          function quux (foo) {\n\n          }\n      ',
    },
    {
      name: '#74 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @param foo\n           * @param foo."a-b"\n           * @param foo.b\n           */\n          function quux ({"a-b": A, b}) {\n\n          }\n      ',
    },
    {
      name: '#76 /**',
      path: '/root/file.ts',
      text: "\n          /**\n           * Assign the project to a list of employees.\n           * @param {object[]} employees - The employees who are responsible for the project.\n           * @param {string} employees[].name - The name of an employee.\n           * @param {string} employees[].department - The employee's department.\n           */\n          function assign (employees) {\n\n          };\n      ",
    },
    {
      name: '#85 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * @param options\n       * @param options.foo\n       */\n      function quux ({foo, ...extra}) {\n      }\n      ',
    },
    {
      name: '#87 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * Converts an SVGRect into an object.\n       * @param {SVGRect} bbox - a SVGRect\n       */\n      const bboxToObj = function ({x, y, width, height}) {\n        return {x, y, width, height};\n      };\n      ',
    },
    {
      name: '#89 class CSS {',
      path: '/root/file.ts',
      text: '\n      class CSS {\n        /**\n         * Set one or more CSS properties for the set of matched elements.\n         *\n         * @param {Object} propertyObject - An object of property-value pairs to set.\n         */\n        setCssObject(propertyObject: {[key: string]: string | number}): void {\n        }\n      }\n      ',
    },
    {
      name: '#90 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * Logs a string.\n       *\n       * @param input - String to output.\n       */\n      export default function (input: {\n        [foo: string]: { a: string; b: string };\n      }): void {\n        input;\n      }\n      ',
    },
    {
      name: '#91 export class Thing {',
      path: '/root/file.ts',
      text: '\n      export class Thing {\n        foo: any;\n\n        /**\n         * @param {} C\n         */\n        constructor(C: { new (): any }) {\n          this.foo = new C();\n        }\n      }\n      ',
    },
    {
      name: '#93 class A {',
      path: '/root/file.ts',
      text: '\n      class A {\n        /**\n         * Show a prompt.\n         * @param hideButton true if button should be hidden, false otherwise\n         * @param onHidden delegate to call when the prompt is hidden\n         */\n        public async showPrompt(hideButton: boolean, onHidden: {(): void}): Promise<void>\n        {\n        }\n      }\n',
    },
    {
      name: '#94 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * Description.\n       * @param {Object} options Options.\n       * @param {FooBar} options.foo foo description.\n       */\n      function quux ({ foo: { bar }}) {}\n      ',
    },
    {
      name: '#97 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * Item\n       *\n       * @param {object} props\n       * @param {object} props.data - case data\n       * @param {string} props.data.className - additional css class\n       * @param props.val\n       */\n      export default function Item({\n        data: {\n          className,\n        } = {},\n        val = 4\n      }) {\n      }\n      ',
    },
    {
      name: '#98 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * @param obj\n       * @param obj.data\n       * @param obj.data."0"\n       * @param obj.data."1"\n       * @param obj.data."2"\n       * @param obj.defaulting\n       * @param obj.defaulting."0"\n       * @param obj.defaulting."1"\n       */\n      function Item({\n        data: [foo, bar, ...baz],\n        defaulting: [quux, xyz] = []\n      }) {\n      }\n      ',
    },
    {
      name: '#101 class A {',
      path: '/root/file.ts',
      text: '\n      class A {\n          /**\n           * @param cfg\n           * @param cfg.abc\n           */\n          constructor({\n              [new.target.prop]: cX,\n              abc\n          }) {\n          }\n      }\n      ',
    },
    {
      name: '#102 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * @param root\n       * @param root."0" Ignored\n       * @param root."1" Our "b"\n       */\n      const foo = ([, b]) => b;\n      ',
    },
    {
      name: '#106 class A {',
      path: '/root/file.ts',
      text: '\n      class A {\n        /**\n         * Helper function\n         * @param collisionFunc\n         */\n        @Exported\n        public registerCustomPickup(\n          collisionFunc: (this: void, player: EntityPlayer) => boolean = () => true,\n        ): void {}\n       }\n      ',
    },
    {
      name: '#107 declare global {',
      path: '/root/file.ts',
      text: '\n      declare global {\n        /**\n         * @param r Range is 0-1.\n         * @param g Range is 0-1.\n         * @param b Range is 0-1.\n         */\n        function Color(\n          this: void,\n          r: float,\n          g: float,\n          b: float,\n        ): Color;\n      }\n      ',
    },
    {
      name: '#112 /**',
      path: '/root/file.ts',
      text: '\n        /**\n         * @param type Type\n         * @param arg Arg\n         */\n        export function fn(...[type, arg]: FnArgs): void {\n          // ...\n        }\n      ',
    },
  ],
  invalid: [
    {
      name: '#1 /**',
      path: '/root/file.ts',
      text: "\n          /**\n           * @param Foo\n           */\n          function quux (foo = 'FOO') {\n\n          }\n      ",
      errors: [{ message: 'Expected @param names to be "foo". Got "Foo".', line: 3, column: 1, endLine: 3, endColumn: 1 }],
    },
    {
      name: '#4 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @param Foo.Bar\n           */\n          function quux (foo) {\n\n          }\n      ',
      errors: [
        { message: '@param path declaration ("Foo.Bar") appears before any real parameter.', line: 3, column: 1, endLine: 3, endColumn: 1 },
      ],
    },
    {
      name: '#5 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @param foo\n           * @param Foo.Bar\n           */\n          function quux (foo) {\n\n          }\n      ',
      errors: [
        {
          message: '@param path declaration ("Foo.Bar") root node name ("Foo") does not match previous real parameter name ("foo").',
          line: 4,
          column: 1,
          endLine: 4,
          endColumn: 1,
        },
      ],
    },
    {
      name: '#9 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @param foo\n           * @param bar\n           */\n          function quux (foo) {\n\n          }\n      ',
      errors: [{ message: '@param "bar" does not match an existing function parameter.', line: 4, column: 1, endLine: 4, endColumn: 1 }],
    },
    {
      name: '#15 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @param cfg\n           * @param cfg.foo\n           * @param cfg.foo\n           */\n          function quux ({foo}) {\n\n          }\n      ',
      errors: [{ message: 'Duplicate @param "cfg.foo"', line: 5, column: 1, endLine: 5, endColumn: 1 }],
    },
    {
      name: '#23 export class SomeClass {',
      path: '/root/file.ts',
      text: '\n        export class SomeClass {\n          /**\n           * @param prop\n           */\n          constructor(private property: string) {}\n        }\n      ',
      errors: [{ message: 'Expected @param names to be "property". Got "prop".', line: 4, column: 1, endLine: 4, endColumn: 1 }],
    },
    {
      name: '#25 export class SomeClass {',
      path: '/root/file.ts',
      text: '\n        export class SomeClass {\n          /**\n           * @param prop\n           * @param prop.foo\n           * @param prop.bar\n           */\n          constructor(options: { foo: string, bar: string }) {}\n        }\n      ',
      errors: [
        { message: '@param "prop" does not match parameter name "options"', line: 4, column: 1, endLine: 4, endColumn: 1 },
        { message: 'Missing @param "options.foo"', line: 4, column: 1, endLine: 4, endColumn: 1 },
        { message: 'Missing @param "options.bar"', line: 4, column: 1, endLine: 4, endColumn: 1 },
        { message: '@param "prop.foo" does not exist on prop', line: 5, column: 1, endLine: 5, endColumn: 1 },
        { message: '@param "prop.bar" does not exist on prop', line: 6, column: 1, endLine: 6, endColumn: 1 },
      ],
    },
    {
      name: '#28 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @param {Error} error Exit code\n           * @param {number} [code = 1] Exit code\n           */\n          function quux (error, cde = 1) {\n          };\n      ',
      errors: [{ message: 'Expected @param names to be "error, cde". Got "error, code".', line: 4, column: 1, endLine: 4, endColumn: 1 }],
    },
    {
      name: '#29 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @param foo\n           */\n          function quux ([a, b] = []) {\n\n          }\n      ',
      errors: [
        { message: 'Missing @param "foo."0""', line: 3, column: 1, endLine: 3, endColumn: 1 },
        { message: 'Missing @param "foo."1""', line: 3, column: 1, endLine: 3, endColumn: 1 },
      ],
    },
    {
      name: '#35 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * Testing\n       *\n       * @param options\n       * @param options.one One\n       * @param options.two Two\n       * @param options.four Four\n       */\n      function testingEslint(options: {\n        one: string;\n        two: string;\n        three: string;\n      }): string {\n        return one + two + three;\n      }\n      ',
      errors: [
        { message: 'Missing @param "options.three"', line: 5, column: 1, endLine: 5, endColumn: 1 },
        { message: '@param "options.four" does not exist on options', line: 8, column: 1, endLine: 8, endColumn: 1 },
      ],
    },
    {
      name: '#42 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @param {object} cfg\n           * @param {string} cfg.foo\n           * @param {string} cfg.bar\n           * @param {object} cfg.extra\n           */\n          function quux ({foo}) {\n\n          }\n      ',
      errors: [
        { message: '@param "cfg.bar" does not exist on cfg', line: 5, column: 1, endLine: 5, endColumn: 1 },
        { message: '@param "cfg.extra" does not exist on cfg', line: 6, column: 1, endLine: 6, endColumn: 1 },
      ],
    },
    {
      name: '#44 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @param {object} root\n           * @param {object} root.cfg\n           * @param {object} root.cfg.a\n           * @param {string} root.cfg.a.foo\n           * @param {string} root.cfg.a.bar\n           * @param {object} root.cfg.a.extra\n           */\n          function quux ({cfg: {a: {foo}}}) {\n\n          }\n      ',
      errors: [
        { message: '@param "root.cfg.a.bar" does not exist on root', line: 7, column: 1, endLine: 7, endColumn: 1 },
        { message: '@param "root.cfg.a.extra" does not exist on root', line: 8, column: 1, endLine: 8, endColumn: 1 },
      ],
    },
    {
      name: '#48 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * @param barr This is the description of bar. Oops, we misspelled "bar" as "barr".\n       */\n      declare function foo(bar: number)\n      ',
      errors: [{ message: 'Expected @param names to be "bar". Got "barr".', line: 3, column: 1, endLine: 3, endColumn: 1 }],
    },
    {
      name: '#53 export interface B {',
      path: '/root/file.ts',
      text: '\n        export interface B {\n            /**\n             * @param paramA Something something\n             */\n            methodB(paramB: string): void\n        };\n      ',
      errors: [{ message: 'Expected @param names to be "paramB". Got "paramA".', line: 4, column: 1, endLine: 4, endColumn: 1 }],
    },
    {
      name: '#54 interface A {',
      path: '/root/file.ts',
      text: '\n        interface A {\n          /**\n           * @param params Values for the placeholders\n           */\n          getText(key: string, ...params: string[]): string\n        }\n      ',
      errors: [{ message: 'Expected @param names to be "key, ...params". Got "params".', line: 4, column: 1, endLine: 4, endColumn: 1 }],
    },
    {
      name: '#55 /**',
      path: '/root/file.ts',
      text: '\n        /**\n         * @param arg Arg\n         */\n        export function fn(...[type, arg]: FnArgs): void {\n          // ...\n        }\n      ',
      errors: [{ message: 'Expected @param name to be "type". Got "arg".', line: 3, column: 1, endLine: 3, endColumn: 1 }],
    },
    {
      name: '#61 /**',
      path: '/root/file.ts',
      text: '\n/**\n * @param options - The options\n * @param options.known - A known property\n * @param options.unknown - Not destructured\n */\nfunction take({ known }: { known: string }) {}\n',
      errors: [{ message: '@param "options.unknown" does not exist on options', line: 5, column: 1, endLine: 5, endColumn: 1 }],
    },
    {
      name: '#64 /**',
      path: '/root/file.ts',
      text: '\n/**\n * Formats a value.\n *\n * @param value - The value to format\n * @param options - How to format it\n * @returns The formatted text\n */\nexport const format = (value: unknown, options: { radix: number }): string => String(value)\n',
      errors: [{ message: 'Missing @param "options.radix"', line: 5, column: 1, endLine: 5, endColumn: 1 }],
    },
  ],
})

/**
 * A block naming one parameter `a`, before a function with the given parameters.
 *
 * @param name - What the parameters exercise
 * @param params - The parameter list's source
 * @param expected - The names the message expects
 * @returns The case
 */
function misnamed(name: string, params: string, expected: string): InvalidCase {
  return {
    name,
    path: '/root/file.ts',
    text: `/**\n * @param a - A\n */\nfunction f(${params}) {}`,
    errors: [{ message: `Expected @param names to be "${expected}". Got "a".`, line: 2, column: 1, endLine: 2, endColumn: 1 }],
  }
}

testRule(rule, {
  valid: [],
  invalid: [misnamed('a destructured parameter no tag names', 'b, { c }', 'b, '), misnamed('a rest tuple', 'b, ...[c, d]', 'b, ...c,d')],
})
