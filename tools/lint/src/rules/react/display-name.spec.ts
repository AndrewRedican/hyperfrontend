import type { InvalidCase, RuleCase } from '../../testing/rule-tester.ts'
import { testRule } from '../../testing/rule-tester.ts'
import rule from './display-name.ts'

/** The message reported. */
const MESSAGE = 'Component definition is missing display name'

// why: the workspace runs the rule with its default options; the `ignoreTranspilerName: true` and `checkContextObjects: true` cases are left out.
testRule(rule, {
  valid: [
    {
      name: '#5 class Hello extends Greetings {',
      path: '/root/react.tsx',
      text: "\n        class Hello extends Greetings {\n          static text = 'Hello World';\n          render() {\n            return Hello.text;\n          }\n        }\n      ",
    },
    {
      name: '#9 var Hello = createReactClass({',
      path: '/root/react.tsx',
      text: '\n        var Hello = createReactClass({\n          render: function() {\n            return <div>Hello {this.props.name}</div>;\n          }\n        });\n      ',
    },
    {
      name: '#11 export default class Hello {',
      path: '/root/react.tsx',
      text: '\n        export default class Hello {\n          render() {\n            return <div>Hello {this.props.name}</div>;\n          }\n        }\n      ',
    },
    {
      name: '#12 var Hello;',
      path: '/root/react.tsx',
      text: '\n        var Hello;\n        Hello = createReactClass({\n          render: function() {\n            return <div>Hello {this.props.name}</div>;\n          }\n        });\n      ',
    },
    {
      name: '#13 module.exports = createReactClass({',
      path: '/root/react.tsx',
      text: '\n        module.exports = createReactClass({\n          "displayName": "Hello",\n          "render": function() {\n            return <div>Hello {this.props.name}</div>;\n          }\n        });\n      ',
    },
    {
      name: '#17 var Hello = function() {',
      path: '/root/react.tsx',
      text: '\n        var Hello = function() {\n          return <div>Hello {this.props.name}</div>;\n        }\n      ',
    },
    {
      name: '#20 module.exports = function Hello() {',
      path: '/root/react.tsx',
      text: '\n        module.exports = function Hello() {\n          return <div>Hello {this.props.name}</div>;\n        }\n      ',
    },
    {
      name: '#27 const Mixin = {',
      path: '/root/react.tsx',
      text: '\n        const Mixin = {\n          Button() {\n            return (\n              <button />\n            );\n          }\n        };\n      ',
    },
    {
      name: '#30 export default {',
      path: '/root/react.tsx',
      text: '\n        export default {\n          renderHello() {\n            let {name} = this.props;\n            return <div>{name}</div>;\n          }\n        };\n      ',
    },
    {
      name: '#32 import React, {Component} from "react";',
      path: '/root/react.tsx',
      text: '\n        import React, {Component} from "react";\n        function someDecorator(ComposedComponent) {\n          return class MyDecorator extends Component {\n            render() {return <ComposedComponent {...this.props} />;}\n          };\n        }\n        module.exports = someDecorator;\n      ',
    },
    {
      name: '#33 import React, {createElement} from "react";',
      path: '/root/react.tsx',
      text: '\n        import React, {createElement} from "react";\n        const SomeComponent = (props) => {\n          const {foo, bar} = props;\n          return someComponentFactory({\n            onClick: () => foo(bar("x"))\n          });\n        };\n      ',
    },
    {
      name: '#34 const element = (',
      path: '/root/react.tsx',
      text: '\n        const element = (\n          <Media query={query} render={() => {\n            renderWasCalled = true\n            return <div/>\n          }}/>\n        )\n      ',
    },
    {
      name: '#36 module.exports = {',
      path: '/root/react.tsx',
      text: '\n        module.exports = {\n          createElement: tagName => document.createElement(tagName)\n        };\n      ',
    },
    {
      name: "#40 import React from 'react';",
      path: '/root/react.tsx',
      text: "\n        import React from 'react';\n\n        const Hello = React.memo(function Hello() {\n          return;\n        });\n      ",
    },
    {
      name: '#42 function F() {',
      path: '/root/react.tsx',
      text: '\n        function F() {\n          let items = [];\n          let testData = [\n            {a: "test1", displayName: "test2"}, {a: "test1", displayName: "test2"}];\n          for (let item of testData) {\n              items.push({a: item.a, b: item.displayName});\n          }\n          return <div>{items}</div>;\n        }\n      ',
    },
    {
      name: '#43 const x = {',
      path: '/root/react.tsx',
      text: '\n        const x = {\n          title: "URL",\n          dataIndex: "url",\n          key: "url",\n          render: url => (\n            <a href={url} target="_blank" rel="noopener noreferrer">\n              <p>lol</p>\n            </a>\n          )\n        }\n      ',
    },
    {
      name: '#46 const Comp = React.forwardRef((props, ref) => <main data-as=…',
      path: '/root/react.tsx',
      text: '\n        const Comp = React.forwardRef((props, ref) => <main data-as="yes" />) as SomeComponent;\n        Comp.displayName = \'MyCompNameAs\';\n      ',
    },
    {
      name: '#48 const f = (a) => () => {',
      path: '/root/react.tsx',
      text: '\n        const f = (a) => () => {\n          if (a) {\n            return null;\n          }\n          return 1;\n        };\n      ',
    },
    {
      name: '#50 export const demo = (a) => (b) => {',
      path: '/root/react.tsx',
      text: '\n        export const demo = (a) => (b) => {\n          if (a == null) return null;\n          return b;\n        }\n      ',
    },
    {
      name: '#51 let demo = null;',
      path: '/root/react.tsx',
      text: '\n        let demo = null;\n        demo = (a) => {\n          if (a == null) return null;\n          return f(a);\n        };',
    },
    {
      name: '#52 obj._property = (a) => {',
      path: '/root/react.tsx',
      text: '\n        obj._property = (a) => {\n          if (a == null) return null;\n          return f(a);\n        };\n      ',
    },
    {
      name: '#62 export const ComponentWithForwardRef = React.memo(',
      path: '/root/react.tsx',
      text: '\n        export const ComponentWithForwardRef = React.memo(\n          React.forwardRef(function Component({ world }) {\n            return <div>Hello {world}</div>\n          })\n        )\n      ',
      settings: { react: { version: '0.14.11' } },
    },
    {
      name: "#72 import { createContext } from 'react';",
      path: '/root/react.tsx',
      text: "\n        import { createContext } from 'react';\n\n        const Hello = createContext();\n      ",
      options: { checkContextObjects: false },
      settings: { react: { version: '>16.3.0' } },
    },
    {
      name: "#76 Undeclared.displayName = 'Undeclared';",
      path: '/root/react.tsx',
      text: "\n      Undeclared.displayName = 'Undeclared';\n    ",
    },
    {
      name: "#79 import { createContext } from 'react';",
      path: '/root/theme.tsx',
      text: "\n      import { createContext } from 'react';\n      export const ThemeContext = createContext<string | null>(null);\n    ",
      settings: { react: { version: '19.0' } },
    },
  ],
  invalid: [
    {
      name: '#92 function Hof() {',
      path: '/root/react.tsx',
      text: '\n        function Hof() {\n          return function () {\n            return <div />\n          }\n        }\n      ',
      errors: [{ message: 'Component definition is missing display name', line: 3, column: 18, endLine: 5, endColumn: 12 }],
    },
    {
      name: "#98 import React from 'react'",
      path: '/root/react.tsx',
      text: "\n        import React from 'react'\n\n        const MemoizedForwardRefComponentLike = React.memo(\n          React.forwardRef(({ world }, ref) => {\n            return <div ref={ref}>Hello {world}</div>\n          })\n        )\n      ",
      settings: { react: { version: '15.6.0' } },
      errors: [{ message: 'Component definition is missing display name', line: 4, column: 49, endLine: 8, endColumn: 10 }],
    },
    {
      name: '#101 import React from "react";',
      path: '/root/react.tsx',
      text: '\n        import React from "react";\n        const { createElement } = React;\n        export default (props) => {\n          return createElement("div", {}, "hello");\n        };\n      ',
      errors: [{ message: 'Component definition is missing display name', line: 4, column: 24, endLine: 6, endColumn: 10 }],
    },
    {
      name: '#102 import React from "react";',
      path: '/root/react.tsx',
      text: '\n        import React from "react";\n        const createElement = React.createElement;\n        export default (props) => {\n          return createElement("div", {}, "hello");\n        };\n      ',
      errors: [{ message: 'Component definition is missing display name', line: 4, column: 24, endLine: 6, endColumn: 10 }],
    },
    {
      name: '#105 export default class extends React.Component {',
      path: '/root/react.tsx',
      text: '\n        export default class extends React.Component {\n          render() {\n            function a () {}\n            const b = function b () {}\n            const c = function () {}\n            const d = () => {}\n            const obj = {\n              a: function a () {},\n              b: function b () {},\n              c () {},\n              d: () => {},\n            }\n            return <div>Hello {this.props.name}</div>;\n          }\n        }\n      ',
      errors: [{ message: 'Component definition is missing display name', line: 2, column: 24, endLine: 16, endColumn: 10 }],
    },
    {
      name: '#107 const renderer = a => listItem => (',
      path: '/root/react.tsx',
      text: '\n        const renderer = a => listItem => (\n          <div>{a} {listItem}</div>\n        );\n      ',
      errors: [{ message: 'Component definition is missing display name', line: 2, column: 31, endLine: 4, endColumn: 10 }],
    },
    {
      name: '#108 const processData = (options?: { value: string }) => options…',
      path: '/root/react.tsx',
      text: "\n        const processData = (options?: { value: string }) => options?.value || 'no data';\n\n        export const Component = observer(() => {\n          const data = processData({ value: 'data' });\n          return <div>{data}</div>;\n        });\n\n        export const Component2 = observer(() => {\n          const data = processData();\n          return <div>{data}</div>;\n        });\n      ",
      settings: { componentWrapperFunctions: ['observer'] },
      errors: [
        { message: 'Component definition is missing display name', line: 4, column: 34, endLine: 7, endColumn: 11 },
        { message: 'Component definition is missing display name', line: 9, column: 35, endLine: 12, endColumn: 11 },
      ],
    },
    {
      name: '#114 export default function ({ label }: { label: string }) {',
      path: '/root/label.tsx',
      text: '\n      export default function ({ label }: { label: string }) {\n        return <span>{label}</span>;\n      }\n    ',
      settings: { react: { version: '19.0' } },
      errors: [{ message: 'Component definition is missing display name', line: 2, column: 22, endLine: 4, endColumn: 8 }],
    },
    {
      name: "#115 import { forwardRef, memo } from 'react';",
      path: '/root/panel.tsx',
      text: "\n      import { forwardRef, memo } from 'react';\n      export const Panel = memo(forwardRef<HTMLDivElement, { title: string }>((props, ref) => <div ref={ref}>{props.title}</div>));\n    ",
      settings: { react: { version: '16.11.0' } },
      errors: [{ message: 'Component definition is missing display name', line: 3, column: 28, endLine: 3, endColumn: 131 }],
    },
  ],
})

/**
 * A case reporting one missing display name.
 *
 * @param name - The test's name
 * @param text - The text linted
 * @param column - The column of the component reported, on the first line
 * @param settings - The settings, when the case needs them
 * @returns The case
 */
function missing(name: string, text: string, column: number, settings?: Readonly<Record<string, unknown>>): InvalidCase {
  return { name, path: '/root/file.tsx', text, settings, errors: [{ message: MESSAGE, line: 1, column }] }
}

/**
 * A case reporting nothing.
 *
 * @param name - The test's name
 * @param text - The text linted
 * @returns The case
 */
function named(name: string, text: string): RuleCase {
  return { name, path: '/root/file.tsx', text }
}

testRule(rule, {
  valid: [
    named('a default export returning only null', 'export default () => null'),
    named('a computed member key returning neither', 'const o = { [a.b]: () => 1 }'),
    named('a computed member key returning only null', 'const o = { [a.b]: () => null }'),
    named('a computed member key returning JSX', 'const o = { [a.b]: () => <div /> }'),
    named('a lower-case key with a named function taking props', 'const o = { foo: function Bar(a) { return <div /> } }'),
    named('a lower-case key with a named function', 'const o = { foo: function Bar() { return <div /> } }'),
    named('a lower-case assignment of a returned function', 'demo = function () { return function () { return <div /> } }'),
    named('an async function', 'const A = async () => <div />'),
    named('a function first in a sequence', 'x = (() => <div />, 0)'),
    named('a display name set through a property path', "const o = { A: () => <div /> }; o.A.displayName = 'A'"),
    named('a display name set on a function property', "const O = () => <div />; O.A.displayName = 'A'"),
    named('a display name set on an assigned member', "const Foo = {}; Foo.Bar = () => <div />; Foo.Bar.displayName = 'Bar'"),
    named('a display name set on this', "this.displayName = 'x'"),
    named('a display name set on an alias', "const A = B; A.displayName = 'x'"),
    named('a display name set on an import', "import A from 'a'; A.displayName = 'x'"),
    named('a display name set on an async function', "const A = async () => <div />; A.displayName = 'A'"),
    named('a factory object assigned to a member', 'x.y = createReactClass({ render() { return <div /> } })'),
    named('a lower-case declarator', 'const foo = () => <div />'),
    named('a lower-case assignment', 'foo = () => <div />'),
    named('an assignment returning no JSX', 'Foo = () => 1'),
    named('a lower-case assignment of a returned arrow', 'demo = () => () => <div />'),
    named('a lower-case property of a returned arrow', 'const o = { demo: () => () => <div /> }'),
    named('a returned named function', 'function f() { return function Inner() { return <div /> } }'),
    named('a lower-case named function last in a sequence', 'x = (0, function inner() { return <div /> })'),
    named('a class field other than the display name', 'class A extends React.Component { x = 1; render() { return <div /> } }'),
    named(
      'a static display name',
      "export default class extends React.Component { static displayName = 'A'; render() { return <div /> } }"
    ),
    named('a factory object with a spread', 'const A = createReactClass({ ...mixin, render() { return <div /> } })'),
    named('a returned import', "import el from 'x'; export default () => el"),
    named('a returned undeclared name', 'export default () => undeclared'),
    named('a returned parameter', 'export default (el) => el'),
    named('a display name on a missing path', "const o = { B: 1 }; o.A.displayName = 'x'"),
    named(
      'a display name getter',
      'class A extends React.Component { static get displayName() { return "A" } render() { return <div /> } }'
    ),
  ],
  invalid: [
    missing('returns inside a loop', 'export default function () { while (x) { return <div /> } }', 16),
    missing('returns inside a for loop', 'export default function () { for (;;) { return <div /> } }', 16),
    missing('returns inside a switch', 'export default function () { switch (x) { case 1: return <div /> } }', 16),
    missing('a conditional with JSX in its alternate', 'export default () => (x ? null : <div />)', 16),
    missing('a sequence ending in JSX', 'export default () => (a, <div />)', 16),
    missing('a configured wrapper on an object', 'const A = Lib.wrap(() => <div />)', 11, {
      componentWrapperFunctions: [{ property: 'wrap', object: 'Lib' }],
    }),
    missing('an arrow returned by an assigned arrow', 'Demo = () => () => <div />', 14),
    missing('an arrow returned by a property arrow', 'const o = { Demo: () => () => <div /> }', 25),
    missing('a function returned by an assigned function', 'Demo = function () { return function () { return <div /> } }', 29),
    missing('a function returned by a property function', 'const o = { Demo: function () { return function () { return <div /> } } }', 40),
    missing('a capitalised assignment', 'Foo = () => <div />', 7),
    missing('a function last in a sequence', 'x = (0, () => <div />)', 9),
    missing('a wrapper whose function reads this', 'const A = React.memo(() => { this.x; return <div /> })', 11),
    missing('a configured wrapper without an object', 'const A = observe(() => <div />)', 11, {
      componentWrapperFunctions: [{ property: 'observe' }],
    }),
    missing('this passed on rather than read', 'export default function () { foo(this); return <div /> }', 16),
    missing('a returned JSX variable', 'const el = <div />; export default () => el', 36),
    missing('a factory object passed on', 'foo(createReactClass({ render() { return <div /> } }))', 22),
  ],
})
