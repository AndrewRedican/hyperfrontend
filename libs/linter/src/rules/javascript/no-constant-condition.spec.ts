import { testRule } from '../../testing/rule-tester'
import rule from './no-constant-condition'

// why: the workspace checks every loop but `while (true)`; the cases recorded with other loop options are left out.
// why: a case that turns `undefined` off as a global is left out, as this linter keeps the language's globals declared.
testRule(rule, {
  valid: [
    { name: '#8 if(a >>= 1);', path: '/root/file.ts', text: 'if(a >>= 1);' },
    { name: '#27 if((a ||= true) && b);', path: '/root/file.ts', text: 'if((a ||= true) && b);' },
    {
      name: '#48 a logical or assignment whose right side is behind a type assertion',
      path: '/root/file.ts',
      text: 'if (a ||= (1 as number)) {}',
    },
    { name: '#89 for(;;);', path: '/root/file.ts', text: 'for(;;);' },
    { name: '#94 while(tag`${a}`) {}', path: '/root/file.ts', text: 'while(tag`${a}`) {}' },
    { name: '#102 while(true);', path: '/root/file.ts', text: 'while(true);', options: { checkLoops: 'allExceptWhileTrue' } },
    {
      name: "#108 function* foo(){for(;true;){yield 'foo';}}",
      path: '/root/file.ts',
      text: "function* foo(){for(;true;){yield 'foo';}}",
    },
    {
      name: '#114 function* foo() { for (let x = yield; x < 10; x++) {yield;}y…',
      path: '/root/file.ts',
      text: 'function* foo() { for (let x = yield; x < 10; x++) {yield;}yield;}',
    },
    {
      name: '#122 a loop over a variable inside a function expression',
      path: '/root/file.ts',
      text: 'const k = function () { do {} while (x) }',
    },
    {
      name: '#123 a for-of and a for-in loop are not tests',
      path: '/root/file.ts',
      text: 'for (const a of [1]) {} for (const k in {}) {}',
    },
    { name: '#186 if(1, a);', path: '/root/file.ts', text: 'if(1, a);' },
    { name: '#199 q > 0 ? 1 : 2;', path: '/root/file.ts', text: 'q > 0 ? 1 : 2;' },
    { name: '#202 tag`a` === a ? 1 : 2', path: '/root/file.ts', text: 'tag`a` === a ? 1 : 2' },
    { name: "#206 if(a === 'str' && typeof b){}", path: '/root/file.ts', text: "if(a === 'str' && typeof b){}" },
    { name: '#207 typeof a == typeof b', path: '/root/file.ts', text: 'typeof a == typeof b' },
    { name: "#241 if ('' + [y, m, d] === 'a') {}", path: '/root/file.ts', text: "if ('' + [y, m, d] === 'a') {}" },
    { name: '#244 if ([,] in', path: '/root/file.ts', text: 'if ([,] in\n\n($2))\n ;\nelse\n ;' },
    { name: '#246 if (new Number(x) + 1 === 2) {}', path: '/root/file.ts', text: 'if (new Number(x) + 1 === 2) {}' },
    { name: '#256 if (Boolean(...args)) {}', path: '/root/file.ts', text: 'if (Boolean(...args)) {}' },
    { name: '#257 if (foo.Boolean(1)) {}', path: '/root/file.ts', text: 'if (foo.Boolean(1)) {}' },
    {
      name: '#258 function foo(Boolean) { if (Boolean(1)) {} }',
      path: '/root/file.ts',
      text: 'function foo(Boolean) { if (Boolean(1)) {} }',
    },
    {
      name: '#259 const Boolean = () => {}; if (Boolean(1)) {}',
      path: '/root/file.ts',
      text: 'const Boolean = () => {}; if (Boolean(1)) {}',
    },
    {
      name: "#260 const undefined = 'lol'; if (undefined) {}",
      path: '/root/file.ts',
      text: "const undefined = 'lol'; if (undefined) {}",
    },
    { name: '#263 a non-null assertion is not evaluated', path: '/root/file.ts', text: 'if (a!) {}' },
    { name: '#271 an await in the test', path: '/root/file.ts', text: 'async function f() { if (await x) {} }' },
  ],
  invalid: [
    {
      name: '#55 if(a ||= b || /regex/);',
      path: '/root/file.ts',
      text: 'if(a ||= b || /regex/);',
      errors: [{ message: 'Unexpected constant condition.', line: 1, column: 4, endLine: 1, endColumn: 22 }],
    },
    {
      name: '#75 if((a &&= null) && b);',
      path: '/root/file.ts',
      text: 'if((a &&= null) && b);',
      errors: [{ message: 'Unexpected constant condition.', line: 1, column: 4, endLine: 1, endColumn: 21 }],
    },
    {
      name: '#132 do{}while(t = -2)',
      path: '/root/file.ts',
      text: 'do{}while(t = -2)',
      errors: [{ message: 'Unexpected constant condition.', line: 1, column: 11, endLine: 1, endColumn: 17 }],
    },
    {
      name: '#162 function* foo() {for (foo = yield; true;) {}}',
      path: '/root/file.ts',
      text: 'function* foo() {for (foo = yield; true;) {}}',
      errors: [{ message: 'Unexpected constant condition.', line: 1, column: 36, endLine: 1, endColumn: 40 }],
    },
    {
      name: '#165 function* foo() { for (let foo = 1 + 2 + 3 + (yield); true; …',
      path: '/root/file.ts',
      text: 'function* foo() { for (let foo = 1 + 2 + 3 + (yield); true; baz) {}}',
      errors: [{ message: 'Unexpected constant condition.', line: 1, column: 55, endLine: 1, endColumn: 59 }],
    },
    {
      name: '#169 an empty options object checks loops other than while-true',
      path: '/root/file.ts',
      text: 'while (1) {} for (; true;) {}',
      options: {},
      errors: [
        { message: 'Unexpected constant condition.', line: 1, column: 8, endLine: 1, endColumn: 9 },
        { message: 'Unexpected constant condition.', line: 1, column: 21, endLine: 1, endColumn: 25 },
      ],
    },
    {
      name: '#182 a constant loop in a class method',
      path: '/root/file.ts',
      text: 'class A { run(): void { while (1) {} } }',
      errors: [{ message: 'Unexpected constant condition.', line: 1, column: 32, endLine: 1, endColumn: 33 }],
    },
    {
      name: '#276 (q = 0) ? 1 : 2;',
      path: '/root/file.ts',
      text: '(q = 0) ? 1 : 2;',
      errors: [{ message: 'Unexpected constant condition.', line: 1, column: 2, endLine: 1, endColumn: 7 }],
    },
    {
      name: '#289 if(`\\',
      path: '/root/file.ts',
      text: 'if(`\\\n`);',
      errors: [{ message: 'Unexpected constant condition.', line: 1, column: 4, endLine: 2, endColumn: 2 }],
    },
    {
      name: "#336 if ([,] + ''){}",
      path: '/root/file.ts',
      text: "if ([,] + ''){}",
      errors: [{ message: 'Unexpected constant condition.', line: 1, column: 5, endLine: 1, endColumn: 13 }],
    },
    {
      name: '#337 if(/foo/ui);',
      path: '/root/file.ts',
      text: 'if(/foo/ui);',
      errors: [{ message: 'Unexpected constant condition.', line: 1, column: 4, endLine: 1, endColumn: 11 }],
    },
    {
      name: '#339 if(0b0n);',
      path: '/root/file.ts',
      text: 'if(0b0n);',
      errors: [{ message: 'Unexpected constant condition.', line: 1, column: 4, endLine: 1, endColumn: 8 }],
    },
    {
      name: '#340 if(0o0n);',
      path: '/root/file.ts',
      text: 'if(0o0n);',
      errors: [{ message: 'Unexpected constant condition.', line: 1, column: 4, endLine: 1, endColumn: 8 }],
    },
    {
      name: '#341 if(0x0n);',
      path: '/root/file.ts',
      text: 'if(0x0n);',
      errors: [{ message: 'Unexpected constant condition.', line: 1, column: 4, endLine: 1, endColumn: 8 }],
    },
    {
      name: '#346 if(class {}) {}',
      path: '/root/file.ts',
      text: 'if(class {}) {}',
      errors: [{ message: 'Unexpected constant condition.', line: 1, column: 4, endLine: 1, endColumn: 12 }],
    },
    {
      name: "#351 if(`${[...['a']]}`) {}",
      path: '/root/file.ts',
      text: "if(`${[...['a']]}`) {}",
      errors: [{ message: 'Unexpected constant condition.', line: 1, column: 4, endLine: 1, endColumn: 19 }],
    },
    {
      name: '#365 an object with properties',
      path: '/root/file.ts',
      text: 'if ({ a }) {}',
      errors: [{ message: 'Unexpected constant condition.', line: 1, column: 5, endLine: 1, endColumn: 10 }],
    },
    {
      name: '#366 an arrow function',
      path: '/root/file.ts',
      text: 'if (() => 1) {}',
      errors: [{ message: 'Unexpected constant condition.', line: 1, column: 5, endLine: 1, endColumn: 12 }],
    },
  ],
})
