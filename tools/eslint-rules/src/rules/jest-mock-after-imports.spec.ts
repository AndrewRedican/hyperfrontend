import { createTypeScriptRuleTester } from '../testing'
import jestMockAfterImports from './jest-mock-after-imports'

const ruleTester = createTypeScriptRuleTester()

ruleTester.run('jest-mock-after-imports', jestMockAfterImports, {
  valid: [
    {
      code: `import { a } from './a'
jest.mock('./a')`,
    },
    {
      code: `import { a } from './a'`,
    },
    {
      code: `jest.mock('./a')`,
    },
    {
      code: `import { a } from './a'

jest.mock('./a')
jest.unmock('./b')`,
    },
    {
      code: `import { a } from './a'
'use strict'
foo
bar()
notjest.mock('./x')
obj.nested.mock('./x')
makeJest().mock('./x')
jest['mock']('./x')
jest.fn()`,
    },
  ],

  invalid: [
    {
      code: `jest.mock('./a', () => ({}))
import { a } from './a'`,
      output: `import { a } from './a'
jest.mock('./a', () => ({}))`,
      errors: [{ messageId: 'mockBeforeImport', data: { method: 'mock' } }],
    },
    {
      code: `jest.mock('./warn-handler', () => ({}))
jest.mock('@rollup/plugin-json', () => jest.fn())
import type { Foo } from './models'
import { bar } from './config'`,
      output: `import type { Foo } from './models'
import { bar } from './config'
jest.mock('./warn-handler', () => ({}))
jest.mock('@rollup/plugin-json', () => jest.fn())`,
      errors: [{ messageId: 'mockBeforeImport' }, { messageId: 'mockBeforeImport' }],
    },
    {
      code: `import { a } from './a'
jest.mock('./b')
import { b } from './b'`,
      output: `import { a } from './a'
import { b } from './b'
jest.mock('./b')`,
      errors: [{ messageId: 'mockBeforeImport' }],
    },
    {
      code: `jest.unmock('./a')
import { a } from './a'`,
      output: `import { a } from './a'
jest.unmock('./a')`,
      errors: [{ messageId: 'mockBeforeImport', data: { method: 'unmock' } }],
    },
    {
      code: `jest.mock('./a')
const x = 1
import { a } from './a'`,
      output: null,
      errors: [{ messageId: 'mockBeforeImport' }],
    },
  ],
})
