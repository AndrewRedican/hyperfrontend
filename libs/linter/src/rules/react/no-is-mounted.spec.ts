import { testRule } from '../../testing/rule-tester'
import rule from './no-is-mounted'

testRule(rule, {
  valid: [
    {
      name: '#3 var Hello = createReactClass({',
      path: '/root/react.tsx',
      text: '\n        var Hello = createReactClass({\n          componentDidUpdate: function() {\n            someNonMemberFunction(arg);\n            this.someFunc = this.isMounted;\n          },\n          render: function() {\n            return <div>Hello</div>;\n          }\n        });\n      ',
    },
    {
      name: '#4 class Hello extends React.Component {',
      path: '/root/react.tsx',
      text: '\n        class Hello extends React.Component {\n          notIsMounted() {}\n          render() {\n            this.notIsMounted();\n            return <div>Hello</div>;\n          }\n        };\n      ',
    },
    {
      name: '#6 function check() { return this.isMounted(); }',
      path: '/root/react.tsx',
      text: 'function check() { return this.isMounted(); }',
    },
    {
      name: "#7 var Hello = { check: function() { return this['isMounted']()…",
      path: '/root/react.tsx',
      text: "var Hello = { check: function() { return this['isMounted'](); } };",
    },
    {
      name: '#9 export class Poller extends React.Component {',
      path: '/root/poller.tsx',
      text: '\n      export class Poller extends React.Component {\n        poll = (): boolean => this.isMounted();\n      }\n    ',
      settings: { react: { version: '19.0' } },
    },
  ],
  invalid: [
    {
      name: '#11 var Hello = createReactClass({',
      path: '/root/react.tsx',
      text: '\n        var Hello = createReactClass({\n          someMethod: function() {\n            if (!this.isMounted()) {\n              return;\n            }\n          },\n          render: function() {\n            return <div onClick={this.someMethod.bind(this)}>Hello</div>;\n          }\n        });\n      ',
      errors: [{ message: 'Do not use isMounted', line: 4, column: 18, endLine: 4, endColumn: 32 }],
    },
    {
      name: '#13 export class Poller extends React.Component {',
      path: '/root/poller.tsx',
      text: '\n      export class Poller extends React.Component {\n        poll(): void {\n          if (this.isMounted()) {\n            this.setState({ polled: true });\n          }\n        }\n      }\n    ',
      settings: { react: { version: '19.0' } },
      errors: [{ message: 'Do not use isMounted', line: 4, column: 15, endLine: 4, endColumn: 29 }],
    },
    {
      name: '#14 var Hello = { check() { return () => this.isMounted(); } };',
      path: '/root/react.tsx',
      text: 'var Hello = { check() { return () => this.isMounted(); } };',
      errors: [{ message: 'Do not use isMounted', line: 1, column: 38, endLine: 1, endColumn: 52 }],
    },
  ],
})
