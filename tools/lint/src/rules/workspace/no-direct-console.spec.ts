import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-direct-console.ts'

testRule(rule, {
  valid: [
    {
      name: "#6 import type { Logger } from '@hyperfrontend/logging'",
      path: '/root/file.ts',
      text: "import type { Logger } from '@hyperfrontend/logging'",
    },
    { name: "#19 import something from 'external-package'", path: '/root/file.ts', text: "import something from 'external-package'" },
    {
      name: '#26 const obj = { console: { log: () => {} } }',
      path: '/root/file.ts',
      text: "\n      const obj = { console: { log: () => {} } }\n      obj.console.log('test')\n    ",
    },
    {
      name: '#27 class Logger {',
      path: '/root/file.ts',
      text: "\n      class Logger {\n        log(msg: string) { }\n        error(msg: string) { }\n      }\n      const appLogger = new Logger()\n      appLogger.log('test')\n    ",
    },
    {
      name: "#33 import { logger as nxLogger } from '@nx/devkit'",
      path: '/root/file.ts',
      text: "\n      import { logger as nxLogger } from '@nx/devkit'\n      import { createLogger } from '@hyperfrontend/logging'\n      const errorFn = (message: string) => nxLogger.error(message)\n      const warnFn = (message: string) => nxLogger.warn(message)\n      const logFn = (message: string) => nxLogger.log(message)\n      const infoFn = (message: string) => nxLogger.info(message)\n      const debugFn = (message: string) => nxLogger.debug(message)\n      export const logger = createLogger(errorFn, warnFn, logFn, infoFn, debugFn)\n    ",
    },
  ],
  invalid: [
    {
      name: "#55 console['log']('bracket notation')",
      path: '/root/file.ts',
      text: "console['log']('bracket notation')",
      errors: [
        {
          message: "Avoid using global 'console.log'. Use '@hyperfrontend/logging' APIs instead (e.g., createLogger, logger).",
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 15,
        },
      ],
    },
    {
      name: "#59 import { logger } from '@nx/devkit'",
      path: '/root/file.ts',
      text: "\n      import { logger } from '@nx/devkit'\n      logger.error('error')\n      logger.info('info')\n      logger.debug('debug')\n    ",
      errors: [
        {
          message: "Avoid importing 'logger' from '@nx/devkit'. Use '@hyperfrontend/logging' APIs instead (e.g., createLogger, logger).",
          line: 2,
          column: 16,
          endLine: 2,
          endColumn: 22,
        },
        {
          message: "Avoid using 'logger.error' from disallowed source. Use '@hyperfrontend/logging' APIs instead.",
          line: 3,
          column: 7,
          endLine: 3,
          endColumn: 19,
        },
        {
          message: "Avoid using 'logger.info' from disallowed source. Use '@hyperfrontend/logging' APIs instead.",
          line: 4,
          column: 7,
          endLine: 4,
          endColumn: 18,
        },
        {
          message: "Avoid using 'logger.debug' from disallowed source. Use '@hyperfrontend/logging' APIs instead.",
          line: 5,
          column: 7,
          endLine: 5,
          endColumn: 19,
        },
      ],
    },
    {
      name: "#60 import { logger as nxLogger } from '@nx/devkit'",
      path: '/root/file.ts',
      text: "\n      import { logger as nxLogger } from '@nx/devkit'\n      import { createLogger } from '@hyperfrontend/logging'\n      const wrapper = createLogger(nxLogger.error, nxLogger.warn, nxLogger.log)\n      nxLogger.info('direct call')\n    ",
      errors: [
        {
          message: "Avoid importing 'logger' from '@nx/devkit'. Use '@hyperfrontend/logging' APIs instead (e.g., createLogger, logger).",
          line: 2,
          column: 16,
          endLine: 2,
          endColumn: 34,
        },
        {
          message: "Avoid using 'nxLogger.info' from disallowed source. Use '@hyperfrontend/logging' APIs instead.",
          line: 5,
          column: 7,
          endLine: 5,
          endColumn: 20,
        },
      ],
    },
    {
      name: "#62 import { log, warn, error } from '@hyperfrontend/immutable-a…",
      path: '/root/file.ts',
      text: "\n      import { log, warn, error } from '@hyperfrontend/immutable-api-utils/built-in-copy/console'\n      log('info')\n      warn('warning')\n      error('error')\n    ",
      errors: [
        {
          message: "Avoid using 'log' from disallowed source. Use '@hyperfrontend/logging' APIs instead.",
          line: 3,
          column: 7,
          endLine: 3,
          endColumn: 18,
        },
        {
          message: "Avoid using 'warn' from disallowed source. Use '@hyperfrontend/logging' APIs instead.",
          line: 4,
          column: 7,
          endLine: 4,
          endColumn: 22,
        },
        {
          message: "Avoid using 'error' from disallowed source. Use '@hyperfrontend/logging' APIs instead.",
          line: 5,
          column: 7,
          endLine: 5,
          endColumn: 21,
        },
      ],
    },
    {
      name: "#63 import * as consoleUtils from '@hyperfrontend/immutable-api-…",
      path: '/root/file.ts',
      text: "\n      import * as consoleUtils from '@hyperfrontend/immutable-api-utils/built-in-copy/console'\n      consoleUtils.log('test')\n    ",
      errors: [
        {
          message: "Avoid using 'consoleUtils.log' from disallowed source. Use '@hyperfrontend/logging' APIs instead.",
          line: 3,
          column: 7,
          endLine: 3,
          endColumn: 23,
        },
      ],
    },
    {
      name: "#64 const utils = require('@hyperfrontend/immutable-api-utils/bu…",
      path: '/root/file.ts',
      text: "const utils = require('@hyperfrontend/immutable-api-utils/built-in-copy/console')",
      errors: [
        {
          message:
            "Avoid importing from '@hyperfrontend/immutable-api-utils/built-in-copy/console'. Use '@hyperfrontend/logging' APIs instead.",
          line: 1,
          column: 15,
          endLine: 1,
          endColumn: 82,
        },
      ],
    },
  ],
})

// why: the cases recorded from the previous linter leave computed member names and string-named imports unexercised.
testRule(rule, {
  valid: [
    { name: 'a console method chosen at run time', path: '/root/file.ts', text: 'console[method]()' },
    { name: 'a console member indexed by a number', path: '/root/file.ts', text: 'console[1]()' },
  ],
  invalid: [
    {
      name: 'a devkit logger imported by a string name',
      path: '/root/file.ts',
      text: "import { 'logger' as nx } from '@nx/devkit'\nnx.warn('x')",
      errors: [
        {
          message: "Avoid importing 'logger' from '@nx/devkit'. Use '@hyperfrontend/logging' APIs instead (e.g., createLogger, logger).",
          line: 1,
          column: 10,
          endLine: 1,
          endColumn: 24,
        },
        {
          message: "Avoid using 'nx.warn' from disallowed source. Use '@hyperfrontend/logging' APIs instead.",
          line: 2,
          column: 1,
          endLine: 2,
          endColumn: 8,
        },
      ],
    },
    {
      name: 'a console copy read by a computed name',
      path: '/root/file.ts',
      text: "import * as copies from '@hyperfrontend/immutable-api-utils/built-in-copy/console'\ncopies['log']('x')",
      errors: [
        {
          message: "Avoid using 'copies' from disallowed source. Use '@hyperfrontend/logging' APIs instead.",
          line: 2,
          column: 1,
          endLine: 2,
          endColumn: 14,
        },
      ],
    },
  ],
})
