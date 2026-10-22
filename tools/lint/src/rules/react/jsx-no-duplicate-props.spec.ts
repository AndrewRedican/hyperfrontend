import { testRule } from '../../testing/rule-tester.ts'
import rule from './jsx-no-duplicate-props.ts'

// why: the workspace runs the rule with its default options; the `ignoreCase: true` cases are left out.
testRule(rule, {
  valid: [
    { name: '#2 <App {...this.props} />;', path: '/root/react.tsx', text: '<App {...this.props} />;' },
    { name: '#3 <App a b c />;', path: '/root/react.tsx', text: '<App a b c />;' },
    { name: '#14 <App a:b="c" a:c="d" />;', path: '/root/react.tsx', text: '<App a:b="c" a:c="d" />;' },
  ],
  invalid: [
    {
      name: '#24 export const Field = ({ id }: { id: string }) => <input id={…',
      path: '/root/field.tsx',
      text: '\n      export const Field = ({ id }: { id: string }) => <input id={id} {...rest} id="fixed" />;\n    ',
      settings: { react: { version: '19.0' } },
      errors: [{ message: 'No duplicate props allowed', line: 2, column: 81, endLine: 2, endColumn: 91 }],
    },
  ],
})
