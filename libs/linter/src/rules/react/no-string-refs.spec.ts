import { testRule } from '../../testing/rule-tester'
import rule from './no-string-refs'

// why: the workspace runs the rule with its default options; the `noTemplateLiterals: true` cases are left out.
testRule(rule, {
  valid: [
    {
      name: '#1 var Hello = createReactClass({',
      path: '/root/react.tsx',
      text: '\n        var Hello = createReactClass({\n          componentDidMount: function() {\n            var component = this.hello;\n          },\n          render: function() {\n            return <div ref={c => this.hello = c}>Hello {this.props.name}</div>;\n          }\n        });\n      ',
    },
    {
      name: '#2 var Hello = createReactClass({',
      path: '/root/react.tsx',
      text: '\n        var Hello = createReactClass({\n          render: function() {\n            return <div ref={`hello`}>Hello {this.props.name}</div>;\n          }\n        });\n      ',
    },
    {
      name: '#3 var Hello = createReactClass({',
      path: '/root/react.tsx',
      text: '\n        var Hello = createReactClass({\n          render: function() {\n            return <div ref={`hello${index}`}>Hello {this.props.name}</div>;\n          }\n        });\n      ',
    },
    {
      name: '#4 var Hello = createReactClass({',
      path: '/root/react.tsx',
      text: '\n        var Hello = createReactClass({\n          componentDidMount: function() {\n            var component = this.refs.hello;\n          },\n          render: function() {\n            return <div>Hello {this.props.name}</div>;\n          }\n        });\n      ',
      settings: { react: { version: '18.3.0' } },
    },
    {
      name: '#5 export class Field extends React.Component {',
      path: '/root/field.tsx',
      text: '\n      export class Field extends React.Component {\n        input = React.createRef<HTMLInputElement>();\n        focus(): void {\n          this.refs.input.focus();\n          this.input.current?.focus();\n        }\n        render() {\n          return <input ref={this.input} />;\n        }\n      }\n    ',
      settings: { react: { version: '19.0' } },
    },
    {
      name: '#6 function focus() { this.refs.input.focus(); }',
      path: '/root/react.tsx',
      text: 'function focus() { this.refs.input.focus(); }',
      settings: { react: { version: '18.2.0' } },
    },
    {
      name: '#7 class Field extends React.Component {',
      path: '/root/react.tsx',
      text: "\n      class Field extends React.Component {\n        focus() {\n          other.refs.input.focus();\n          this['refs'];\n        }\n      }\n    ",
      settings: { react: { version: '18.2.0' } },
    },
    { name: '#8 <input ref />;', path: '/root/react.tsx', text: '<input ref />;' },
    { name: '#9 <input ref={null} />;', path: '/root/react.tsx', text: '<input ref={null} />;' },
    {
      name: '#10 <input ref={handleRef} data-ref="input" />;',
      path: '/root/react.tsx',
      text: '<input ref={handleRef} data-ref="input" />;',
    },
  ],
  invalid: [
    {
      name: '#16 var Hello = createReactClass({',
      path: '/root/react.tsx',
      text: '\n        var Hello = createReactClass({\n          componentDidMount: function() {\n            var component = this.refs.hello;\n          },\n          render: function() {\n            return <div ref="hello">Hello {this.props.name}</div>;\n          }\n        });\n      ',
      settings: { react: { version: '18.2.0' } },
      errors: [
        { message: 'Using this.refs is deprecated.', line: 4, column: 29, endLine: 4, endColumn: 38 },
        { message: 'Using string literals in ref attributes is deprecated.', line: 7, column: 25, endLine: 7, endColumn: 36 },
      ],
    },
    {
      name: '#21 var Field = createReactClass({',
      path: '/root/react.tsx',
      text: "\n      var Field = createReactClass({\n        focus: function() {\n          this.refs.input.focus();\n        },\n        render: function() {\n          return <input ref={'input'} />;\n        }\n      });\n    ",
      settings: { react: { version: '18.2.0' } },
      errors: [
        { message: 'Using this.refs is deprecated.', line: 4, column: 11, endLine: 4, endColumn: 20 },
        { message: 'Using string literals in ref attributes is deprecated.', line: 7, column: 25, endLine: 7, endColumn: 38 },
      ],
    },
  ],
})
