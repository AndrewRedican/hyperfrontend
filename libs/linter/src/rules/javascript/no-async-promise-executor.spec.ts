import { testRule } from '../../testing/rule-tester'
import rule from './no-async-promise-executor'

testRule(rule, {
  valid: [
    {
      name: '#2 new Promise((resolve, reject) => {}, async function unrelate…',
      path: '/root/file.ts',
      text: 'new Promise((resolve, reject) => {}, async function unrelated() {})',
    },
    { name: '#4 a plain function executor', path: '/root/file.ts', text: 'new Promise(function (resolve) { resolve() })' },
    { name: '#7 a member callee is not matched by name', path: '/root/file.ts', text: 'new window.Promise(async (resolve) => {})' },
    { name: '#8 an executor produced by a call', path: '/root/file.ts', text: 'new Promise(executor.bind(this))' },
    { name: '#10 a typed synchronous executor', path: '/root/file.ts', text: 'const p = new Promise<number>((resolve) => resolve(1))' },
  ],
  invalid: [
    {
      name: '#14 new Promise(((((async () => {})))))',
      path: '/root/file.ts',
      text: 'new Promise(((((async () => {})))))',
      errors: [{ message: 'Promise executor functions should not be async.', line: 1, column: 17, endLine: 1, endColumn: 22 }],
    },
    {
      name: '#15 an async arrow executor of a typed construction',
      path: '/root/file.ts',
      text: 'new Promise<void>(async (resolve) => { await x; resolve() })',
      errors: [{ message: 'Promise executor functions should not be async.', line: 1, column: 19, endLine: 1, endColumn: 24 }],
    },
    {
      name: '#19 an async arrow with typed parameters',
      path: '/root/file.ts',
      text: 'new Promise(async (resolve: (value: number) => void) => { resolve(1) })',
      errors: [{ message: 'Promise executor functions should not be async.', line: 1, column: 13, endLine: 1, endColumn: 18 }],
    },
    {
      name: '#20 every async executor in a file',
      path: '/root/file.ts',
      text: 'new Promise(async () => {})\nnew Promise(async function () {})',
      errors: [
        { message: 'Promise executor functions should not be async.', line: 1, column: 13, endLine: 1, endColumn: 18 },
        { message: 'Promise executor functions should not be async.', line: 2, column: 13, endLine: 2, endColumn: 18 },
      ],
    },
  ],
})
