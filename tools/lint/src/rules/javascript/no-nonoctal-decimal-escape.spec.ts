import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-nonoctal-decimal-escape.ts'

testRule(rule, {
  valid: [
    { name: '#1 8', path: '/root/file.ts', text: '8' },
    { name: '#2 var \\u8888', path: '/root/file.ts', text: 'var \\u8888' },
    { name: '#3 /\\8/', path: '/root/file.ts', text: '/\\8/' },
    { name: "#14 '\\0'", path: '/root/file.ts', text: "'\\0'" },
    { name: "#29 '\\x99'", path: '/root/file.ts', text: "'\\x99'" },
    { name: "#33 '\\", path: '/root/file.ts', text: "'\\\n\\\\9'" },
    { name: '#34 a tagged template, whose quasis are not literals', path: '/root/file.ts', text: 'tag`\\8`' },
    { name: '#35 JSX text, which is not a literal', path: '/root/react.tsx', text: '<div>\\8</div>' },
    { name: '#37 a JSX attribute with a digit and no backslash', path: '/root/react.tsx', text: '<div a="8" b=\'9\' />' },
  ],
  invalid: [
    {
      name: '#54 two escapes around an octal escape',
      path: '/root/react.tsx',
      text: '<div a="\\8\\1\\9" />;',
      errors: [
        { message: "Don't use '\\8' escape sequence.", line: 1, column: 9, endLine: 1, endColumn: 11 },
        { message: "Don't use '\\9' escape sequence.", line: 1, column: 13, endLine: 1, endColumn: 15 },
      ],
    },
    {
      name: '#57 an escape on the second line of an attribute',
      path: '/root/react.tsx',
      text: '<div a="x\n\\9" />;',
      errors: [{ message: "Don't use '\\9' escape sequence.", line: 2, column: 1, endLine: 2, endColumn: 3 }],
    },
  ],
})
