import { testRule } from '../../testing/rule-tester'
import rule from './no-direct-mutation-state'

testRule(rule, {
  valid: [
    {
      name: '#1 var Hello = createReactClass({',
      path: '/root/react.tsx',
      text: '\n        var Hello = createReactClass({\n          render: function() {\n            return <div>Hello {this.props.name}</div>;\n          }\n        });\n      ',
    },
    {
      name: '#3 var Hello = "foo";',
      path: '/root/react.tsx',
      text: '\n        var Hello = "foo";\n        module.exports = {};\n      ',
    },
    {
      name: '#4 class Hello {',
      path: '/root/react.tsx',
      text: "\n        class Hello {\n          getFoo() {\n            this.state.foo = 'bar'\n            return this.state.foo;\n          }\n        }\n      ",
    },
    {
      name: '#7 class OneComponent extends Component {',
      path: '/root/react.tsx',
      text: '\n        class OneComponent extends Component {\n          constructor() {\n            super();\n            class AnotherComponent extends Component {\n              constructor() {\n                super();\n              }\n            }\n            this.state = {};\n          }\n        }\n      ',
    },
    {
      name: '#8 class Counter extends React.Component {',
      path: '/root/react.tsx',
      text: '\n      class Counter extends React.Component {\n        render() {\n          let count = 0;\n          count++;\n          return <div>{count}</div>;\n        }\n      }\n    ',
    },
    {
      name: '#9 class Counter extends React.Component {',
      path: '/root/react.tsx',
      text: "\n      class Counter extends React.Component {\n        render() {\n          let label;\n          label = 'count';\n          return <div>{label}</div>;\n        }\n      }\n    ",
    },
    { name: '#11 this.state.count = 1; this.state.count++;', path: '/root/react.tsx', text: 'this.state.count = 1; this.state.count++;' },
    {
      name: '#12 interface ToggleState { open: boolean }',
      path: '/root/toggle.tsx',
      text: "\n      interface ToggleState { open: boolean }\n      export class Toggle extends React.Component<object, ToggleState> {\n        state: ToggleState = { open: false };\n        toggle = (): void => {\n          this.setState((previous) => ({ open: !previous.open }));\n        };\n        render() {\n          return <button onClick={this.toggle}>{this.state.open ? 'close' : 'open'}</button>;\n        }\n      }\n    ",
      settings: { react: { version: '19.0' } },
    },
  ],
  invalid: [
    {
      name: '#17 var Hello = createReactClass({',
      path: '/root/react.tsx',
      text: '\n        var Hello = createReactClass({\n          render: function() {\n            this.state.person.name.first = "bar"\n            this.state.person.name.last = "baz"\n            return <div>Hello</div>;\n          }\n        });\n      ',
      errors: [
        { message: 'Do not mutate state directly. Use setState().', line: 4, column: 13, endLine: 4, endColumn: 35 },
        { message: 'Do not mutate state directly. Use setState().', line: 5, column: 13, endLine: 5, endColumn: 35 },
      ],
    },
    {
      name: '#28 class List extends React.Component {',
      path: '/root/react.tsx',
      text: '\n      class List extends React.Component {\n        add(item) {\n          this.state.items[0] = item;\n          --this.state.count;\n        }\n      }\n    ',
      errors: [
        { message: 'Do not mutate state directly. Use setState().', line: 4, column: 11, endLine: 4, endColumn: 27 },
        { message: 'Do not mutate state directly. Use setState().', line: 5, column: 13, endLine: 5, endColumn: 23 },
      ],
    },
  ],
})
