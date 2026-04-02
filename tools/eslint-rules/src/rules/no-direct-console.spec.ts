import type { InvalidTestCase, ValidTestCase } from '@typescript-eslint/rule-tester'
import { RuleTester } from '@typescript-eslint/rule-tester'
import rule from './no-direct-console'

type TestOptions = readonly []
type MessageIds = 'noGlobalConsole' | 'noNxDevkitLogger' | 'noImmutableConsole' | 'noDisallowedLoggerUsage'

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: false,
    },
  },
})

/**
 * Valid test cases - approved logging patterns
 */
const validCases: ValidTestCase<TestOptions>[] = [
  { code: `import { createLogger } from '@hyperfrontend/logging'` },
  { code: `import { logger } from '@hyperfrontend/logging'` },
  { code: `import { createLogger, logger } from '@hyperfrontend/logging'` },
  { code: `import { createLogLevelConfig } from '@hyperfrontend/logging'` },
  { code: `import { isValidLogger } from '@hyperfrontend/logging'` },
  { code: `import type { Logger } from '@hyperfrontend/logging'` },
  { code: `import * as logging from '@hyperfrontend/logging'` },

  {
    code: `
      import { logger } from '@hyperfrontend/logging'
      logger.log('test')
      logger.warn('test')
      logger.error('test')
      logger.info('test')
      logger.debug('test')
    `,
  },
  {
    code: `
      import { createLogger } from '@hyperfrontend/logging'
      const myLogger = createLogger(console.error)
      myLogger.log('test')
    `,
  },
  {
    code: `
      import { createLogger } from '@hyperfrontend/logging'
      const myLogger = createLogger(console.error, console.warn, console.log, console.info, console.debug)
    `,
  },
  {
    code: `
      import * as logging from '@hyperfrontend/logging'
      logging.logger.log('test')
    `,
  },
  { code: `import { readJsonFile, writeJsonFile } from '@nx/devkit'` },
  { code: `import { Tree, formatFiles } from '@nx/devkit'` },
  { code: `import type { ExecutorContext } from '@nx/devkit'` },
  { code: `import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'` },
  { code: `import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'` },
  { code: `import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'` },
  { code: `import { someFunction } from './local-module'` },
  { code: `import something from 'external-package'` },
  { code: `const fs = require('node:fs')` },
  { code: `import { log } from '@hyperfrontend/immutable-api-utils/built-in-copy/console'` },
  { code: `import { warn, error } from '@hyperfrontend/immutable-api-utils/built-in-copy/console'` },
  { code: `import * as consoleUtils from '@hyperfrontend/immutable-api-utils/built-in-copy/console'` },
  {
    code: `
      import { error, warn, log, info, debug } from '@hyperfrontend/immutable-api-utils/built-in-copy/console'
      import { createLogger } from '@hyperfrontend/logging'
      const myLogger = createLogger(error, warn, log, info, debug)
    `,
  },
  {
    code: `
      const myConsole = { log: () => {} }
      myConsole.log('test')
    `,
  },
  {
    code: `
      const obj = { console: { log: () => {} } }
      obj.console.log('test')
    `,
  },
  {
    code: `
      class Logger {
        log(msg: string) { }
        error(msg: string) { }
      }
      const appLogger = new Logger()
      appLogger.log('test')
    `,
  },
]

/**
 * Invalid test cases - disallowed console and logging patterns
 */
const invalidCases: InvalidTestCase<MessageIds, TestOptions>[] = [
  {
    code: `console.log('test')`,
    errors: [
      {
        messageId: 'noGlobalConsole',
        data: { method: 'log' },
      },
    ],
  },
  {
    code: `console.warn('warning')`,
    errors: [
      {
        messageId: 'noGlobalConsole',
        data: { method: 'warn' },
      },
    ],
  },
  {
    code: `console.error('error')`,
    errors: [
      {
        messageId: 'noGlobalConsole',
        data: { method: 'error' },
      },
    ],
  },
  {
    code: `console.info('info')`,
    errors: [
      {
        messageId: 'noGlobalConsole',
        data: { method: 'info' },
      },
    ],
  },
  {
    code: `console.debug('debug')`,
    errors: [
      {
        messageId: 'noGlobalConsole',
        data: { method: 'debug' },
      },
    ],
  },
  {
    code: `console.trace('trace')`,
    errors: [
      {
        messageId: 'noGlobalConsole',
        data: { method: 'trace' },
      },
    ],
  },
  {
    code: `console.dir(obj)`,
    errors: [
      {
        messageId: 'noGlobalConsole',
        data: { method: 'dir' },
      },
    ],
  },
  {
    code: `console.table(data)`,
    errors: [
      {
        messageId: 'noGlobalConsole',
        data: { method: 'table' },
      },
    ],
  },
  {
    code: `console.assert(condition, 'message')`,
    errors: [
      {
        messageId: 'noGlobalConsole',
        data: { method: 'assert' },
      },
    ],
  },
  {
    code: `console.clear()`,
    errors: [
      {
        messageId: 'noGlobalConsole',
        data: { method: 'clear' },
      },
    ],
  },
  {
    code: `console.group('group')`,
    errors: [
      {
        messageId: 'noGlobalConsole',
        data: { method: 'group' },
      },
    ],
  },
  {
    code: `console.groupEnd()`,
    errors: [
      {
        messageId: 'noGlobalConsole',
        data: { method: 'groupEnd' },
      },
    ],
  },
  {
    code: `console.time('timer')`,
    errors: [
      {
        messageId: 'noGlobalConsole',
        data: { method: 'time' },
      },
    ],
  },
  {
    code: `console.timeEnd('timer')`,
    errors: [
      {
        messageId: 'noGlobalConsole',
        data: { method: 'timeEnd' },
      },
    ],
  },
  {
    code: `console.count('label')`,
    errors: [
      {
        messageId: 'noGlobalConsole',
        data: { method: 'count' },
      },
    ],
  },
  {
    code: `console.countReset('label')`,
    errors: [
      {
        messageId: 'noGlobalConsole',
        data: { method: 'countReset' },
      },
    ],
  },
  {
    code: `console.groupCollapsed('group')`,
    errors: [
      {
        messageId: 'noGlobalConsole',
        data: { method: 'groupCollapsed' },
      },
    ],
  },
  {
    code: `console.timeLog('timer')`,
    errors: [
      {
        messageId: 'noGlobalConsole',
        data: { method: 'timeLog' },
      },
    ],
  },
  {
    code: `console.timeStamp('label')`,
    errors: [
      {
        messageId: 'noGlobalConsole',
        data: { method: 'timeStamp' },
      },
    ],
  },
  {
    code: `console.profile('label')`,
    errors: [
      {
        messageId: 'noGlobalConsole',
        data: { method: 'profile' },
      },
    ],
  },
  {
    code: `console.profileEnd('label')`,
    errors: [
      {
        messageId: 'noGlobalConsole',
        data: { method: 'profileEnd' },
      },
    ],
  },
  {
    code: `console['log']('bracket notation')`,
    errors: [
      {
        messageId: 'noGlobalConsole',
        data: { method: 'log' },
      },
    ],
  },
  {
    code: `
      console.log('one')
      console.warn('two')
      console.error('three')
    `,
    errors: [
      {
        messageId: 'noGlobalConsole',
        data: { method: 'log' },
      },
      {
        messageId: 'noGlobalConsole',
        data: { method: 'warn' },
      },
      {
        messageId: 'noGlobalConsole',
        data: { method: 'error' },
      },
    ],
  },

  {
    code: `import { logger } from '@nx/devkit'`,
    errors: [
      {
        messageId: 'noNxDevkitLogger',
      },
    ],
  },
  {
    code: `import { logger as nxLogger } from '@nx/devkit'`,
    errors: [
      {
        messageId: 'noNxDevkitLogger',
      },
    ],
  },
  {
    code: `import { logger, readJsonFile } from '@nx/devkit'`,
    errors: [
      {
        messageId: 'noNxDevkitLogger',
      },
    ],
  },
  {
    code: `
      import { logger } from '@nx/devkit'
      logger.log('test')
    `,
    errors: [
      {
        messageId: 'noNxDevkitLogger',
      },
      {
        messageId: 'noDisallowedLoggerUsage',
        data: { name: 'logger.log' },
      },
    ],
  },
  {
    code: `
      import { logger as nxLogger } from '@nx/devkit'
      nxLogger.warn('warning')
    `,
    errors: [
      {
        messageId: 'noNxDevkitLogger',
      },
      {
        messageId: 'noDisallowedLoggerUsage',
        data: { name: 'nxLogger.warn' },
      },
    ],
  },
  {
    code: `
      import { logger } from '@nx/devkit'
      logger.error('error')
      logger.info('info')
      logger.debug('debug')
    `,
    errors: [
      {
        messageId: 'noNxDevkitLogger',
      },
      {
        messageId: 'noDisallowedLoggerUsage',
        data: { name: 'logger.error' },
      },
      {
        messageId: 'noDisallowedLoggerUsage',
        data: { name: 'logger.info' },
      },
      {
        messageId: 'noDisallowedLoggerUsage',
        data: { name: 'logger.debug' },
      },
    ],
  },

  {
    code: `
      import { log } from '@hyperfrontend/immutable-api-utils/built-in-copy/console'
      log('test')
    `,
    errors: [
      {
        messageId: 'noDisallowedLoggerUsage',
        data: { name: 'log' },
      },
    ],
  },
  {
    code: `
      import { log, warn, error } from '@hyperfrontend/immutable-api-utils/built-in-copy/console'
      log('info')
      warn('warning')
      error('error')
    `,
    errors: [
      {
        messageId: 'noDisallowedLoggerUsage',
        data: { name: 'log' },
      },
      {
        messageId: 'noDisallowedLoggerUsage',
        data: { name: 'warn' },
      },
      {
        messageId: 'noDisallowedLoggerUsage',
        data: { name: 'error' },
      },
    ],
  },
  {
    code: `
      import * as consoleUtils from '@hyperfrontend/immutable-api-utils/built-in-copy/console'
      consoleUtils.log('test')
    `,
    errors: [
      {
        messageId: 'noDisallowedLoggerUsage',
        data: { name: 'consoleUtils.log' },
      },
    ],
  },

  {
    code: `const utils = require('@hyperfrontend/immutable-api-utils/built-in-copy/console')`,
    errors: [
      {
        messageId: 'noImmutableConsole',
      },
    ],
  },
]

ruleTester.run('no-direct-console', rule, {
  valid: validCases,
  invalid: invalidCases,
})
