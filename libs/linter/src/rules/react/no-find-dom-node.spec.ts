import { testRule } from '../../testing/rule-tester'
import rule from './no-find-dom-node'

testRule(rule, {
  valid: [
    { name: '#1 var Hello = function() {};', path: '/root/react.tsx', text: '\n        var Hello = function() {};\n      ' },
    {
      name: '#3 var Hello = createReactClass({',
      path: '/root/react.tsx',
      text: '\n        var Hello = createReactClass({\n          componentDidMount: function() {\n            someNonMemberFunction(arg);\n            this.someFunc = React.findDOMNode;\n          },\n          render: function() {\n            return <div>Hello</div>;\n          }\n        });\n      ',
    },
    { name: "#5 React['findDOMNode'](this);", path: '/root/react.tsx', text: "React['findDOMNode'](this);" },
    {
      name: '#7 export class Panel extends React.Component {',
      path: '/root/panel.tsx',
      text: '\n      export class Panel extends React.Component {\n        private node = React.createRef<HTMLDivElement>();\n        componentDidMount(): void {\n          this.node.current?.scrollIntoView();\n        }\n        render() {\n          return <div ref={this.node} />;\n        }\n      }\n    ',
      settings: { react: { version: '19.0' } },
    },
  ],
  invalid: [
    {
      name: '#8 var Hello = createReactClass({',
      path: '/root/react.tsx',
      text: '\n        var Hello = createReactClass({\n          componentDidMount: function() {\n            React.findDOMNode(this).scrollIntoView();\n          },\n          render: function() {\n            return <div>Hello</div>;\n          }\n        });\n      ',
      errors: [
        {
          message:
            'Do not use findDOMNode. It doesn’t work with function components and is deprecated in StrictMode. See https://reactjs.org/docs/react-dom.html#finddomnode',
          line: 4,
          column: 13,
          endLine: 4,
          endColumn: 30,
        },
      ],
    },
    {
      name: '#10 class Hello extends Component {',
      path: '/root/react.tsx',
      text: '\n        class Hello extends Component {\n          componentDidMount() {\n            findDOMNode(this).scrollIntoView();\n          }\n          render() {\n            return <div>Hello</div>;\n          }\n        };\n      ',
      errors: [
        {
          message:
            'Do not use findDOMNode. It doesn’t work with function components and is deprecated in StrictMode. See https://reactjs.org/docs/react-dom.html#finddomnode',
          line: 4,
          column: 13,
          endLine: 4,
          endColumn: 24,
        },
      ],
    },
    {
      name: '#12 export class Panel extends React.Component {',
      path: '/root/panel.tsx',
      text: '\n      export class Panel extends React.Component {\n        componentDidMount(): void {\n          (ReactDOM.findDOMNode(this) as HTMLElement).scrollIntoView();\n        }\n      }\n    ',
      settings: { react: { version: '19.0' } },
      errors: [
        {
          message:
            'Do not use findDOMNode. It doesn’t work with function components and is deprecated in StrictMode. See https://reactjs.org/docs/react-dom.html#finddomnode',
          line: 4,
          column: 12,
          endLine: 4,
          endColumn: 32,
        },
      ],
    },
    {
      name: '#14 const node = findDOMNode(',
      path: '/root/react.tsx',
      text: '\n      const node = findDOMNode(\n        this\n      );\n    ',
      errors: [
        {
          message:
            'Do not use findDOMNode. It doesn’t work with function components and is deprecated in StrictMode. See https://reactjs.org/docs/react-dom.html#finddomnode',
          line: 2,
          column: 20,
          endLine: 2,
          endColumn: 31,
        },
      ],
    },
  ],
})
