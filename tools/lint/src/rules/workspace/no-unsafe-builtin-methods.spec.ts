import { testRule } from '@hyperfrontend/linter/testing'
import rule from './no-unsafe-builtin-methods.ts'

// why: the recorded cases name temporary paths the rule reads only for the copies' directory and test-file names.
testRule(rule, {
  valid: [
    {
      name: '#1 does not trigger for built-in-copy directory',
      path: '/root/tmp/eslint-test-ESU7O4/src/built-in-copy/object.ts',
      text: 'const obj = Object.freeze({ a: 1 });',
    },
    {
      name: '#5 does not trigger for safe global function imports',
      path: '/root/tmp/eslint-test-lvWC3q/src/index.ts',
      text: "import { setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers';\nsetTimeout(() => {}, 100);",
    },
    {
      name: '#7 does not trigger for computed property access',
      path: '/root/tmp/eslint-test-1klgBM/src/index.ts',
      text: 'const result = Object["freeze"]({ a: 1 });',
    },
    {
      name: '#10 does not trigger for non-prototype call',
      path: '/root/tmp/eslint-test-U0ylv2/src/index.ts',
      text: 'const result = myObj.property.method.call(context);',
    },
  ],
  invalid: [
    {
      name: '#25 triggers for new Promise()',
      path: '/root/tmp/eslint-test-jMdZyG/src/index.ts',
      text: 'const p = new Promise((resolve) => resolve(1));',
      errors: [
        {
          message:
            "Use 'createPromise' from '@hyperfrontend/immutable-api-utils/built-in-copy/promise' instead of 'new Promise()' to protect against prototype pollution.",
          line: 1,
          column: 11,
          endLine: 1,
          endColumn: 47,
        },
      ],
    },
    {
      name: '#26 triggers for Object.prototype.hasOwnProperty.call',
      path: '/root/tmp/eslint-test-Z9X1qH/src/index.ts',
      text: 'const has = Object.prototype.hasOwnProperty.call(obj, "key");',
      errors: [
        {
          message:
            "Use 'hasOwn' from '@hyperfrontend/immutable-api-utils/built-in-copy/object' instead of 'Object.prototype.hasOwnProperty.call()' to protect against prototype pollution.",
          line: 1,
          column: 13,
          endLine: 1,
          endColumn: 61,
        },
      ],
    },
    {
      name: '#27 triggers for multiple violations',
      path: '/root/tmp/eslint-test-5V6clB/src/index.ts',
      text: 'const obj = Object.freeze({ a: 1 });\nconst keys = Object.keys(obj);\nconst arr = Array.from(keys);',
      errors: [
        {
          message:
            "Use 'freeze' from '@hyperfrontend/immutable-api-utils/built-in-copy/object' instead of direct 'Object.freeze' access to protect against prototype pollution.",
          line: 1,
          column: 13,
          endLine: 1,
          endColumn: 26,
        },
        {
          message:
            "Use 'keys' from '@hyperfrontend/immutable-api-utils/built-in-copy/object' instead of direct 'Object.keys' access to protect against prototype pollution.",
          line: 2,
          column: 14,
          endLine: 2,
          endColumn: 25,
        },
        {
          message:
            "Use 'from' from '@hyperfrontend/immutable-api-utils/built-in-copy/array' instead of direct 'Array.from' access to protect against prototype pollution.",
          line: 3,
          column: 13,
          endLine: 3,
          endColumn: 23,
        },
      ],
    },
    {
      name: '#29 triggers for setTimeout',
      path: '/root/tmp/eslint-test-cB1Jqu/src/index.ts',
      text: 'setTimeout(() => {}, 100);',
      errors: [
        {
          message:
            "Use 'setTimeout' from '@hyperfrontend/immutable-api-utils/built-in-copy/timers' instead of 'setTimeout' to protect against prototype pollution.",
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 26,
        },
      ],
    },
    {
      name: '#42 triggers for Promise.all()',
      path: '/root/tmp/eslint-test-sCs6eI/src/index.ts',
      text: 'const result = Promise.all([]);',
      errors: [
        {
          message:
            "Use 'promiseAll' from '@hyperfrontend/immutable-api-utils/built-in-copy/promise' instead of direct 'Promise.all' access to protect against prototype pollution.",
          line: 1,
          column: 16,
          endLine: 1,
          endColumn: 27,
        },
      ],
    },
  ],
})

// why: the cases recorded from the previous linter leave imported copies, other prototype calls and other members unexercised.
testRule(rule, {
  valid: [
    {
      name: 'an imported timer copy',
      path: '/root/file.ts',
      text: "import { setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'\nsetTimeout(() => {}, 1)",
    },
    { name: 'another prototype method', path: '/root/file.ts', text: 'Object.prototype.valueOf.call(x)' },
    { name: 'another prototype owner', path: '/root/file.ts', text: 'Array.prototype.toString.call(x)' },
    { name: 'a computed prototype method', path: '/root/file.ts', text: "Object.prototype['toString'].call(x)" },
    { name: 'a call through a shallow member', path: '/root/file.ts', text: 'fn.call(x)' },
    { name: 'a call through a computed chain', path: '/root/file.ts', text: 'a[0].b.call(x)' },
    { name: 'a member of a call result', path: '/root/file.ts', text: 'make().freeze' },
    { name: 'an import from another package', path: '/root/file.ts', text: "import { x } from 'other'" },
    { name: 'an unknown static', path: '/root/file.ts', text: 'Object.is(a, b)' },
    { name: 'a constructor of a member', path: '/root/file.ts', text: 'new globalThis.Map()' },
    { name: 'a default import from the package', path: '/root/file.ts', text: "import copies from '@hyperfrontend/immutable-api-utils'" },
  ],
  invalid: [],
})
