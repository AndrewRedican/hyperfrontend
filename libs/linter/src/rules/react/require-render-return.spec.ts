import { testRule } from '../../testing/rule-tester'
import rule from './require-render-return'

testRule(rule, {
  valid: [
    {
      name: '#1 class Hello extends React.Component {',
      path: '/root/react.tsx',
      text: '\n        class Hello extends React.Component {\n          render() {\n            return <div>Hello {this.props.name}</div>;\n          }\n        }\n      ',
    },
    {
      name: '#3 class Hello extends React.Component {',
      path: '/root/react.tsx',
      text: '\n        class Hello extends React.Component {\n          render = () => (\n            <div>Hello {this.props.name}</div>\n          )\n        }\n      ',
    },
    {
      name: '#5 function Hello() {',
      path: '/root/react.tsx',
      text: '\n        function Hello() {\n          return <div></div>;\n        }\n      ',
    },
    {
      name: '#7 var Hello = createReactClass({',
      path: '/root/react.tsx',
      text: "\n        var Hello = createReactClass({\n          render: function() {\n            switch (this.props.name) {\n              case 'Foo':\n                return <div>Hello Foo</div>;\n              default:\n                return <div>Hello {this.props.name}</div>;\n            }\n          }\n        });\n      ",
    },
    {
      name: '#8 var Hello = createReactClass({',
      path: '/root/react.tsx',
      text: "\n        var Hello = createReactClass({\n          render: function() {\n            if (this.props.name === 'Foo') {\n              return <div>Hello Foo</div>;\n            } else {\n              return <div>Hello {this.props.name}</div>;\n            }\n          }\n        });\n      ",
    },
    { name: '#9 class Hello {', path: '/root/react.tsx', text: '\n        class Hello {\n          render() {}\n        }\n      ' },
    {
      name: "#12 var render = require('./render');",
      path: '/root/react.tsx',
      text: "\n        var render = require('./render');\n        var Hello = createReactClass({\n          render\n        });\n      ",
    },
    {
      name: '#14 interface Props { open: boolean }',
      path: '/root/panel.tsx',
      text: '\n      interface Props { open: boolean }\n      export class Panel extends React.Component<Props> {\n        render(): React.ReactNode {\n          if (!this.props.open) {\n            return null;\n          }\n          return <div />;\n        }\n      }\n    ',
      settings: { react: { version: '19.0' } },
    },
  ],
  invalid: [
    {
      name: '#17 var Hello = createReactClass({',
      path: '/root/react.tsx',
      text: "\n        var Hello = createReactClass({\n          displayName: 'Hello',\n          render: function() {}\n        });\n      ",
      errors: [{ message: 'Your render method should have a return statement', line: 4, column: 11, endLine: 4, endColumn: 32 }],
    },
    {
      name: '#20 class Hello extends React.Component {',
      path: '/root/react.tsx',
      text: '\n        class Hello extends React.Component {\n          render = () => {\n            <div>Hello {this.props.name}</div>\n          }\n        }\n      ',
      errors: [{ message: 'Your render method should have a return statement', line: 3, column: 11, endLine: 5, endColumn: 12 }],
    },
    {
      name: '#21 interface Props { open: boolean }',
      path: '/root/panel.tsx',
      text: '\n      interface Props { open: boolean }\n      export class Panel extends React.Component<Props> {\n        render(): React.ReactNode {\n          console.log(this.props.open);\n        }\n      }\n    ',
      settings: { react: { version: '19.0' } },
      errors: [{ message: 'Your render method should have a return statement', line: 4, column: 9, endLine: 6, endColumn: 10 }],
    },
    {
      name: '#22 const Hello = class extends Component {',
      path: '/root/react.tsx',
      text: '\n      const Hello = class extends Component {\n        render() {\n          this.props.items.forEach((item) => {\n            return item;\n          });\n        }\n      };\n    ',
      errors: [{ message: 'Your render method should have a return statement', line: 3, column: 9, endLine: 7, endColumn: 10 }],
    },
    {
      name: '#23 var Hello = createReactClass({',
      path: '/root/react.tsx',
      text: '\n      var Hello = createReactClass({\n        render() {}\n      });\n    ',
      errors: [{ message: 'Your render method should have a return statement', line: 3, column: 9, endLine: 3, endColumn: 20 }],
    },
  ],
})
