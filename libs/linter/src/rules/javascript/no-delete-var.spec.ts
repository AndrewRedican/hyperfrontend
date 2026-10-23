import { testRule } from '../../testing/rule-tester'
import rule from './no-delete-var'

testRule(rule, {
  valid: [
    { name: '#2 a computed member', path: '/root/file.ts', text: 'delete x[0];' },
    { name: '#3 an optional chain', path: '/root/file.ts', text: 'delete x?.y;' },
    { name: '#5 this', path: '/root/file.ts', text: 'function f() { delete this; }' },
    { name: '#7 a TypeScript assertion around the variable', path: '/root/file.ts', text: 'delete (x as any);' },
    { name: '#8 a non-null assertion', path: '/root/file.ts', text: 'delete x!.y;' },
    { name: '#9 other unary operators on a variable', path: '/root/file.ts', text: 'void x; typeof x; !x; -x;' },
    { name: '#10 the word delete as a property', path: '/root/file.ts', text: 'map.delete(x);' },
  ],
  invalid: [
    {
      name: '#11 delete x',
      path: '/root/file.ts',
      text: 'delete x',
      errors: [{ message: 'Variables should not be deleted.', line: 1, column: 1, endLine: 1, endColumn: 9 }],
    },
    {
      name: '#14 a declared variable inside a function',
      path: '/root/file.ts',
      text: 'function f() {\n  var x = 1\n  delete x\n}',
      errors: [{ message: 'Variables should not be deleted.', line: 3, column: 3, endLine: 3, endColumn: 11 }],
    },
    {
      name: '#15 each operand of a sequence',
      path: '/root/file.ts',
      text: 'delete x, delete y;',
      errors: [
        { message: 'Variables should not be deleted.', line: 1, column: 1, endLine: 1, endColumn: 9 },
        { message: 'Variables should not be deleted.', line: 1, column: 11, endLine: 1, endColumn: 19 },
      ],
    },
    {
      name: '#16 a variable in an expression position',
      path: '/root/file.ts',
      text: 'const ok = delete x && delete y.z;',
      errors: [{ message: 'Variables should not be deleted.', line: 1, column: 12, endLine: 1, endColumn: 20 }],
    },
  ],
})
