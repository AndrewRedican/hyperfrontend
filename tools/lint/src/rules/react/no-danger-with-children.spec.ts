import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-danger-with-children.ts'

testRule(rule, {
  valid: [
    { name: '#1 <div>Children</div>', path: '/root/react.tsx', text: '<div>Children</div>' },
    { name: '#2 <div {...props} />', path: '/root/react.tsx', text: '<div {...props} />', language: { globals: { props: 'writable' } } },
    { name: '#4 <div children="Children" />', path: '/root/react.tsx', text: '<div children="Children" />' },
    {
      name: '#7 const otherProps = { children: "Children" };',
      path: '/root/react.tsx',
      text: '\n        const otherProps = { children: "Children" };\n        const { a, b, ...props } = otherProps;\n        <div {...props} />\n      ',
    },
    {
      name: '#11 React.createElement("div", { dangerouslySetInnerHTML: { __ht…',
      path: '/root/react.tsx',
      text: 'React.createElement("div", { dangerouslySetInnerHTML: { __html: "HTML" } });',
    },
    { name: '#15 <Hello {...undefined}>Children</Hello>', path: '/root/react.tsx', text: '<Hello {...undefined}>Children</Hello>' },
    {
      name: '#16 React.createElement("Hello", undefined, "Children")',
      path: '/root/react.tsx',
      text: 'React.createElement("Hello", undefined, "Children")',
    },
    {
      name: '#20 export const Html = ({ html, text }: { html: string; text: s…',
      path: '/root/html.tsx',
      text: '\n      export const Html = ({ html, text }: { html: string; text: string }) => (\n        <div dangerouslySetInnerHTML={{ __html: html }}>\n          {text}\n        </div>\n      );\n    ',
      settings: { react: { version: '19.0' } },
    },
    {
      name: "#22 React.createElement('div', { ...getProps(), children: 'Child…",
      path: '/root/react.tsx',
      text: "React.createElement('div', { ...getProps(), children: 'Children' });",
    },
    {
      name: "#24 React['createElement']('div', { dangerouslySetInnerHTML: { _…",
      path: '/root/react.tsx',
      text: "React['createElement']('div', { dangerouslySetInnerHTML: { __html: 'HTML' } }, 'Children');",
    },
  ],
  invalid: [
    {
      name: '#27 const props = { dangerouslySetInnerHTML: { __html: "HTML" } …',
      path: '/root/react.tsx',
      text: '\n        const props = { dangerouslySetInnerHTML: { __html: "HTML" } };\n        <div {...props}>Children</div>\n      ',
      errors: [{ message: 'Only set one of `children` or `props.dangerouslySetInnerHTML`', line: 3, column: 9, endLine: 3, endColumn: 39 }],
    },
    {
      name: '#38 const moreProps = { children: "Children" };',
      path: '/root/react.tsx',
      text: '\n        const moreProps = { children: "Children" };\n        const otherProps = { ...moreProps };\n        const props = { ...otherProps, dangerouslySetInnerHTML: { __html: "HTML" } };\n        React.createElement("div", props);\n      ',
      errors: [{ message: 'Only set one of `children` or `props.dangerouslySetInnerHTML`', line: 5, column: 9, endLine: 5, endColumn: 42 }],
    },
  ],
})

testRule(rule, {
  valid: [{ name: 'a spread parameter', path: '/root/file.tsx', text: 'function F(props) { return <div {...props}>x</div> }' }],
  invalid: [],
})
