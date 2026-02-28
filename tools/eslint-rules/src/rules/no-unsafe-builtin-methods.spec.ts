import type { InvalidTestCase, ValidTestCase } from '@typescript-eslint/rule-tester'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RuleTester } from '@typescript-eslint/rule-tester'
import rule from './no-unsafe-builtin-methods'

type TestOptions = readonly []
type MessageIds = 'unsafeBuiltinMethod' | 'unsafePrototypeCall' | 'unsafeNewPromise'

/**
 * Creates a temporary project structure for testing.
 *
 * @param config - Configuration for the temporary project.
 * @param config.projectJson - Optional project.json content.
 * @param config.packageJson - Optional package.json content.
 * @param config.isPublishable - Whether the library is publishable (default: true).
 * @returns The path to the temporary project directory.
 */
function createTempProject(config: { projectJson?: object; packageJson?: object; isPublishable?: boolean }): string {
  const testDir = mkdtempSync(join(tmpdir(), 'eslint-builtin-test-'))

  const projectJson = config.projectJson ?? {
    projectType: 'library',
    targets: config.isPublishable !== false ? { build: {}, publish: {} } : { build: {} },
  }

  const packageJson = config.packageJson ?? { name: 'test-lib' }

  writeFileSync(join(testDir, 'project.json'), JSON.stringify(projectJson, null, 2), { mode: 0o600 })
  writeFileSync(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2), { mode: 0o600 })

  return testDir
}

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: false,
    },
  },
})

const tempDirs: string[] = []

/**
 * Valid test cases
 */

function createNonPublishableLibraryCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({ isPublishable: false })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src'), { recursive: true })
  return {
    code: 'const obj = Object.freeze({ a: 1 });',
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

function createBuiltInCopyCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({ isPublishable: true })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src', 'built-in-copy'), { recursive: true })
  return {
    code: 'const obj = Object.freeze({ a: 1 });',
    filename: join(projectDir, 'src', 'built-in-copy', 'object.ts'),
  }
}

function createTestFileCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({ isPublishable: true })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src'), { recursive: true })
  return {
    code: 'const obj = Object.freeze({ a: 1 });',
    filename: join(projectDir, 'src', 'index.spec.ts'),
  }
}

function createNoProjectRootCase(): ValidTestCase<TestOptions> {
  return {
    code: 'const obj = Object.freeze({ a: 1 });',
    filename: '/random/path/index.ts',
  }
}

function createSafeImportCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({ isPublishable: true })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src'), { recursive: true })
  return {
    code: `import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object';
const obj = freeze({ a: 1 });`,
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

function createNonIdentifierObjectCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({ isPublishable: true })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src'), { recursive: true })
  return {
    code: 'const result = myObj.freeze({ a: 1 });',
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

function createComputedPropertyCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({ isPublishable: true })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src'), { recursive: true })
  return {
    code: 'const result = Object["freeze"]({ a: 1 });',
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

function createNonCallExpressionCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({ isPublishable: true })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src'), { recursive: true })
  return {
    code: 'const fn = someFunction;',
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

function createCallWithoutCallPropertyCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({ isPublishable: true })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src'), { recursive: true })
  return {
    code: 'const result = obj.someMethod.apply(context, args);',
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

function createNonPrototypeCallCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({ isPublishable: true })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src'), { recursive: true })
  return {
    code: 'const result = myObj.property.method.call(context);',
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

function createUntrackedPrototypeCallCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({ isPublishable: true })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src'), { recursive: true })
  return {
    code: 'const result = Object.prototype.valueOf.call(obj);',
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

function createNewNonPromiseCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({ isPublishable: true })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src'), { recursive: true })
  return {
    code: 'const obj = new MyClass();',
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

function createUnsafeMethodNotInListCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({ isPublishable: true })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src'), { recursive: true })
  return {
    code: 'const result = Object.is(a, b);',
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Invalid test cases
 */

function createObjectFreezeCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject({ isPublishable: true })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src'), { recursive: true })
  return {
    code: 'const obj = Object.freeze({ a: 1 });',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeBuiltinMethod' }],
  }
}

function createObjectEntriesCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject({ isPublishable: true })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src'), { recursive: true })
  return {
    code: 'const entries = Object.entries({ a: 1 });',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeBuiltinMethod' }],
  }
}

function createObjectKeysCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject({ isPublishable: true })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src'), { recursive: true })
  return {
    code: 'const keys = Object.keys({ a: 1 });',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeBuiltinMethod' }],
  }
}

function createObjectSetPrototypeOfCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject({ isPublishable: true })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src'), { recursive: true })
  return {
    code: 'Object.setPrototypeOf(obj, proto);',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeBuiltinMethod' }],
  }
}

function createArrayIsArrayCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject({ isPublishable: true })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src'), { recursive: true })
  return {
    code: 'const isArr = Array.isArray(value);',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeBuiltinMethod' }],
  }
}

function createArrayFromCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject({ isPublishable: true })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src'), { recursive: true })
  return {
    code: 'const arr = Array.from(iterable);',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeBuiltinMethod' }],
  }
}

function createJSONParseCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject({ isPublishable: true })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src'), { recursive: true })
  return {
    code: 'const obj = JSON.parse(str);',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeBuiltinMethod' }],
  }
}

function createNewPromiseCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject({ isPublishable: true })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src'), { recursive: true })
  return {
    code: 'const p = new Promise((resolve) => resolve(1));',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeNewPromise' }],
  }
}

function createPrototypeHasOwnPropertyCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject({ isPublishable: true })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src'), { recursive: true })
  return {
    code: 'const has = Object.prototype.hasOwnProperty.call(obj, "key");',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafePrototypeCall' }],
  }
}

function createPrototypeToStringCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject({ isPublishable: true })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src'), { recursive: true })
  return {
    code: 'const type = Object.prototype.toString.call(value);',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafePrototypeCall' }],
  }
}

function createObjectValuesCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject({ isPublishable: true })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src'), { recursive: true })
  return {
    code: 'const values = Object.values({ a: 1 });',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeBuiltinMethod' }],
  }
}

function createJSONStringifyCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject({ isPublishable: true })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src'), { recursive: true })
  return {
    code: 'const str = JSON.stringify({ a: 1 });',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeBuiltinMethod' }],
  }
}

function createArrayOfCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject({ isPublishable: true })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src'), { recursive: true })
  return {
    code: 'const arr = Array.of(1, 2, 3);',
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeBuiltinMethod' }],
  }
}

function createMultipleViolationsCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject({ isPublishable: true })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src'), { recursive: true })
  return {
    code: `const obj = Object.freeze({ a: 1 });
const keys = Object.keys(obj);
const arr = Array.from(keys);`,
    filename: join(projectDir, 'src', 'index.ts'),
    errors: [{ messageId: 'unsafeBuiltinMethod' }, { messageId: 'unsafeBuiltinMethod' }, { messageId: 'unsafeBuiltinMethod' }],
  }
}

describe('no-unsafe-builtin-methods', () => {
  describe('no-unsafe-builtin-methods', () => {
    describe('valid', () => {
      ruleTester.run('no-unsafe-builtin-methods', rule, {
        valid: [
          {
            name: 'does not trigger for non-publishable library',
            ...createNonPublishableLibraryCase(),
          },
          {
            name: 'does not trigger for built-in-copy directory',
            ...createBuiltInCopyCase(),
          },
          {
            name: 'does not trigger for test files',
            ...createTestFileCase(),
          },
          {
            name: 'does not trigger for files without project root',
            ...createNoProjectRootCase(),
          },
          {
            name: 'does not trigger for safe imports',
            ...createSafeImportCase(),
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
        ],
      })
    })
  })

  // Cleanup temporary directories
  afterAll(() => {
    for (const dir of tempDirs) {
      try {
        rmSync(dir, { recursive: true, force: true })
      } catch {
        // Ignore cleanup errors
      }
    }
  })
})
