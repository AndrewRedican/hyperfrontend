import { testRule } from '../../testing/rule-tester'
import rule from './no-empty'

testRule(rule, {
  valid: [
    { name: '#2 while (foo) { bar() }', path: '/root/file.ts', text: 'while (foo) { bar() }' },
    { name: "#5 switch(foo) {case 'foo': break;}", path: '/root/file.ts', text: "switch(foo) {case 'foo': break;}" },
    { name: '#6 (function() { }())', path: '/root/file.ts', text: '(function() { }())' },
    { name: '#7 var foo = () => {};', path: '/root/file.ts', text: 'var foo = () => {};' },
    { name: '#8 function foo() { }', path: '/root/file.ts', text: 'function foo() { }' },
    { name: '#12 for (;foo;) {/* empty */}', path: '/root/file.ts', text: 'for (;foo;) {/* empty */}' },
    { name: '#15 try { foo() } finally {// empty', path: '/root/file.ts', text: 'try { foo() } finally {// empty\n}' },
    {
      name: '#19 if (foo) { bar() } else { // nothing in me ',
      path: '/root/file.ts',
      text: 'if (foo) { bar() } else { // nothing in me \n}',
    },
    { name: '#25 a class static block is not a block statement', path: '/root/file.ts', text: 'class A { static {} }' },
    { name: '#26 a method body may be empty', path: '/root/file.ts', text: 'class A { m() {} }' },
    { name: '#27 a getter body may be empty', path: '/root/file.ts', text: 'const o = { get a() {} }' },
    { name: '#28 a constructor body may be empty', path: '/root/file.ts', text: 'class A { constructor() {} }' },
    { name: '#30 an empty switch with a line comment on its own line', path: '/root/file.ts', text: 'switch (a) {\n  // nothing\n}' },
    { name: '#32 a namespace body is not a block statement', path: '/root/file.ts', text: 'namespace N {}' },
    { name: '#33 a labelled block with a comment', path: '/root/file.ts', text: 'foo: { /* skip */ }' },
    { name: '#34 a do-while body with a statement', path: '/root/file.ts', text: 'do { a() } while (b)' },
  ],
  invalid: [
    {
      name: '#35 try {} catch (ex) {throw ex}',
      path: '/root/file.ts',
      text: 'try {} catch (ex) {throw ex}',
      errors: [{ message: 'Empty block statement.', line: 1, column: 5, endLine: 1, endColumn: 7 }],
    },
    {
      name: '#41 switch(foo) {}',
      path: '/root/file.ts',
      text: 'switch(foo) {}',
      errors: [{ message: 'Empty switch statement.', line: 1, column: 13, endLine: 1, endColumn: 15 }],
    },
    {
      name: '#45 try {} catch (ex) {} finally {}',
      path: '/root/file.ts',
      text: 'try {} catch (ex) {} finally {}',
      options: { allowEmptyCatch: true },
      errors: [
        { message: 'Empty block statement.', line: 1, column: 5, endLine: 1, endColumn: 7 },
        { message: 'Empty block statement.', line: 1, column: 30, endLine: 1, endColumn: 32 },
      ],
    },
    {
      name: '#49 an empty for-of body',
      path: '/root/file.ts',
      text: 'for (const x of xs) {}',
      errors: [{ message: 'Empty block statement.', line: 1, column: 21, endLine: 1, endColumn: 23 }],
    },
    {
      name: '#50 an empty for-in body',
      path: '/root/file.ts',
      text: 'for (const k in o) {}',
      errors: [{ message: 'Empty block statement.', line: 1, column: 20, endLine: 1, endColumn: 22 }],
    },
    {
      name: '#54 an empty block spanning lines reports its full range',
      path: '/root/file.ts',
      text: 'if (a) {\n\n}',
      errors: [{ message: 'Empty block statement.', line: 1, column: 8, endLine: 3, endColumn: 2 }],
    },
    {
      name: '#56 an empty catch block with a typed parameter',
      path: '/root/file.ts',
      text: 'try { a() } catch (e: unknown) {}',
      errors: [{ message: 'Empty block statement.', line: 1, column: 32, endLine: 1, endColumn: 34 }],
    },
    {
      name: '#59 an empty block inside a switch case',
      path: '/root/file.ts',
      text: 'switch (a) { case 1: {} }',
      errors: [{ message: 'Empty block statement.', line: 1, column: 22, endLine: 1, endColumn: 24 }],
    },
  ],
})
