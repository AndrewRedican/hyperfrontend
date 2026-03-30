import type { InvalidTestCase, ValidTestCase } from '@typescript-eslint/rule-tester'
import { join } from 'node:path'
import { createTempWorkspaceManager, createTypeScriptRuleTester } from '../testing'
import rule from './no-unsafe-builtin-methods'

type TestOptions = readonly []
type MessageIds = 'unsafeBuiltinMethod' | 'unsafePrototypeCall' | 'unsafeConstructor' | 'unsafeGlobalFunction'

const manager = createTempWorkspaceManager()

/**
 * Creates a temporary project structure for testing.
 *
 * @returns The path to the temporary project directory.
 */
function createTempProject(): string {
  const workspace = manager.create({})
  return workspace.root
}

const ruleTester = createTypeScriptRuleTester()

/**
 * Valid test cases
 */

function createBuiltInCopyCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const obj = Object.freeze({ a: 1 });',
    filename: join(projectDir, 'src', 'built-in-copy', 'object.ts'),
  }
}

function createTestFileCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const obj = Object.freeze({ a: 1 });',
    filename: join(projectDir, 'src', 'index.spec.ts'),
  }
}

function createTestFileDotTestCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const obj = Object.freeze({ a: 1 });',
    filename: join(projectDir, 'src', 'index.test.ts'),
  }
}

function createSafeImportCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject()
  return {
    code: `import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object';
const obj = freeze({ a: 1 });`,
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

function createSafeGlobalFunctionImportCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject()
  return {
    code: `import { setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers';
setTimeout(() => {}, 100);`,
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

function createNonIdentifierObjectCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const result = myObj.freeze({ a: 1 });',
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

function createComputedPropertyCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const result = Object["freeze"]({ a: 1 });',
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

function createNonCallExpressionCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const fn = someFunction;',
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

function createCallWithoutCallPropertyCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const result = obj.someMethod.apply(context, args);',
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

function createNonPrototypeCallCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const result = myObj.property.method.call(context);',
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

function createUntrackedPrototypeCallCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const result = Object.prototype.valueOf.call(obj);',
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

function createNewNonPromiseCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const obj = new MyClass();',
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

function createUnsafeMethodNotInListCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const result = Object.is(a, b);',
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Invalid test cases
 */

function createObjectFreezeCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const obj = Object.freeze({ a: 1 });',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeBuiltinMethod' }],
  }
}

function createObjectEntriesCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const entries = Object.entries({ a: 1 });',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeBuiltinMethod' }],
  }
}

function createObjectKeysCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const keys = Object.keys({ a: 1 });',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeBuiltinMethod' }],
  }
}

function createObjectSetPrototypeOfCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'Object.setPrototypeOf(obj, proto);',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeBuiltinMethod' }],
  }
}

function createArrayIsArrayCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const isArr = Array.isArray(value);',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeBuiltinMethod' }],
  }
}

function createArrayFromCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const arr = Array.from(iterable);',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeBuiltinMethod' }],
  }
}

function createJSONParseCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const obj = JSON.parse(str);',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeBuiltinMethod' }],
  }
}

function createNewPromiseCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const p = new Promise((resolve) => resolve(1));',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeConstructor' }],
  }
}

function createPrototypeHasOwnPropertyCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const has = Object.prototype.hasOwnProperty.call(obj, "key");',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafePrototypeCall' }],
  }
}

function createPrototypeToStringCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const type = Object.prototype.toString.call(value);',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafePrototypeCall' }],
  }
}

function createObjectValuesCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const values = Object.values({ a: 1 });',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeBuiltinMethod' }],
  }
}

function createJSONStringifyCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const str = JSON.stringify({ a: 1 });',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeBuiltinMethod' }],
  }
}

function createArrayOfCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const arr = Array.of(1, 2, 3);',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeBuiltinMethod' }],
  }
}

function createMultipleViolationsCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    code: `const obj = Object.freeze({ a: 1 });
const keys = Object.keys(obj);
const arr = Array.from(keys);`,
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeBuiltinMethod' }, { messageId: 'unsafeBuiltinMethod' }, { messageId: 'unsafeBuiltinMethod' }],
  }
}

function createConsoleLogCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'console.log("unsafe");',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeBuiltinMethod' }],
  }
}

function createSetTimeoutCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'setTimeout(() => {}, 100);',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeGlobalFunction' }],
  }
}

function createStructuredCloneCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const copy = structuredClone({ a: 1 });',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeGlobalFunction' }],
  }
}

function createNewMessageChannelCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const channel = new MessageChannel();',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeConstructor' }],
  }
}

function createNewBroadcastChannelCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const broadcast = new BroadcastChannel("test");',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeConstructor' }],
  }
}

function createNewMapCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const map = new Map();',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeConstructor' }],
  }
}

function createNewSetCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const set = new Set();',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeConstructor' }],
  }
}

function createNewWeakMapCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const weakMap = new WeakMap();',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeConstructor' }],
  }
}

function createNewWeakSetCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const weakSet = new WeakSet();',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeConstructor' }],
  }
}

function createNewRegExpCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const regex = new RegExp("test");',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeConstructor' }],
  }
}

function createNewDateCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const date = new Date();',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeConstructor' }],
  }
}

function createNewErrorCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const err = new Error("message");',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeConstructor' }],
  }
}

function createNewTypeErrorCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const err = new TypeError("message");',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeConstructor' }],
  }
}

function createNewFunctionCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const fn = new Function("return 1");',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeConstructor' }],
  }
}

function createPromiseAllCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const result = Promise.all([]);',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeBuiltinMethod' }],
  }
}

function createPromiseResolveCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const result = Promise.resolve(1);',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeBuiltinMethod' }],
  }
}

function createDateNowCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const now = Date.now();',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeBuiltinMethod' }],
  }
}

function createReflectGetCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const val = Reflect.get(obj, "key");',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeBuiltinMethod' }],
  }
}

function createSymbolForCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const sym = Symbol.for("key");',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeBuiltinMethod' }],
  }
}

function createMapGroupByCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject()
  return {
    code: 'const grouped = Map.groupBy([], (x) => x);',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeBuiltinMethod' }],
  }
}

describe('no-unsafe-builtin-methods', () => {
  describe('no-unsafe-builtin-methods', () => {
    describe('valid', () => {
      ruleTester.run('no-unsafe-builtin-methods', rule, {
        valid: [
          {
            name: 'does not trigger for built-in-copy directory',
            ...createBuiltInCopyCase(),
          },
          {
            name: 'does not trigger for test files (.spec.ts)',
            ...createTestFileCase(),
          },
          {
            name: 'does not trigger for test files (.test.ts)',
            ...createTestFileDotTestCase(),
          },
          {
            name: 'does not trigger for safe imports',
            ...createSafeImportCase(),
          },
          {
            name: 'does not trigger for safe global function imports',
            ...createSafeGlobalFunctionImportCase(),
          },
          {
            name: 'does not trigger for non-Identifier object',
            ...createNonIdentifierObjectCase(),
          },
          {
            name: 'does not trigger for computed property access',
            ...createComputedPropertyCase(),
          },
          {
            name: 'does not trigger for non-call expression',
            ...createNonCallExpressionCase(),
          },
          {
            name: 'does not trigger for call without call property',
            ...createCallWithoutCallPropertyCase(),
          },
          {
            name: 'does not trigger for non-prototype call',
            ...createNonPrototypeCallCase(),
          },
          {
            name: 'does not trigger for untracked prototype call',
            ...createUntrackedPrototypeCallCase(),
          },
          {
            name: 'does not trigger for new non-Promise',
            ...createNewNonPromiseCase(),
          },
          {
            name: 'does not trigger for unsafe method not in list',
            ...createUnsafeMethodNotInListCase(),
          },
        ],
        invalid: [],
      })
    })

    describe('invalid', () => {
      ruleTester.run('no-unsafe-builtin-methods', rule, {
        valid: [],
        invalid: [
          {
            name: 'triggers for Object.freeze',
            ...createObjectFreezeCase(),
          },
          {
            name: 'triggers for Object.entries',
            ...createObjectEntriesCase(),
          },
          {
            name: 'triggers for Object.keys',
            ...createObjectKeysCase(),
          },
          {
            name: 'triggers for Object.setPrototypeOf',
            ...createObjectSetPrototypeOfCase(),
          },
          {
            name: 'triggers for Array.isArray',
            ...createArrayIsArrayCase(),
          },
          {
            name: 'triggers for Array.from',
            ...createArrayFromCase(),
          },
          {
            name: 'triggers for JSON.parse',
            ...createJSONParseCase(),
          },
          {
            name: 'triggers for Object.prototype.toString.call',
            ...createPrototypeToStringCase(),
          },
          {
            name: 'triggers for Object.values',
            ...createObjectValuesCase(),
          },
          {
            name: 'triggers for JSON.stringify',
            ...createJSONStringifyCase(),
          },
          {
            name: 'triggers for Array.of',
            ...createArrayOfCase(),
          },
          {
            name: 'triggers for new Promise()',
            ...createNewPromiseCase(),
          },
          {
            name: 'triggers for Object.prototype.hasOwnProperty.call',
            ...createPrototypeHasOwnPropertyCase(),
          },
          {
            name: 'triggers for multiple violations',
            ...createMultipleViolationsCase(),
          },
          {
            name: 'triggers for console.log',
            ...createConsoleLogCase(),
          },
          {
            name: 'triggers for setTimeout',
            ...createSetTimeoutCase(),
          },
          {
            name: 'triggers for structuredClone',
            ...createStructuredCloneCase(),
          },
          {
            name: 'triggers for new MessageChannel()',
            ...createNewMessageChannelCase(),
          },
          {
            name: 'triggers for new BroadcastChannel()',
            ...createNewBroadcastChannelCase(),
          },
          {
            name: 'triggers for new Map()',
            ...createNewMapCase(),
          },
          {
            name: 'triggers for new Set()',
            ...createNewSetCase(),
          },
          {
            name: 'triggers for new WeakMap()',
            ...createNewWeakMapCase(),
          },
          {
            name: 'triggers for new WeakSet()',
            ...createNewWeakSetCase(),
          },
          {
            name: 'triggers for new RegExp()',
            ...createNewRegExpCase(),
          },
          {
            name: 'triggers for new Date()',
            ...createNewDateCase(),
          },
          {
            name: 'triggers for new Error()',
            ...createNewErrorCase(),
          },
          {
            name: 'triggers for new TypeError()',
            ...createNewTypeErrorCase(),
          },
          {
            name: 'triggers for new Function()',
            ...createNewFunctionCase(),
          },
          {
            name: 'triggers for Promise.all()',
            ...createPromiseAllCase(),
          },
          {
            name: 'triggers for Promise.resolve()',
            ...createPromiseResolveCase(),
          },
          {
            name: 'triggers for Date.now()',
            ...createDateNowCase(),
          },
          {
            name: 'triggers for Reflect.get()',
            ...createReflectGetCase(),
          },
          {
            name: 'triggers for Symbol.for()',
            ...createSymbolForCase(),
          },
          {
            name: 'triggers for Map.groupBy()',
            ...createMapGroupByCase(),
          },
        ],
      })
    })
  })

  afterAll(() => {
    manager.cleanupAll()
  })
})
