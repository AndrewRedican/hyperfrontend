import { testRule } from '../../testing/rule-tester'
import rule from './jsx-no-undef'

// why: the workspace runs the rule with its default options; the `allowGlobals: true` case is left out.
testRule(rule, {
  valid: [
    { name: '#1 var React, App; React.render(<App />);', path: '/root/react.tsx', text: 'var React, App; React.render(<App />);' },
    { name: '#3 var React; React.render(<x-gif />);', path: '/root/react.tsx', text: 'var React; React.render(<x-gif />);' },
    {
      name: '#7 var React;',
      path: '/root/react.tsx',
      text: '\n        var React;\n        class Hello extends React.Component {\n          render() {\n            return <this.props.tag />\n          }\n        }\n      ',
    },
    {
      name: '#8 var React; React.render(<Text />);',
      path: '/root/react.tsx',
      text: 'var React; React.render(<Text />);',
      language: { globals: { Text: 'writable' } },
    },
    {
      name: '#9 import Text from "cool-module";',
      path: '/root/react.tsx',
      text: '\n        import Text from "cool-module";\n        const TextWrapper = function (props) {\n          return (\n            <Text />\n          );\n        };\n      ',
      options: { allowGlobals: false },
      language: { jsxPragma: null },
    },
    {
      name: "#10 import { List } from './list';",
      path: '/root/names.tsx',
      text: "\n      import { List } from './list';\n      export const Names = ({ names }: { names: string[] }) => <List<string> items={names} />;\n    ",
      settings: { react: { version: '19.0' } },
    },
    {
      name: '#13 function outer() {',
      path: '/root/react.tsx',
      text: '\n      function outer() {\n        function inner() {\n          const Nested = 1;\n        }\n      }\n      export default <Nested />;\n    ',
    },
    { name: '#14 <svg:circle />;', path: '/root/react.tsx', text: '<svg:circle />;' },
  ],
  invalid: [
    {
      name: '#19 const TextWrapper = function (props) {',
      path: '/root/react.tsx',
      text: '\n        const TextWrapper = function (props) {\n          return (\n            <Text />\n          );\n        };\n        export default TextWrapper;\n      ',
      options: { allowGlobals: false },
      language: { globals: { Text: 'writable' }, jsxPragma: null },
      errors: [{ message: "'Text' is not defined.", line: 4, column: 14, endLine: 4, endColumn: 18 }],
    },
    {
      name: '#21 export const Card = () => <Iconz.Star size={2} />;',
      path: '/root/card.tsx',
      text: '\n      export const Card = () => <Iconz.Star size={2} />;\n    ',
      settings: { react: { version: '19.0' } },
      errors: [{ message: "'Iconz' is not defined.", line: 2, column: 34, endLine: 2, endColumn: 39 }],
    },
    {
      name: "#22 import { Icon } from './icon';",
      path: '/root/card.tsx',
      text: "\n      import { Icon } from './icon';\n      export const Card = () => (\n        <section>\n          <Icn />\n        </section>\n      );\n    ",
      settings: { react: { version: '19.0' } },
      errors: [{ message: "'Icn' is not defined.", line: 5, column: 12, endLine: 5, endColumn: 15 }],
    },
    {
      name: '#23 function outer() {',
      path: '/root/react.tsx',
      text: '\n      function outer() {\n        var Hidden;\n      }\n      function later() {\n        var Shown;\n      }\n      React.render(<Shown />);\n    ',
      errors: [{ message: "'Shown' is not defined.", line: 8, column: 21, endLine: 8, endColumn: 26 }],
    },
  ],
})
