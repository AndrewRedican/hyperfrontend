import { testRule } from '../../testing/rule-tester'
import rule from './no-deprecated'

testRule(rule, {
  valid: [
    {
      name: "#1 var element = React.createElement('p', {}, null);",
      path: '/root/react.tsx',
      text: "var element = React.createElement('p', {}, null);",
    },
    {
      name: '#10 var Foo = {',
      path: '/root/react.tsx',
      text: '\n        var Foo = {\n          componentWillMount: function() {},\n          componentWillReceiveProps: function() {},\n          componentWillUpdate: function() {}\n        };\n      ',
    },
    {
      name: '#11 class Foo {',
      path: '/root/react.tsx',
      text: '\n        class Foo {\n          constructor() {}\n          componentWillMount() {}\n          componentWillReceiveProps() {}\n          componentWillUpdate() {}\n        }\n      ',
    },
    {
      name: '#16 import React from "react";',
      path: '/root/react.tsx',
      text: '\n        import React from "react";\n\n        let { default: defaultReactExport, ...allReactExports } = React;\n      ',
    },
    {
      name: "#17 import { render, hydrate } from 'react-dom';",
      path: '/root/react.tsx',
      text: "\n        import { render, hydrate } from 'react-dom';\n        import { renderToNodeStream } from 'react-dom/server';\n        ReactDOM.render(element, container);\n        ReactDOM.unmountComponentAtNode(container);\n        ReactDOMServer.renderToNodeStream(element);\n      ",
      settings: { react: { version: '17.999.999' } },
    },
    {
      name: "#18 import ReactDOM, { createRoot } from 'react-dom/client';",
      path: '/root/react.tsx',
      text: "\n        import ReactDOM, { createRoot } from 'react-dom/client';\n        ReactDOM.createRoot(container);\n        const root = createRoot(container);\n        root.unmount();\n      ",
    },
    {
      name: "#31 import { createRoot } from 'react-dom/client';",
      path: '/root/main.tsx',
      text: "\n      import { createRoot } from 'react-dom/client';\n      import { App } from './app';\n      const root = createRoot(document.getElementById('root') as HTMLElement);\n      root.render(<App />);\n    ",
      settings: { react: { version: '19.0' } },
    },
    { name: '#32 var instance;', path: '/root/react.tsx', text: 'var instance;' },
    {
      name: "#33 import * as ReactDOM from 'react-dom'; import ReactDefault f…",
      path: '/root/react.tsx',
      text: "import * as ReactDOM from 'react-dom'; import ReactDefault from 'react';",
    },
    { name: "#35 const { render } = require('preact');", path: '/root/react.tsx', text: "const { render } = require('preact');" },
    { name: '#37 const { render } = createApp();', path: '/root/react.tsx', text: 'const { render } = createApp();' },
    {
      name: "#39 const { ['createClass']: create } = React;",
      path: '/root/react.tsx',
      text: "const { ['createClass']: create } = React;",
    },
  ],
  invalid: [
    {
      name: '#42 /** @jsx Foo */ Foo.renderComponent()',
      path: '/root/react.tsx',
      text: '/** @jsx Foo */ Foo.renderComponent()',
      errors: [
        {
          message: 'Foo.renderComponent is deprecated since React 0.12.0, use Foo.render instead',
          line: 1,
          column: 17,
          endLine: 1,
          endColumn: 36,
        },
      ],
    },
    {
      name: '#44 React.addons.TestUtils',
      path: '/root/react.tsx',
      text: 'React.addons.TestUtils',
      errors: [
        {
          message: 'React.addons.TestUtils is deprecated since React 15.5.0, use ReactDOM.TestUtils instead',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 23,
        },
      ],
    },
    {
      name: '#52 Foo.createClass({});',
      path: '/root/react.tsx',
      text: 'Foo.createClass({});',
      settings: { react: { pragma: 'Foo' } },
      errors: [
        {
          message: 'Foo.createClass is deprecated since React 15.5.0, use the npm module create-react-class instead',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 16,
        },
      ],
    },
    {
      name: "#58 import React from 'react';",
      path: '/root/react.tsx',
      text: "\n      import React from 'react';\n      const {createClass, PropTypes} = React;\n    ",
      errors: [
        {
          message: 'React.createClass is deprecated since React 15.5.0, use the npm module create-react-class instead',
          line: 3,
          column: 14,
          endLine: 3,
          endColumn: 25,
        },
        {
          message: 'React.PropTypes is deprecated since React 15.5.0, use the npm module prop-types instead',
          line: 3,
          column: 27,
          endLine: 3,
          endColumn: 36,
        },
      ],
    },
    {
      name: '#61 React.DOM.div',
      path: '/root/react.tsx',
      text: 'React.DOM.div',
      errors: [
        {
          message: 'React.DOM is deprecated since React 15.6.0, use the npm module react-dom-factories instead',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 10,
        },
      ],
    },
    {
      name: '#63 function Foo() {',
      path: '/root/react.tsx',
      text: '\n        function Foo() {\n          return class Bar extends React.PureComponent {\n            componentWillMount() {}\n            componentWillReceiveProps() {}\n            componentWillUpdate() {}\n          };\n        }\n      ',
      errors: [
        {
          message:
            'componentWillMount is deprecated since React 16.9.0, use UNSAFE_componentWillMount instead, see https://reactjs.org/docs/react-component.html#unsafe_componentwillmount. Use https://github.com/reactjs/react-codemod#rename-unsafe-lifecycles to automatically update your components.',
          line: 4,
          column: 13,
          endLine: 4,
          endColumn: 31,
        },
        {
          message:
            'componentWillReceiveProps is deprecated since React 16.9.0, use UNSAFE_componentWillReceiveProps instead, see https://reactjs.org/docs/react-component.html#unsafe_componentwillreceiveprops. Use https://github.com/reactjs/react-codemod#rename-unsafe-lifecycles to automatically update your components.',
          line: 5,
          column: 13,
          endLine: 5,
          endColumn: 38,
        },
        {
          message:
            'componentWillUpdate is deprecated since React 16.9.0, use UNSAFE_componentWillUpdate instead, see https://reactjs.org/docs/react-component.html#unsafe_componentwillupdate. Use https://github.com/reactjs/react-codemod#rename-unsafe-lifecycles to automatically update your components.',
          line: 6,
          column: 13,
          endLine: 6,
          endColumn: 32,
        },
      ],
    },
    {
      name: '#64 class Bar extends PureComponent {',
      path: '/root/react.tsx',
      text: '\n        class Bar extends PureComponent {\n          componentWillMount() {}\n          componentWillReceiveProps() {}\n          componentWillUpdate() {}\n        };\n      ',
      errors: [
        {
          message:
            'componentWillMount is deprecated since React 16.9.0, use UNSAFE_componentWillMount instead, see https://reactjs.org/docs/react-component.html#unsafe_componentwillmount. Use https://github.com/reactjs/react-codemod#rename-unsafe-lifecycles to automatically update your components.',
          line: 3,
          column: 11,
          endLine: 3,
          endColumn: 29,
        },
        {
          message:
            'componentWillReceiveProps is deprecated since React 16.9.0, use UNSAFE_componentWillReceiveProps instead, see https://reactjs.org/docs/react-component.html#unsafe_componentwillreceiveprops. Use https://github.com/reactjs/react-codemod#rename-unsafe-lifecycles to automatically update your components.',
          line: 4,
          column: 11,
          endLine: 4,
          endColumn: 36,
        },
        {
          message:
            'componentWillUpdate is deprecated since React 16.9.0, use UNSAFE_componentWillUpdate instead, see https://reactjs.org/docs/react-component.html#unsafe_componentwillupdate. Use https://github.com/reactjs/react-codemod#rename-unsafe-lifecycles to automatically update your components.',
          line: 5,
          column: 11,
          endLine: 5,
          endColumn: 30,
        },
      ],
    },
    {
      name: '#67 var Foo = createReactClass({',
      path: '/root/react.tsx',
      text: '\n        var Foo = createReactClass({\n          componentWillMount: function() {},\n          componentWillReceiveProps: function() {},\n          componentWillUpdate: function() {}\n        })\n      ',
      errors: [
        {
          message:
            'componentWillMount is deprecated since React 16.9.0, use UNSAFE_componentWillMount instead, see https://reactjs.org/docs/react-component.html#unsafe_componentwillmount. Use https://github.com/reactjs/react-codemod#rename-unsafe-lifecycles to automatically update your components.',
          line: 3,
          column: 11,
          endLine: 3,
          endColumn: 29,
        },
        {
          message:
            'componentWillReceiveProps is deprecated since React 16.9.0, use UNSAFE_componentWillReceiveProps instead, see https://reactjs.org/docs/react-component.html#unsafe_componentwillreceiveprops. Use https://github.com/reactjs/react-codemod#rename-unsafe-lifecycles to automatically update your components.',
          line: 4,
          column: 11,
          endLine: 4,
          endColumn: 36,
        },
        {
          message:
            'componentWillUpdate is deprecated since React 16.9.0, use UNSAFE_componentWillUpdate instead, see https://reactjs.org/docs/react-component.html#unsafe_componentwillupdate. Use https://github.com/reactjs/react-codemod#rename-unsafe-lifecycles to automatically update your components.',
          line: 5,
          column: 11,
          endLine: 5,
          endColumn: 30,
        },
      ],
    },
    {
      name: "#69 import { render } from 'react-dom';",
      path: '/root/react.tsx',
      text: "\n        import { render } from 'react-dom';\n        ReactDOM.render(<div></div>, container);\n      ",
      errors: [
        {
          message:
            'ReactDOM.render is deprecated since React 18.0.0, use createRoot instead, see https://reactjs.org/link/switch-to-createroot',
          line: 2,
          column: 18,
          endLine: 2,
          endColumn: 24,
        },
        {
          message:
            'ReactDOM.render is deprecated since React 18.0.0, use createRoot instead, see https://reactjs.org/link/switch-to-createroot',
          line: 3,
          column: 9,
          endLine: 3,
          endColumn: 24,
        },
      ],
    },
    {
      name: '#73 React.renderComponent(element, container);',
      path: '/root/react.tsx',
      text: '\n  React.renderComponent(element, container);\n  React.renderComponentToString(element);\n  React.renderComponentToStaticMarkup(element);\n  React.isValidComponent(Hello);\n  React.PropTypes.component;\n  React.PropTypes.renderable;\n  React.isValidClass(Hello);\n  this.transferPropsTo(child);\n',
      settings: { react: { version: '0.12.0' } },
      errors: [
        {
          message: 'React.renderComponent is deprecated since React 0.12.0, use React.render instead',
          line: 2,
          column: 3,
          endLine: 2,
          endColumn: 24,
        },
        {
          message: 'React.renderComponentToString is deprecated since React 0.12.0, use React.renderToString instead',
          line: 3,
          column: 3,
          endLine: 3,
          endColumn: 32,
        },
        {
          message: 'React.renderComponentToStaticMarkup is deprecated since React 0.12.0, use React.renderToStaticMarkup instead',
          line: 4,
          column: 3,
          endLine: 4,
          endColumn: 38,
        },
        {
          message: 'React.isValidComponent is deprecated since React 0.12.0, use React.isValidElement instead',
          line: 5,
          column: 3,
          endLine: 5,
          endColumn: 25,
        },
        {
          message: 'React.PropTypes.component is deprecated since React 0.12.0, use React.PropTypes.element instead',
          line: 6,
          column: 3,
          endLine: 6,
          endColumn: 28,
        },
        {
          message: 'React.PropTypes.renderable is deprecated since React 0.12.0, use React.PropTypes.node instead',
          line: 7,
          column: 3,
          endLine: 7,
          endColumn: 29,
        },
        { message: 'React.isValidClass is deprecated since React 0.12.0', line: 8, column: 3, endLine: 8, endColumn: 21 },
        {
          message: 'this.transferPropsTo is deprecated since React 0.12.0, use spread operator ({...}) instead',
          line: 9,
          column: 3,
          endLine: 9,
          endColumn: 23,
        },
      ],
    },
    {
      name: '#74 React.addons.classSet({ active: true });',
      path: '/root/react.tsx',
      text: '\n  React.addons.classSet({ active: true });\n  React.addons.cloneWithProps(child);\n',
      settings: { react: { version: '0.13.0' } },
      errors: [
        {
          message: 'React.addons.classSet is deprecated since React 0.13.0, use the npm module classnames instead',
          line: 2,
          column: 3,
          endLine: 2,
          endColumn: 24,
        },
        {
          message: 'React.addons.cloneWithProps is deprecated since React 0.13.0, use React.cloneElement instead',
          line: 3,
          column: 3,
          endLine: 3,
          endColumn: 30,
        },
      ],
    },
    {
      name: '#75 React.render(element, container);',
      path: '/root/react.tsx',
      text: '\n  React.render(element, container);\n  React.unmountComponentAtNode(container);\n  React.findDOMNode(instance);\n  React.renderToString(element);\n  React.renderToStaticMarkup(element);\n',
      settings: { react: { version: '0.14.0' } },
      errors: [
        {
          message: 'React.render is deprecated since React 0.14.0, use ReactDOM.render instead',
          line: 2,
          column: 3,
          endLine: 2,
          endColumn: 15,
        },
        {
          message: 'React.unmountComponentAtNode is deprecated since React 0.14.0, use ReactDOM.unmountComponentAtNode instead',
          line: 3,
          column: 3,
          endLine: 3,
          endColumn: 31,
        },
        {
          message: 'React.findDOMNode is deprecated since React 0.14.0, use ReactDOM.findDOMNode instead',
          line: 4,
          column: 3,
          endLine: 4,
          endColumn: 20,
        },
        {
          message: 'React.renderToString is deprecated since React 0.14.0, use ReactDOMServer.renderToString instead',
          line: 5,
          column: 3,
          endLine: 5,
          endColumn: 23,
        },
        {
          message: 'React.renderToStaticMarkup is deprecated since React 0.14.0, use ReactDOMServer.renderToStaticMarkup instead',
          line: 6,
          column: 3,
          endLine: 6,
          endColumn: 29,
        },
      ],
    },
    {
      name: '#76 React.addons.LinkedStateMixin;',
      path: '/root/react.tsx',
      text: '\n  React.addons.LinkedStateMixin;\n  ReactPerf.printDOM();\n  Perf.printDOM();\n  ReactPerf.getMeasurementsSummaryMap();\n  Perf.getMeasurementsSummaryMap();\n',
      settings: { react: { version: '15.0.0' } },
      errors: [
        { message: 'React.addons.LinkedStateMixin is deprecated since React 15.0.0', line: 2, column: 3, endLine: 2, endColumn: 32 },
        {
          message: 'ReactPerf.printDOM is deprecated since React 15.0.0, use ReactPerf.printOperations instead',
          line: 3,
          column: 3,
          endLine: 3,
          endColumn: 21,
        },
        {
          message: 'Perf.printDOM is deprecated since React 15.0.0, use Perf.printOperations instead',
          line: 4,
          column: 3,
          endLine: 4,
          endColumn: 16,
        },
        {
          message: 'ReactPerf.getMeasurementsSummaryMap is deprecated since React 15.0.0, use ReactPerf.getWasted instead',
          line: 5,
          column: 3,
          endLine: 5,
          endColumn: 38,
        },
        {
          message: 'Perf.getMeasurementsSummaryMap is deprecated since React 15.0.0, use Perf.getWasted instead',
          line: 6,
          column: 3,
          endLine: 6,
          endColumn: 33,
        },
      ],
    },
    {
      name: '#80 ReactDOM.render(<App />, container);',
      path: '/root/react.tsx',
      text: '\n  ReactDOM.render(<App />, container);\n  ReactDOM.hydrate(<App />, container);\n  ReactDOM.unmountComponentAtNode(container);\n  ReactDOMServer.renderToNodeStream(<App />);\n',
      settings: { react: { version: '18.0.0' } },
      errors: [
        {
          message:
            'ReactDOM.render is deprecated since React 18.0.0, use createRoot instead, see https://reactjs.org/link/switch-to-createroot',
          line: 2,
          column: 3,
          endLine: 2,
          endColumn: 18,
        },
        {
          message:
            'ReactDOM.hydrate is deprecated since React 18.0.0, use hydrateRoot instead, see https://reactjs.org/link/switch-to-createroot',
          line: 3,
          column: 3,
          endLine: 3,
          endColumn: 19,
        },
        {
          message:
            'ReactDOM.unmountComponentAtNode is deprecated since React 18.0.0, use root.unmount instead, see https://reactjs.org/link/switch-to-createroot',
          line: 4,
          column: 3,
          endLine: 4,
          endColumn: 34,
        },
        {
          message:
            'ReactDOMServer.renderToNodeStream is deprecated since React 18.0.0, use renderToPipeableStream instead, see https://reactjs.org/docs/react-dom-server.html#rendertonodestream',
          line: 5,
          column: 3,
          endLine: 5,
          endColumn: 36,
        },
      ],
    },
    {
      name: '#82 interface PanelProps { open: boolean }',
      path: '/root/panel.tsx',
      text: '\n      interface PanelProps { open: boolean }\n      export class Panel extends React.Component<PanelProps> {\n        componentWillReceiveProps(next: PanelProps) {}\n        render() { return <div />; }\n      }\n    ',
      settings: { react: { version: '19.0' } },
      errors: [
        {
          message:
            'componentWillReceiveProps is deprecated since React 16.9.0, use UNSAFE_componentWillReceiveProps instead, see https://reactjs.org/docs/react-component.html#unsafe_componentwillreceiveprops. Use https://github.com/reactjs/react-codemod#rename-unsafe-lifecycles to automatically update your components.',
          line: 4,
          column: 9,
          endLine: 4,
          endColumn: 34,
        },
      ],
    },
    {
      name: '#83 const Foo = class extends React.Component { componentWillUpd…',
      path: '/root/react.tsx',
      text: 'const Foo = class extends React.Component { componentWillUpdate() {} };',
      settings: { react: { version: '16.9' } },
      errors: [
        {
          message:
            'componentWillUpdate is deprecated since React 16.9.0, use UNSAFE_componentWillUpdate instead, see https://reactjs.org/docs/react-component.html#unsafe_componentwillupdate. Use https://github.com/reactjs/react-codemod#rename-unsafe-lifecycles to automatically update your components.',
          line: 1,
          column: 45,
          endLine: 1,
          endColumn: 64,
        },
      ],
    },
    {
      name: "#86 const { render } = require('constructor');",
      path: '/root/react.tsx',
      text: "const { render } = require('constructor');",
      errors: [
        {
          message: 'React.render is deprecated since React 0.14.0, use ReactDOM.render instead',
          line: 1,
          column: 9,
          endLine: 1,
          endColumn: 15,
        },
      ],
    },
  ],
})

testRule(rule, {
  valid: [{ name: 'a require without a module', path: '/root/file.tsx', text: 'const { render } = require()' }],
  invalid: [],
})
