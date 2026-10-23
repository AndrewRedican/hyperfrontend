import { testRule } from '../../testing/rule-tester'
import rule from './no-loss-of-precision'

testRule(rule, {
  valid: [
    { name: '#1 var x = 12345', path: '/root/file.ts', text: 'var x = 12345' },
    { name: '#32 var x = .42', path: '/root/file.ts', text: 'var x = .42' },
    { name: '#43 var x = -1_23.8e-3_4', path: '/root/file.ts', text: 'var x = -1_23.8e-3_4' },
    { name: '#55 var x = 0O377777777777777777', path: '/root/file.ts', text: 'var x = 0O377777777777777777' },
    { name: '#58 var x = true', path: '/root/file.ts', text: 'var x = true' },
    { name: "#59 var x = 'abc'", path: '/root/file.ts', text: "var x = 'abc'" },
    { name: '#61 var x = null', path: '/root/file.ts', text: 'var x = null' },
    { name: '#62 var x = undefined', path: '/root/file.ts', text: 'var x = undefined' },
    { name: '#63 var x = {}', path: '/root/file.ts', text: 'var x = {}' },
    { name: '#65 var x = new Date()', path: '/root/file.ts', text: 'var x = new Date()' },
    { name: '#82 a bigint literal is not a number', path: '/root/file.ts', text: 'var x = 100n' },
    { name: '#84 a number literal type', path: '/root/file.ts', text: 'type T = 9007199254740991' },
  ],
  invalid: [
    {
      name: '#104 var x = 1749800579826409539498001781694097092282535544714569…',
      path: '/root/file.ts',
      text: 'var x = 17498005798264095394980017816940970922825355447145699491406164851279623993595007385788105416184430592',
      errors: [{ message: 'This number literal will lose precision at runtime.', line: 1, column: 9, endLine: 1, endColumn: 110 }],
    },
    {
      name: '#105 var x = 2e999',
      path: '/root/file.ts',
      text: 'var x = 2e999',
      errors: [{ message: 'This number literal will lose precision at runtime.', line: 1, column: 9, endLine: 1, endColumn: 14 }],
    },
    {
      name: '#129 const x = 0b100_000_000_000_000_000_000_000_000_000_000_000_…',
      path: '/root/file.ts',
      text: 'const x = 0b100_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000_001;',
      errors: [{ message: 'This number literal will lose precision at runtime.', line: 1, column: 11, endLine: 1, endColumn: 84 }],
    },
    {
      name: '#134 a lossy literal inside an array',
      path: '/root/file.ts',
      text: 'export const a = [9007199254740993, 0]',
      errors: [{ message: 'This number literal will lose precision at runtime.', line: 1, column: 19, endLine: 1, endColumn: 35 }],
    },
    {
      name: '#135 each lossy literal in a file',
      path: '/root/file.ts',
      text: 'var x = 0x20000000000001\nvar y = 5123000000000000000000000000001',
      errors: [
        { message: 'This number literal will lose precision at runtime.', line: 1, column: 9, endLine: 1, endColumn: 25 },
        { message: 'This number literal will lose precision at runtime.', line: 2, column: 9, endLine: 2, endColumn: 40 },
      ],
    },
  ],
})
