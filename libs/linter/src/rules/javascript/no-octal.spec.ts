import { testRule } from '../../testing/rule-tester'
import rule from './no-octal'

testRule(rule, {
  valid: [
    { name: "#1 var a = 'hello world';", path: '/root/file.ts', text: "var a = 'hello world';" },
    { name: '#4 a = 0;', path: '/root/file.ts', text: 'a = 0;' },
    { name: '#6 0.5e1', path: '/root/file.ts', text: '0.5e1' },
    { name: '#8 a prefixed octal literal with an upper-case prefix', path: '/root/file.ts', text: '0O17' },
    { name: '#9 a binary literal', path: '/root/file.ts', text: '0b101' },
    { name: '#13 a bigint literal', path: '/root/file.ts', text: '0n' },
    { name: '#14 a string that looks octal', path: '/root/file.ts', text: "'01234'" },
    { name: '#15 a template that looks octal', path: '/root/file.ts', text: '`01234`' },
    { name: '#16 a number with separators', path: '/root/file.ts', text: '1_000' },
    { name: '#17 a number literal type', path: '/root/file.ts', text: 'type T = 0x10' },
  ],
  invalid: [],
})
