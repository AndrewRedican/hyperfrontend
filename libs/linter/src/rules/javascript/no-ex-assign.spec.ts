import { testRule } from '../../testing/rule-tester'
import rule from './no-ex-assign'

testRule(rule, {
  valid: [
    { name: '#1 try { } catch (e) { three = 2 + 1; }', path: '/root/file.ts', text: 'try { } catch (e) { three = 2 + 1; }' },
    {
      name: '#2 try { } catch ({e}) { this.something = 2; }',
      path: '/root/file.ts',
      text: 'try { } catch ({e}) { this.something = 2; }',
    },
    {
      name: '#3 function foo() { try { } catch (e) { return false; } }',
      path: '/root/file.ts',
      text: 'function foo() { try { } catch (e) { return false; } }',
    },
    { name: '#4 an optional catch binding declares nothing', path: '/root/file.ts', text: 'try {} catch {}' },
    {
      name: '#6 a default in a destructured parameter initialises it',
      path: '/root/file.ts',
      text: "try {} catch ({ message = 'x' }) { console.log(message) }",
    },
    {
      name: '#7 a declaration in a nested block shadows the parameter',
      path: '/root/file.ts',
      text: 'try {} catch (e) { { let e = 1; e = 2 } }',
    },
    { name: '#8 a typed parameter that is only read', path: '/root/file.ts', text: 'try {} catch (e: unknown) { throw e }' },
    {
      name: '#11 a parameter of an inner function shadows the exception',
      path: '/root/file.ts',
      text: 'try {} catch (e) { const f = (e) => { e = 1 } }',
    },
  ],
  invalid: [
    {
      name: '#14 try { } catch (ex) { [ex] = []; }',
      path: '/root/file.ts',
      text: 'try { } catch (ex) { [ex] = []; }',
      errors: [{ message: 'Do not assign to the exception parameter.', line: 1, column: 23, endLine: 1, endColumn: 25 }],
    },
    {
      name: '#15 try { } catch (ex) { ({x: ex = 0} = {}); }',
      path: '/root/file.ts',
      text: 'try { } catch (ex) { ({x: ex = 0} = {}); }',
      errors: [{ message: 'Do not assign to the exception parameter.', line: 1, column: 27, endLine: 1, endColumn: 29 }],
    },
    {
      name: '#19 a compound assignment',
      path: '/root/file.ts',
      text: 'try {} catch (e) { e += 1 }',
      errors: [{ message: 'Do not assign to the exception parameter.', line: 1, column: 20, endLine: 1, endColumn: 21 }],
    },
    {
      name: '#21 an update expression',
      path: '/root/file.ts',
      text: 'try {} catch (e) { e++ }',
      errors: [{ message: 'Do not assign to the exception parameter.', line: 1, column: 20, endLine: 1, endColumn: 21 }],
    },
    {
      name: '#24 a for-of loop target',
      path: '/root/file.ts',
      text: 'try {} catch (e) { for (e of xs) {} }',
      errors: [{ message: 'Do not assign to the exception parameter.', line: 1, column: 25, endLine: 1, endColumn: 26 }],
    },
    {
      name: '#25 a for-in loop target',
      path: '/root/file.ts',
      text: 'try {} catch (e) { for (e in o) {} }',
      errors: [{ message: 'Do not assign to the exception parameter.', line: 1, column: 25, endLine: 1, endColumn: 26 }],
    },
    {
      name: '#27 each variable of a destructured parameter is checked',
      path: '/root/file.ts',
      text: 'try {} catch ({ name, message }) { name = 1; message = 2 }',
      errors: [
        { message: 'Do not assign to the exception parameter.', line: 1, column: 36, endLine: 1, endColumn: 40 },
        { message: 'Do not assign to the exception parameter.', line: 1, column: 46, endLine: 1, endColumn: 53 },
      ],
    },
    {
      name: '#28 an assignment on a later line',
      path: '/root/file.ts',
      text: 'try {\n} catch (e) {\n  e = null\n}',
      errors: [{ message: 'Do not assign to the exception parameter.', line: 3, column: 3, endLine: 3, endColumn: 4 }],
    },
  ],
})
