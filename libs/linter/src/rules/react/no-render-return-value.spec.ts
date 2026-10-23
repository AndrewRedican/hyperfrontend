import { testRule } from '../../testing/rule-tester'
import rule from './no-render-return-value'

testRule(rule, {
  valid: [
    {
      name: '#2 let node;',
      path: '/root/react.tsx',
      text: '\n        let node;\n        ReactDOM.render(<div ref={ref => node = ref}/>, document.body);\n      ',
    },
    {
      name: '#5 React.render(<div ref={ref => this.node = ref}/>, document.b…',
      path: '/root/react.tsx',
      text: 'React.render(<div ref={ref => this.node = ref}/>, document.body);',
      settings: { react: { version: '0.13.0' } },
    },
    {
      name: '#6 var foo = React.render(<div />, root);',
      path: '/root/react.tsx',
      text: 'var foo = React.render(<div />, root);',
      settings: { react: { version: '0.0.1' } },
    },
    {
      name: "#11 var inst = ReactDOM['render'](<div />, root);",
      path: '/root/react.tsx',
      text: "var inst = ReactDOM['render'](<div />, root);",
    },
    {
      name: "#14 import { createRoot } from 'react-dom/client';",
      path: '/root/main.tsx',
      text: "\n      import { createRoot } from 'react-dom/client';\n      const root = createRoot(document.getElementById('root') as HTMLElement);\n      root.render(<App />);\n    ",
      settings: { react: { version: '19.0' } },
    },
  ],
  invalid: [
    {
      name: '#16 var o = {',
      path: '/root/react.tsx',
      text: '\n        var o = {\n          inst: ReactDOM.render(<div />, document.body)\n        };\n      ',
      errors: [{ message: 'Do not depend on the return value from ReactDOM.render', line: 3, column: 17, endLine: 3, endColumn: 32 }],
    },
    {
      name: '#17 function render () {',
      path: '/root/react.tsx',
      text: '\n        function render () {\n          return ReactDOM.render(<div />, document.body)\n        }\n      ',
      errors: [{ message: 'Do not depend on the return value from ReactDOM.render', line: 3, column: 18, endLine: 3, endColumn: 33 }],
    },
    {
      name: '#18 var render = (a, b) => ReactDOM.render(a, b)',
      path: '/root/react.tsx',
      text: 'var render = (a, b) => ReactDOM.render(a, b)',
      errors: [{ message: 'Do not depend on the return value from ReactDOM.render', line: 1, column: 24, endLine: 1, endColumn: 39 }],
    },
    {
      name: '#21 var inst = React.render(<div />, document.body);',
      path: '/root/react.tsx',
      text: 'var inst = React.render(<div />, document.body);',
      settings: { react: { version: '0.14.0' } },
      errors: [{ message: 'Do not depend on the return value from React.render', line: 1, column: 12, endLine: 1, endColumn: 24 }],
    },
    {
      name: "#24 const container = document.getElementById('root') as HTMLEle…",
      path: '/root/main.tsx',
      text: "\n      const container = document.getElementById('root') as HTMLElement;\n      const app = ReactDOM.render(<App />, container);\n    ",
      settings: { react: { version: '19.0' } },
      errors: [{ message: 'Do not depend on the return value from ReactDOM.render', line: 3, column: 19, endLine: 3, endColumn: 34 }],
    },
  ],
})

testRule(rule, {
  valid: [{ name: 'another method of the renderer', path: '/root/file.tsx', text: 'var done = ReactDOM.unmountComponentAtNode(root)' }],
  invalid: [],
})
