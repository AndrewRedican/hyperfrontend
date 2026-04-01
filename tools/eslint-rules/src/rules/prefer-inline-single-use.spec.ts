import type { InvalidTestCase, ValidTestCase } from '@typescript-eslint/rule-tester'
import { RuleTester } from '@typescript-eslint/rule-tester'
import rule, { RULE_NAME } from './prefer-inline-single-use'

type TestOptions = readonly []
type MessageIds = 'preferInline'

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: false,
    },
  },
})

/**
 * Valid cases - variables that are used multiple times or have side effects.
 */
const validCases: ValidTestCase<TestOptions>[] = [
  {
    name: 'allows const used more than once',
    code: `
      const value = 42;
      console.log(value);
      console.log(value);
    `,
  },
  {
    name: 'allows unused const (handled by no-unused-vars)',
    code: `
      const unused = 42;
    `,
  },
  {
    name: 'allows let declaration',
    code: `
      let value = 42;
      console.log(value);
    `,
  },
  {
    name: 'allows var declaration',
    code: `
      var value = 42;
      console.log(value);
    `,
  },
  {
    name: 'allows exported const',
    code: `
      export const value = 42;
      console.log(value);
    `,
  },
  {
    name: 'allows function call initializer (side effect)',
    code: `
      const value = getData();
      console.log(value);
    `,
  },
  {
    name: 'allows await expression (side effect)',
    code: `
      const value = await fetch('/api');
      console.log(value);
    `,
  },
  {
    name: 'allows new expression (side effect)',
    code: `
      const instance = new MyClass();
      process(instance);
    `,
  },
  {
    name: 'allows object destructuring',
    code: `
      const { a, b } = obj;
      console.log(a);
    `,
  },
  {
    name: 'allows array destructuring',
    code: `
      const [first, second] = arr;
      console.log(first);
    `,
  },
  {
    name: 'allows multiple declarators',
    code: `
      const a = 1, b = 2;
      console.log(a);
    `,
  },
  {
    name: 'allows self-reference',
    code: `
      const fn = () => fn;
      console.log(fn);
    `,
  },
  {
    name: 'allows const used in for loop condition',
    code: `
      const limit = 10;
      for (let i = 0; i < limit; i++) {}
    `,
  },
  {
    name: 'allows const used in for loop update',
    code: `
      const step = 2;
      for (let i = 0; i < 10; i += step) {}
    `,
  },
  {
    name: 'allows const used in while condition',
    code: `
      const shouldContinue = true;
      while (shouldContinue) { break; }
    `,
  },
  {
    name: 'allows const used in do-while condition',
    code: `
      const shouldContinue = false;
      do { } while (shouldContinue);
    `,
  },
  {
    name: 'allows write reference on object property',
    code: `
      const obj = { x: 1 };
      obj.x = 2;
    `,
  },
  {
    name: 'allows named export that references the const',
    code: `
      const value = 42;
      export { value };
    `,
  },
  {
    name: 'allows yield expression',
    code: `
      function* gen() {
        const value = yield 1;
        console.log(value);
      }
    `,
  },
  {
    name: 'allows tagged template expression (function call)',
    code: `
      const str = tag\`template\`;
      console.log(str);
    `,
  },
  {
    name: 'allows spread element in array',
    code: `
      const arr = [...other];
      console.log(arr);
    `,
  },
  {
    name: 'allows const used twice via separate references',
    code: `
      const val = 42;
      const a = val;
      const b = val;
    `,
  },
  {
    name: 'allows computed property in object',
    code: `
      const obj = { [key]: value };
      console.log(obj);
    `,
  },
  {
    name: 'allows spread property in object',
    code: `
      const obj = { ...other };
      console.log(obj);
    `,
  },
  {
    name: 'allows const without initializer',
    code: `
      declare const value: number;
      console.log(value);
    `,
  },
]

/**
 * Invalid cases - single-use const that should be inlined.
 */
const invalidCases: InvalidTestCase<MessageIds, TestOptions>[] = [
  {
    name: 'flags simple numeric literal',
    code: `const value = 42;
console.log(value);`,
    output: `console.log(42);`,
    errors: [{ messageId: 'preferInline', data: { name: 'value' } }],
  },
  {
    name: 'flags string literal',
    code: `const message = 'hello';
console.log(message);`,
    output: `console.log('hello');`,
    errors: [{ messageId: 'preferInline', data: { name: 'message' } }],
  },
  {
    name: 'flags template literal',
    code: `const greeting = \`hello world\`;
console.log(greeting);`,
    output: `console.log(\`hello world\`);`,
    errors: [{ messageId: 'preferInline', data: { name: 'greeting' } }],
  },
  {
    name: 'flags boolean literal',
    code: `const flag = true;
if (flag) {}`,
    output: `if (true) {}`,
    errors: [{ messageId: 'preferInline', data: { name: 'flag' } }],
  },
  {
    name: 'flags null literal',
    code: `const nothing = null;
process(nothing);`,
    output: `process(null);`,
    errors: [{ messageId: 'preferInline', data: { name: 'nothing' } }],
  },
  {
    name: 'flags array expression',
    code: `const items = [1, 2, 3];
console.log(items);`,
    output: `console.log([1, 2, 3]);`,
    errors: [{ messageId: 'preferInline', data: { name: 'items' } }],
  },
  {
    name: 'flags object expression in call',
    code: `const config = { a: 1 };
process(config);`,
    output: `process({ a: 1 });`,
    errors: [{ messageId: 'preferInline', data: { name: 'config' } }],
  },
  {
    name: 'flags arrow function',
    code: `const fn = () => 42;
call(fn);`,
    output: `call(() => 42);`,
    errors: [{ messageId: 'preferInline', data: { name: 'fn' } }],
  },
  {
    name: 'flags arrow function with body',
    code: `const fn = () => { return 42; };
call(fn);`,
    output: `call(() => { return 42; });`,
    errors: [{ messageId: 'preferInline', data: { name: 'fn' } }],
  },
  {
    name: 'flags function expression',
    code: `const fn = function() { return 42; };
call(fn);`,
    output: `call(function() { return 42; });`,
    errors: [{ messageId: 'preferInline', data: { name: 'fn' } }],
  },
  {
    name: 'flags binary expression in call (no parens needed)',
    code: `const sum = 1 + 2;
call(sum);`,
    output: `call(1 + 2);`,
    errors: [{ messageId: 'preferInline', data: { name: 'sum' } }],
  },
  {
    name: 'flags binary expression with parens for member access',
    code: `const result = a + b;
console.log(result.toString());`,
    output: `console.log((a + b).toString());`,
    errors: [{ messageId: 'preferInline', data: { name: 'result' } }],
  },
  {
    name: 'flags unary expression',
    code: `const negated = !flag;
process(negated);`,
    output: `process(!flag);`,
    errors: [{ messageId: 'preferInline', data: { name: 'negated' } }],
  },
  {
    name: 'flags conditional expression in call',
    code: `const choice = a ? b : c;
process(choice);`,
    output: `process(a ? b : c);`,
    errors: [{ messageId: 'preferInline', data: { name: 'choice' } }],
  },
  {
    name: 'flags conditional expression with parens for member access',
    code: `const choice = a ? b : c;
console.log(choice.length);`,
    output: `console.log((a ? b : c).length);`,
    errors: [{ messageId: 'preferInline', data: { name: 'choice' } }],
  },
  {
    name: 'flags member expression',
    code: `const len = arr.length;
console.log(len);`,
    output: `console.log(arr.length);`,
    errors: [{ messageId: 'preferInline', data: { name: 'len' } }],
  },
  {
    name: 'flags identifier reference',
    code: `const alias = original;
process(alias);`,
    output: `process(original);`,
    errors: [{ messageId: 'preferInline', data: { name: 'alias' } }],
  },
  {
    name: 'flags TSAsExpression',
    code: `const typed = value as string;
process(typed);`,
    output: `process(value as string);`,
    errors: [{ messageId: 'preferInline', data: { name: 'typed' } }],
  },
  {
    name: 'flags logical AND expression',
    code: `const combined = a && b;
process(combined);`,
    output: `process(a && b);`,
    errors: [{ messageId: 'preferInline', data: { name: 'combined' } }],
  },
  {
    name: 'flags logical OR expression with parens for member access',
    code: `const combined = a || b;
console.log(combined.value);`,
    output: `console.log((a || b).value);`,
    errors: [{ messageId: 'preferInline', data: { name: 'combined' } }],
  },
  {
    name: 'flags const in return statement',
    code: `function test() {
  const result = 42;
  return result;
}`,
    output: `function test() {
  return 42;
}`,
    errors: [{ messageId: 'preferInline', data: { name: 'result' } }],
  },
  {
    name: 'flags const used inside nested function',
    code: `function outer() {
  const msg = 'hello';
  function inner() {
    console.log(msg);
  }
}`,
    output: `function outer() {
  function inner() {
    console.log('hello');
  }
}`,
    errors: [{ messageId: 'preferInline', data: { name: 'msg' } }],
  },
  {
    name: 'flags simple arithmetic',
    code: `const doubled = x * 2;
use(doubled);`,
    output: `use(x * 2);`,
    errors: [{ messageId: 'preferInline', data: { name: 'doubled' } }],
  },
  {
    name: 'flags object expression with parens for member access',
    code: `const obj = { x: 1 };
console.log(obj.x);`,
    output: `console.log(({ x: 1 }).x);`,
    errors: [{ messageId: 'preferInline', data: { name: 'obj' } }],
  },
  {
    name: 'flags arrow function with parens when called directly',
    code: `const fn = (x) => x * 2;
const result = fn(5);`,
    output: `const result = ((x) => x * 2)(5);`,
    errors: [{ messageId: 'preferInline', data: { name: 'fn' } }],
  },
  {
    name: 'flags TSNonNullExpression',
    code: `const value = obj!;
process(value);`,
    output: `process(obj!);`,
    errors: [{ messageId: 'preferInline', data: { name: 'value' } }],
  },
  {
    name: 'flags TSTypeAssertion (angle bracket)',
    code: `const value = <string>obj;
process(value);`,
    output: `process(<string>obj);`,
    errors: [{ messageId: 'preferInline', data: { name: 'value' } }],
  },
  {
    name: 'flags binary expression with parens in unary context',
    code: `const sum = a + b;
const negated = !sum;`,
    output: `const negated = !(a + b);`,
    errors: [{ messageId: 'preferInline', data: { name: 'sum' } }],
  },
  {
    name: 'flags binary expression with parens in binary context',
    code: `const sum = a + b;
const result = sum * 2;`,
    output: `const result = (a + b) * 2;`,
    errors: [{ messageId: 'preferInline', data: { name: 'sum' } }],
  },
  {
    name: 'flags logical expression with parens in binary context',
    code: `const bool = a && b;
const result = bool + 1;`,
    output: `const result = (a && b) + 1;`,
    errors: [{ messageId: 'preferInline', data: { name: 'bool' } }],
  },
  {
    name: 'flags conditional with parens in unary context',
    code: `const choice = a ? b : c;
const negated = !choice;`,
    output: `const negated = !(a ? b : c);`,
    errors: [{ messageId: 'preferInline', data: { name: 'choice' } }],
  },
  {
    name: 'flags arrow function with parens in member access',
    code: `const fn = () => 42;
const bound = fn.bind(null);`,
    output: `const bound = (() => 42).bind(null);`,
    errors: [{ messageId: 'preferInline', data: { name: 'fn' } }],
  },
  {
    name: 'flags arrow function with parens in binary expression',
    code: `const fn = () => 42;
const result = fn || defaultFn;`,
    output: `const result = (() => 42) || defaultFn;`,
    errors: [{ messageId: 'preferInline', data: { name: 'fn' } }],
  },
  {
    name: 'flags array with nested arrays',
    code: `const nested = [[1, 2], [3, 4]];
process(nested);`,
    output: `process([[1, 2], [3, 4]]);`,
    errors: [{ messageId: 'preferInline', data: { name: 'nested' } }],
  },
  {
    name: 'flags array with sparse elements',
    code: `const sparse = [1, , 3];
process(sparse);`,
    output: `process([1, , 3]);`,
    errors: [{ messageId: 'preferInline', data: { name: 'sparse' } }],
  },
  {
    name: 'flags nested object expression',
    code: `const nested = { a: { b: 1 } };
process(nested);`,
    output: `process({ a: { b: 1 } });`,
    errors: [{ messageId: 'preferInline', data: { name: 'nested' } }],
  },
  {
    name: 'flags object with multiple properties',
    code: `const config = { a: 1, b: 2, c: 3 };
process(config);`,
    output: `process({ a: 1, b: 2, c: 3 });`,
    errors: [{ messageId: 'preferInline', data: { name: 'config' } }],
  },
  {
    name: 'flags deeply nested member expression',
    code: `const deep = a.b.c.d;
process(deep);`,
    output: `process(a.b.c.d);`,
    errors: [{ messageId: 'preferInline', data: { name: 'deep' } }],
  },
  {
    name: 'flags chained logical expression',
    code: `const chain = a && b && c;
process(chain);`,
    output: `process(a && b && c);`,
    errors: [{ messageId: 'preferInline', data: { name: 'chain' } }],
  },
  {
    name: 'flags double negation unary expression',
    code: `const double = !!flag;
process(double);`,
    output: `process(!!flag);`,
    errors: [{ messageId: 'preferInline', data: { name: 'double' } }],
  },
  {
    name: 'flags typeof unary expression',
    code: `const type = typeof value;
process(type);`,
    output: `process(typeof value);`,
    errors: [{ messageId: 'preferInline', data: { name: 'type' } }],
  },
  {
    name: 'flags nested conditional expression',
    code: `const nested = a ? (b ? c : d) : e;
process(nested);`,
    output: `process(a ? (b ? c : d) : e);`,
    errors: [{ messageId: 'preferInline', data: { name: 'nested' } }],
  },
  {
    name: 'flags TSAsExpression with complex type',
    code: `const typed = value as { x: number };
process(typed);`,
    output: `process(value as { x: number });`,
    errors: [{ messageId: 'preferInline', data: { name: 'typed' } }],
  },
  {
    name: 'flags chained TSNonNullExpression',
    code: `const value = obj!.prop!;
process(value);`,
    output: `process(obj!.prop!);`,
    errors: [{ messageId: 'preferInline', data: { name: 'value' } }],
  },
]

ruleTester.run(RULE_NAME, rule, {
  valid: validCases,
  invalid: invalidCases,
})
