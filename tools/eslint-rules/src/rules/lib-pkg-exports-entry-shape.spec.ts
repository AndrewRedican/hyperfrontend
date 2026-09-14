import type { RuleTester as ESLintRuleTester } from 'eslint'
import { after as afterAll } from 'node:test'
import { describe } from '@hyperfrontend/testing'
import {
  createJsonRuleTester,
  createTempWorkspaceManager,
  NON_PUBLISHABLE_LIBRARY_PROJECT_JSON,
  PUBLISHABLE_LIBRARY_PROJECT_JSON,
} from '../testing'
import rule from './lib-pkg-exports-entry-shape'

const manager = createTempWorkspaceManager()
const ruleTester = createJsonRuleTester()

type Exports = Record<string, string | Record<string, string>>

function publishableCase(exports: Exports): { code: string; filename: string } {
  const pkg = { name: '@hyperfrontend/test-lib', exports }
  const workspace = manager.create({ projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON, packageJson: pkg })
  return { code: JSON.stringify(pkg, null, 2), filename: workspace.getPath('package.json') }
}

function invalidCase(exports: Exports, errorCount: number): ESLintRuleTester.InvalidTestCase {
  return { ...publishableCase(exports), errors: Array.from({ length: errorCount }, () => ({ messageId: 'notAnEntryModule' })) }
}

function createNonPublishableCase(): ESLintRuleTester.ValidTestCase {
  const pkg = { name: 'internal-lib', exports: { './utils': './src/utils.js' } }
  const workspace = manager.create({ projectJson: NON_PUBLISHABLE_LIBRARY_PROJECT_JSON, packageJson: pkg })
  return { code: JSON.stringify(pkg, null, 2), filename: workspace.getPath('package.json') }
}

function createUnquotedKeysCase(): ESLintRuleTester.ValidTestCase {
  const workspace = manager.create({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: { name: '@hyperfrontend/test-lib', exports: { '.': './src/index.js' } },
  })
  return {
    code: `{ name: "@hyperfrontend/test-lib", exports: { ".": "./src/index.js", "./package.json": "./package.json" } }`,
    filename: workspace.getPath('package.json'),
  }
}

function createNonObjectExportsCase(): ESLintRuleTester.ValidTestCase {
  const workspace = manager.create({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: { name: '@hyperfrontend/test-lib', exports: './src/index.js' },
  })
  return {
    code: JSON.stringify({ name: '@hyperfrontend/test-lib', exports: './src/index.js' }, null, 2),
    filename: workspace.getPath('package.json'),
  }
}

describe('lib-pkg-exports-entry-shape', () => {
  afterAll(() => {
    manager.cleanupAll()
  })

  ruleTester.run('lib-pkg-exports-entry-shape', rule, {
    valid: [
      publishableCase({
        '.': './src/index.js',
        './core': './src/core/index.js',
        './core/logger': './src/core/logger/index.js',
        './queue': './src/lib/queue/index.mjs',
        './package.json': './package.json',
      }),
      publishableCase({ '.': { types: './src/index.d.ts', import: './src/index.mjs', require: './src/index.cjs' } }),
      publishableCase({ '.': './src/index.ts', './package.json': 'package.json', 'bare-specifier': 'left-to-other-rules' }),
      createUnquotedKeysCase(),
      createNonObjectExportsCase(),
      createNonPublishableCase(),
    ],
    invalid: [
      invalidCase({ './core/logger': './src/core/logger.js' }, 1),
      invalidCase({ './lib': './lib/index.js' }, 1),
      invalidCase({ './spec': './src/spec/index.spec.js' }, 1),
      invalidCase({ './bare': './src/bare/index' }, 1),
      invalidCase({ './up': './src/../index.js', './dot': './src/./index.js', './gap': './src//index.js' }, 3),
      invalidCase({ '.': { import: './src/index.mjs', require: './src/main.cjs' } }, 1),
    ],
  })
})
