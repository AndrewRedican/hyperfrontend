import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-children-prop.ts'

// why: the workspace runs the rule with its default options; the `allowFunctions: true` cases are left out.
testRule(rule, {
  valid: [
    { name: '#1 <div />;', path: '/root/react.tsx', text: '<div />;' },
    {
      name: '#11 <div className="class-name">Children</div>;',
      path: '/root/react.tsx',
      text: '<div className="class-name">Children</div>;',
    },
    { name: '#13 <div><div /></div>;', path: '/root/react.tsx', text: '<div><div /></div>;' },
    {
      name: '#22 React.createElement("div", {}, [React.createElement("div"), …',
      path: '/root/react.tsx',
      text: 'React.createElement("div", {}, [React.createElement("div"), React.createElement("div")]);',
    },
    {
      name: '#36 <MyComponent className="class-name" {...props} />;',
      path: '/root/react.tsx',
      text: '<MyComponent className="class-name" {...props} />;',
    },
    {
      name: '#46 export const Label = ({ text }: { text: string }) => <span>{…',
      path: '/root/label.tsx',
      text: '\n      export const Label = ({ text }: { text: string }) => <span>{text}</span>;\n    ',
      settings: { react: { version: '19.0' } },
    },
    {
      name: "#48 React.createElement('div', { ['children']: 'computed key' })…",
      path: '/root/react.tsx',
      text: "React.createElement('div', { ['children']: 'computed key' });",
    },
  ],
  invalid: [
    {
      name: '#52 <div children />;',
      path: '/root/react.tsx',
      text: '<div children />;',
      errors: [
        {
          message: 'Do not pass children as props. Instead, nest children between the opening and closing tags.',
          line: 1,
          column: 6,
          endLine: 1,
          endColumn: 14,
        },
      ],
    },
    {
      name: '#63 <MyComponent className="class-name" children="Children" />;',
      path: '/root/react.tsx',
      text: '<MyComponent className="class-name" children="Children" />;',
      errors: [
        {
          message: 'Do not pass children as props. Instead, nest children between the opening and closing tags.',
          line: 1,
          column: 37,
          endLine: 1,
          endColumn: 56,
        },
      ],
    },
    {
      name: '#66 React.createElement(MyComponent, {...props, children: "Child…',
      path: '/root/react.tsx',
      text: 'React.createElement(MyComponent, {...props, children: "Children"})',
      errors: [
        {
          message: 'Do not pass children as props. Instead, pass them as additional arguments to React.createElement.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 67,
        },
      ],
    },
    {
      name: '#75 export const Label = ({ text }: { text: string }) => <span c…',
      path: '/root/label.tsx',
      text: '\n      export const Label = ({ text }: { text: string }) => <span children={text} />;\n    ',
      settings: { react: { version: '19.0' } },
      errors: [
        {
          message: 'Do not pass children as props. Instead, nest children between the opening and closing tags.',
          line: 2,
          column: 66,
          endLine: 2,
          endColumn: 81,
        },
      ],
    },
    {
      name: "#76 import { createElement } from 'react';",
      path: '/root/label.tsx',
      text: "\n      import { createElement } from 'react';\n      export const label = createElement('span', {\n        children: 'text',\n      });\n    ",
      settings: { react: { version: '19.0' } },
      errors: [
        {
          message: 'Do not pass children as props. Instead, pass them as additional arguments to React.createElement.',
          line: 3,
          column: 28,
          endLine: 5,
          endColumn: 9,
        },
      ],
    },
  ],
})
