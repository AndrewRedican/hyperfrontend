import type { InvalidTestCase, ValidTestCase } from '@typescript-eslint/rule-tester'
import { createTypeScriptRuleTester } from '../testing'
import rule from './import-order'

type TestOptions = readonly []
type MessageIds = 'incorrectOrder'

const ruleTester = createTypeScriptRuleTester()

/**
 * Valid test cases - imports in correct order
 */
const validCases: ValidTestCase<TestOptions>[] = [
  { code: `import { foo } from './foo'` },

  {
    code: `import type { Stats } from 'node:fs'
import { readFile } from 'node:fs'`,
  },

  {
    code: `import type { Stats } from 'node:fs'
import type { Express } from 'express'
import type { Channel } from '@hyperfrontend/nexus'
import type { BaseConfig } from '../../config'
import type { Helper } from '../helpers'
import type { LocalType } from './types'
import { readFile } from 'node:fs'
import express from 'express'
import { createChannel } from '@hyperfrontend/nexus'
import { baseConfig } from '../../config'
import { helper } from '../helpers'
import { localFunc } from './local'`,
  },

  {
    code: `import type { A } from 'node:fs'
import type { B } from 'express'
import type { C } from '@hyperfrontend/nexus'`,
  },

  {
    code: `import { a } from 'node:fs'
import { b } from 'express'
import { c } from '@hyperfrontend/nexus'`,
  },

  {
    code: `import { a } from '../../../deep'
import { b } from '../../middle'
import { c } from '../shallow'
import { d } from './current'`,
  },

  {
    code: `import { a } from '../alpha'
import { b } from '../beta'
import { c } from '../gamma'`,
  },

  { code: `const x = 1` },
]

/**
 * Invalid test cases - imports out of order
 */
const invalidCases: InvalidTestCase<MessageIds, TestOptions>[] = [
  {
    code: `import { readFile } from 'node:fs'
import type { Stats } from 'node:fs'`,
    output: `import type { Stats } from 'node:fs'
import { readFile } from 'node:fs'`,
    errors: [{ messageId: 'incorrectOrder' }],
  },

  {
    code: `import express from 'express'
import { readFile } from 'node:fs'`,
    output: `import { readFile } from 'node:fs'
import express from 'express'`,
    errors: [{ messageId: 'incorrectOrder' }],
  },

  {
    code: `import { createChannel } from '@hyperfrontend/nexus'
import express from 'express'`,
    output: `import express from 'express'
import { createChannel } from '@hyperfrontend/nexus'`,
    errors: [{ messageId: 'incorrectOrder' }],
  },

  {
    code: `import { local } from './local'
import { parent } from '../parent'`,
    output: `import { parent } from '../parent'
import { local } from './local'`,
    errors: [{ messageId: 'incorrectOrder' }],
  },

  {
    code: `import { shallow } from '../shallow'
import { deep } from '../../deep'`,
    output: `import { deep } from '../../deep'
import { shallow } from '../shallow'`,
    errors: [{ messageId: 'incorrectOrder' }],
  },

  {
    code: `import { local } from './local'
import type { A } from 'express'
import { fs } from 'node:fs'
import { nexus } from '@hyperfrontend/nexus'`,
    output: `import type { A } from 'express'
import { fs } from 'node:fs'
import { nexus } from '@hyperfrontend/nexus'
import { local } from './local'`,
    errors: [{ messageId: 'incorrectOrder' }],
  },

  {
    code: `import { z } from '../zebra'
import { a } from '../alpha'`,
    output: `import { a } from '../alpha'
import { z } from '../zebra'`,
    errors: [{ messageId: 'incorrectOrder' }],
  },

  {
    code: `import { b } from 'express'
const x = 1
import { a } from 'node:fs'`,
    output: null,
    errors: [{ messageId: 'incorrectOrder' }],
  },
]

ruleTester.run('import-order', rule, {
  valid: validCases,
  invalid: invalidCases,
})
