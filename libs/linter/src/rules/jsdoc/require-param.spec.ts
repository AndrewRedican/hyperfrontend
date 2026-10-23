import type { InvalidCase } from '../../testing/rule-tester'
import { testRule } from '../../testing/rule-tester'
import rule from './require-param'

// why: the workspace runs the rule with its default options and settings; the cases with others are left out.
testRule(rule, {
  valid: [
    {
      name: '#91 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @override\n           * @param foo\n           */\n          function quux (foo) {\n\n          }\n      ',
    },
    {
      name: '#116 // issue 182: optional chaining',
      path: '/root/file.ts',
      text: '\n          // issue 182: optional chaining\n          /** @const {boolean} test */\n          const test = something?.find(_ => _)\n      ',
    },
    {
      name: '#119 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @override\n           */\n          var A = class {\n            /**\n              *\n              */\n            quux (foo) {\n\n            }\n          }\n      ',
    },
    {
      name: '#126 export abstract class StephanPlugin<O, D> {',
      path: '/root/file.ts',
      text: '\n        export abstract class StephanPlugin<O, D> {\n\n        /**\n         * Called right after Stephan loads the plugin file.\n         *\n         * @example\n         *```typescript\n         * type Options = {\n         *      verbose?: boolean;\n         *      token?: string;\n         * }\n         * ```\n         *\n         * Note that your Options type should only have optional properties...\n         *\n         * @param args Arguments compiled and provided by StephanClient.\n         * @param args.options The options as provided by the user, or an empty object if not provided.\n         * @param args.client The options as provided by the user, or an empty object if not provided.\n         * @param args.client.name The name of the client.\n         * @param defaultOptions The default options as provided by the plugin, or an empty object.\n         */\n        public constructor({ options, client: { name } }: {\n            options: O;\n            client: { name: string };\n        }, defaultOptions: D) {\n\n        }\n    }\n      ',
    },
    {
      name: '#128 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * @param cfg\n       * @param cfg.num\n       */\n      function quux ({num, ...extra}) {\n      }\n      ',
    },
    {
      name: '#131 /**',
      path: '/root/file.ts',
      text: '\n      /**\n      * Converts an SVGRect into an object.\n      * @param {SVGRect} bbox - a SVGRect\n      */\n      const bboxToObj = function ({x, y, width, height}) {\n        return {x, y, width, height};\n      };\n      ',
    },
    {
      name: '#133 class CSS {',
      path: '/root/file.ts',
      text: '\n      class CSS {\n        /**\n         * Set one or more CSS properties for the set of matched elements.\n         *\n         * @param {Object} propertyObject - An object of property-value pairs to set.\n         */\n        setCssObject(propertyObject: {[key: string]: string | number}): void {\n        }\n      }\n      ',
    },
    {
      name: '#136 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @param root\n           * @param root.foo\n           */\n          function quux ({"foo": bar}) {\n\n          }\n      ',
    },
    {
      name: '#138 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * Description.\n       * @param {string} b Description `/**`.\n       */\n      module.exports = function a(b) {\n        console.info(b);\n      };\n      ',
    },
    {
      name: '#141 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * @param obj\n       * @param obj.data\n       * @param obj.data."0"\n       * @param obj.data."1"\n       * @param obj.data."2"\n       * @param obj.defaulting\n       * @param obj.defaulting."0"\n       * @param obj.defaulting."1"\n       */\n      function Item({\n        data: [foo, bar, ...baz],\n        defaulting: [quux, xyz] = []\n      }) {\n      }\n      ',
    },
    {
      name: '#146 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * @param this The this object\n       * @param bar number to return\n       * @returns number returned back to caller\n       */\n      function foo(this: T, bar: number): number {\n        console.log(this.name);\n        return bar;\n      }\n      ',
    },
    {
      name: '#152 /**',
      path: '/root/file.ts',
      text: '\n        /**\n         * Test function with param.\n         * @param foo - Test param.\n         */\n        function myFunction(foo: string): void;\n        /**\n         * Test function without param.\n         */\n        function myFunction(): void;\n        function myFunction(foo?: string) {}\n      ',
    },
    {
      name: '#156 /**',
      path: '/root/file.ts',
      text: '\n        /**\n         * @param {string}\n         *   foo The foo.\n         */\n        export function x(foo) {\n          console.log(foo);\n        }\n      ',
    },
    {
      name: '#158 class Store {',
      path: '/root/file.ts',
      text: '\nclass Store {\n  /**\n   * Replaces the value.\n   */\n  set value(next) {}\n}\n',
    },
  ],
  invalid: [
    {
      name: '#15 class Client {',
      path: '/root/file.ts',
      text: '\n      class Client {\n        /**\n         * Set collection data.\n         * @param  {Object}   data                    The collection data object.\n         * @param  {number}   data.last_modified\n         * @param  {Object}   options            The options object.\n         * @param  {Object}   [options.headers]       The headers object option.\n         * @param  {Number}   [options.retry=0]       Number of retries to make\n         *     when faced with transient errors.\n         * @param  {Boolean}  [options.safe]          The safe option.\n         * @param  {Boolean}  [options.patch]         The patch option.\n         * @param  {Number}   [options.last_modified] The last_modified option.\n         * @return {Promise<Object, Error>}\n         */\n        async setData(\n          data: { last_modified?: number },\n          options: {\n            headers?: Record<string, string>;\n            safe?: boolean;\n            retry?: number;\n            patch?: boolean;\n            last_modified?: number;\n            permissions?: [];\n          } = {}\n        ) {}\n      }\n      ',
      errors: [{ message: 'Missing JSDoc @param "options.permissions" declaration.', line: 3, column: 9, endLine: 15, endColumn: 12 }],
      output:
        '\n      class Client {\n        /**\n         * Set collection data.\n         * @param  {Object}   data                    The collection data object.\n         * @param  {number}   data.last_modified\n         * @param  {Object}   options            The options object.\n         * @param  {Object}   [options.headers]       The headers object option.\n         * @param  {Number}   [options.retry=0]       Number of retries to make\n         *     when faced with transient errors.\n         * @param  {Boolean}  [options.safe]          The safe option.\n         * @param  {Boolean}  [options.patch]         The patch option.\n         * @param  {Number}   [options.last_modified] The last_modified option.\n         * @param options.permissions\n         * @return {Promise<Object, Error>}\n         */\n        async setData(\n          data: { last_modified?: number },\n          options: {\n            headers?: Record<string, string>;\n            safe?: boolean;\n            retry?: number;\n            patch?: boolean;\n            last_modified?: number;\n            permissions?: [];\n          } = {}\n        ) {}\n      }\n      ',
    },
    {
      name: '#20 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * @param {GenericArray} cfg\n       * @param {number} cfg."0"\n       */\n      function baar ([a, ...extra]) {\n        //\n      }\n      ',
      errors: [{ message: 'Missing JSDoc @param "cfg."1"" declaration.', line: 2, column: 7, endLine: 5, endColumn: 10 }],
      output:
        '\n      /**\n       * @param {GenericArray} cfg\n       * @param {number} cfg."0"\n       * @param {...any} cfg."1"\n       */\n      function baar ([a, ...extra]) {\n        //\n      }\n      ',
    },
    {
      name: '#21 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * @param a\n       */\n      function baar (a, ...extra) {\n        //\n      }\n      ',
      errors: [{ message: 'Missing JSDoc @param "extra" declaration.', line: 2, column: 7, endLine: 4, endColumn: 10 }],
      output:
        '\n      /**\n       * @param a\n       * @param {...any} extra\n       */\n      function baar (a, ...extra) {\n        //\n      }\n      ',
    },
    {
      name: '#23 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * Converts an SVGRect into an object.\n       * @param {object} bbox - a SVGRect\n       */\n      const bboxToObj = function ({x, y, width, height}) {\n        return {x, y, width, height};\n      };\n      ',
      errors: [
        { message: 'Missing JSDoc @param "bbox.x" declaration.', line: 2, column: 7, endLine: 5, endColumn: 10 },
        { message: 'Missing JSDoc @param "bbox.y" declaration.', line: 2, column: 7, endLine: 5, endColumn: 10 },
        { message: 'Missing JSDoc @param "bbox.width" declaration.', line: 2, column: 7, endLine: 5, endColumn: 10 },
        { message: 'Missing JSDoc @param "bbox.height" declaration.', line: 2, column: 7, endLine: 5, endColumn: 10 },
      ],
      output:
        '\n      /**\n       * Converts an SVGRect into an object.\n       * @param {object} bbox - a SVGRect\n       * @param bbox.x\n       * @param bbox.y\n       * @param bbox.width\n       * @param bbox.height\n       */\n      const bboxToObj = function ({x, y, width, height}) {\n        return {x, y, width, height};\n      };\n      ',
    },
    {
      name: '#25 (function() {',
      path: '/root/file.ts',
      text: '\n(function() {\n\t/**\n\t * A function.\n\t */\n\tfunction f(param) {\n\t\treturn !param;\n\t}\n})();\n      ',
      errors: [{ message: 'Missing JSDoc @param "param" declaration.', line: 3, column: 2, endLine: 5, endColumn: 5 }],
      output:
        '\n(function() {\n\t/**\n\t * A function.\n\t * @param param\n\t */\n\tfunction f(param) {\n\t\treturn !param;\n\t}\n})();\n      ',
    },
    {
      name: '#36 class A {',
      path: '/root/file.ts',
      text: '\n        class A {\n          /**\n           * @param root0\n           * @param root0.foo\n           */\n          quux({ foo }, { bar }) {\n            console.log(foo, bar);\n          }\n        }\n      ',
      errors: [
        { message: 'Missing JSDoc @param "root1" declaration.', line: 3, column: 11, endLine: 6, endColumn: 14 },
        { message: 'Missing JSDoc @param "root1.bar" declaration.', line: 3, column: 11, endLine: 6, endColumn: 14 },
      ],
      output:
        '\n        class A {\n          /**\n           * @param root0\n           * @param root0.foo\n           * @param root1\n           * @param root1.bar\n           */\n          quux({ foo }, { bar }) {\n            console.log(foo, bar);\n          }\n        }\n      ',
    },
    {
      name: '#41 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @param foo\n           * @param baz\n           * @returns {number}\n           */\n          function quux (foo, bar, baz) {\n            return foo + bar + baz;\n          }\n      ',
      errors: [{ message: 'Missing JSDoc @param "bar" declaration.', line: 2, column: 11, endLine: 6, endColumn: 14 }],
      output:
        '\n          /**\n           * @param foo\n           * @param bar\n           * @param baz\n           * @returns {number}\n           */\n          function quux (foo, bar, baz) {\n            return foo + bar + baz;\n          }\n      ',
    },
    {
      name: '#42 /**',
      path: '/root/file.ts',
      text: "\n        /**\n         * @example\n         * ```ts\n         * app.use(checkResourceOwnership({ entryPoint: 'seller_product' }));\n         * ```\n         *\n         * @example\n         * ```ts\n         * app.use(checkResourceOwnership({ entryPoint: 'service_zone' }));\n         * ```\n         *\n         * @param options - configuration\n         * @param options.entryPoint\n         * @param options.filterField\n         * @param options.paramIdField\n         */\n        export const checkResourceOwnership = ({ entryPoint, filterField, paramIdField, resourceId = () => '' }) => {};\n      ",
      errors: [{ message: 'Missing JSDoc @param "options.resourceId" declaration.', line: 2, column: 9, endLine: 17, endColumn: 12 }],
      output:
        "\n        /**\n         * @example\n         * ```ts\n         * app.use(checkResourceOwnership({ entryPoint: 'seller_product' }));\n         * ```\n         *\n         * @example\n         * ```ts\n         * app.use(checkResourceOwnership({ entryPoint: 'service_zone' }));\n         * ```\n         *\n         * @param options - configuration\n         * @param options.entryPoint\n         * @param options.filterField\n         * @param options.paramIdField\n         * @param options.resourceId\n         */\n        export const checkResourceOwnership = ({ entryPoint, filterField, paramIdField, resourceId = () => '' }) => {};\n      ",
    },
    {
      name: '#53 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @param\n           */\n          function quux ({ foo, bar: { baz }}) {\n\n          }\n      ',
      errors: [
        { message: 'Missing JSDoc @param "root0" declaration.', line: 2, column: 11, endLine: 4, endColumn: 14 },
        { message: 'Missing JSDoc @param "root0.foo" declaration.', line: 2, column: 11, endLine: 4, endColumn: 14 },
        { message: 'Missing JSDoc @param "root0.bar" declaration.', line: 2, column: 11, endLine: 4, endColumn: 14 },
        { message: 'Missing JSDoc @param "root0.bar.baz" declaration.', line: 2, column: 11, endLine: 4, endColumn: 14 },
      ],
      output:
        '\n          /**\n           * @param root0\n           * @param root0.foo\n           * @param root0.bar\n           * @param root0.bar.baz\n           */\n          function quux ({ foo, bar: { baz }}) {\n\n          }\n      ',
    },
    {
      name: '#82 /**',
      path: '/root/file.ts',
      text: "\n          /**\n           * Assign the project to a list of employees.\n           * @param {object[]} employees - The employees who are responsible for the project.\n           * @param {string} employees[].name - The name of an employee.\n           * @param {string} employees[].department - The employee's department.\n           */\n          function assign (employees, name) {\n\n          };\n      ",
      errors: [{ message: 'Missing JSDoc @param "name" declaration.', line: 2, column: 11, endLine: 7, endColumn: 14 }],
      output:
        "\n          /**\n           * Assign the project to a list of employees.\n           * @param {object[]} employees - The employees who are responsible for the project.\n           * @param {string} employees[].name - The name of an employee.\n           * @param {string} employees[].department - The employee's department.\n           * @param name\n           */\n          function assign (employees, name) {\n\n          };\n      ",
    },
    {
      name: '#162 /**',
      path: '/root/file.ts',
      text: '\n/**\n * Adds two numbers.\n *\n * @param left - The first addend\n */\nexport declare function add(left: number, right: number): number\n',
      errors: [{ message: 'Missing JSDoc @param "right" declaration.', line: 2, column: 1, endLine: 6, endColumn: 4 }],
      output:
        '\n/**\n * Adds two numbers.\n *\n * @param left - The first addend\n * @param right\n */\nexport declare function add(left: number, right: number): number\n',
    },
    {
      name: '#163 /** Adds two numbers. */',
      path: '/root/file.ts',
      text: '\n/** Adds two numbers. */\nexport function add(left: number, right: number): number {\n  return left + right\n}\n',
      errors: [
        { message: 'Missing JSDoc @param "left" declaration.', line: 2, column: 1, endLine: 2, endColumn: 25 },
        { message: 'Missing JSDoc @param "right" declaration.', line: 2, column: 1, endLine: 2, endColumn: 25 },
      ],
      output:
        '\n/**\n * Adds two numbers.\n * @param left\n * @param right\n */\nexport function add(left: number, right: number): number {\n  return left + right\n}\n',
    },
    {
      name: '#167 class Store {',
      path: '/root/file.ts',
      text: '\nclass Store {\n  /**\n   * Builds a store.\n   */\n  constructor(private readonly name: string, public size = 2) {}\n}\n',
      errors: [
        { message: 'Missing JSDoc @param "name" declaration.', line: 3, column: 3, endLine: 5, endColumn: 6 },
        { message: 'Missing JSDoc @param "size" declaration.', line: 3, column: 3, endLine: 5, endColumn: 6 },
      ],
      output:
        '\nclass Store {\n  /**\n   * Builds a store.\n   * @param name\n   * @param size\n   */\n  constructor(private readonly name: string, public size = 2) {}\n}\n',
    },
  ],
})

/**
 * A one-line block before a function, made multiline as the missing tags go in.
 *
 * @param name - What the block exercises
 * @param block - The block's source
 * @param params - The parameter list's source
 * @param messages - The names reported missing
 * @param output - The block after the fix
 * @returns The case
 */
function oneLine(name: string, block: string, params: string, messages: readonly string[], output: string): InvalidCase {
  const end = block.length + 1
  return {
    name,
    path: '/root/file.ts',
    text: `${block}\nfunction f(${params}) {}`,
    errors: messages.map((missing) => ({
      message: `Missing JSDoc @param "${missing}" declaration.`,
      line: 1,
      column: 1,
      endLine: 1,
      endColumn: end,
    })),
    output: `${output}\nfunction f(${params}) {}`,
  }
}

testRule(rule, {
  valid: [],
  invalid: [
    oneLine('a rest tuple after a description', '/** A */', '...[a, b]', ['a,b'], '/**\n * A\n * @param {...any} a,b\n */'),
    oneLine('a tag with a name', '/** @param a */', 'a, b', ['b'], '/**\n * @param a\n * @param b\n */'),
    oneLine('a tag with a type', '/** @returns {x} */', 'a', ['a'], '/**\n * @param a\n * @returns {x}\n */'),
    oneLine('a bare tag', '/** @abstract */', 'a', ['a'], '/**\n * @param a\n * @abstract\n */'),
  ],
})
