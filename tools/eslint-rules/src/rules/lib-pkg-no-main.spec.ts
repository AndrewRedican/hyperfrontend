import type { RuleTester as ESLintRuleTester } from 'eslint'
import { after as afterAll } from 'node:test'
import { describe } from '@hyperfrontend/testing'
import {
  createJsonRuleTester,
  createTempWorkspaceManager,
  APPLICATION_PROJECT_JSON,
  NON_PUBLISHABLE_LIBRARY_PROJECT_JSON,
  PUBLISHABLE_LIBRARY_PROJECT_JSON,
} from '../testing'
import rule from './lib-pkg-no-main'

const manager = createTempWorkspaceManager()
const ruleTester = createJsonRuleTester()

/**
 * Valid package.json with exports (no main).
 */
const validPackageJson = {
  name: '@hyperfrontend/test-lib',
  exports: {
    '.': './src/index.js',
    './utils': './src/utils/index.js',
  },
}

function createValidWithExportsCase(): ESLintRuleTester.ValidTestCase {
  const workspace = manager.create({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: validPackageJson,
  })
  return {
    code: JSON.stringify(validPackageJson, null, 2),
    filename: workspace.getPath('package.json'),
  }
}

function createNonPublishableCase(): ESLintRuleTester.ValidTestCase {
  const workspace = manager.create({
    projectJson: NON_PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: { name: 'internal-lib', main: './src/index.js' },
  })
  return {
    code: JSON.stringify({ name: 'internal-lib', main: './src/index.js' }, null, 2),
    filename: workspace.getPath('package.json'),
  }
}

function createApplicationCase(): ESLintRuleTester.ValidTestCase {
  const workspace = manager.create({
    projectJson: { ...APPLICATION_PROJECT_JSON, targets: { ...APPLICATION_PROJECT_JSON.targets, publish: {} } },
    packageJson: { name: 'test-app', main: './src/main.js' },
  })
  return {
    code: JSON.stringify({ name: 'test-app', main: './src/main.js' }, null, 2),
    filename: workspace.getPath('package.json'),
  }
}

function createMainOnlyCase(): ESLintRuleTester.InvalidTestCase {
  const pkg = {
    name: '@hyperfrontend/test-lib',
    main: './src/index.js',
  }
  const workspace = manager.create({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: pkg,
  })
  return {
    code: JSON.stringify(pkg, null, 2),
    filename: workspace.getPath('package.json'),
    errors: [{ messageId: 'noMainField' }],
    output: `{
  "name": "@hyperfrontend/test-lib",
  "exports": {
    ".": "./src/index.js"
  }
}`,
  }
}

function createMainWithExportsCase(): ESLintRuleTester.InvalidTestCase {
  const pkg = {
    name: '@hyperfrontend/test-lib',
    main: './src/index.js',
    exports: {
      '.': './src/index.js',
      './utils': './src/utils/index.js',
    },
  }
  const workspace = manager.create({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: pkg,
  })
  return {
    code: JSON.stringify(pkg, null, 2),
    filename: workspace.getPath('package.json'),
    errors: [{ messageId: 'mainWithExports' }],
    output: `{
  "name": "@hyperfrontend/test-lib",
  "exports": {
    ".": "./src/index.js",
    "./utils": "./src/utils/index.js"
  }
}`,
  }
}

function createMainLastPropertyWithExportsCase(): ESLintRuleTester.InvalidTestCase {
  const pkg = {
    name: '@hyperfrontend/test-lib',
    exports: {
      '.': './src/index.js',
    },
    main: './src/index.js',
  }
  const workspace = manager.create({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: pkg,
  })
  return {
    code: JSON.stringify(pkg, null, 2),
    filename: workspace.getPath('package.json'),
    errors: [{ messageId: 'mainWithExports' }],
    output: `{
  "name": "@hyperfrontend/test-lib",
  "exports": {
    ".": "./src/index.js"
  }
}`,
  }
}

function createMainWithNonStringValueCase(): ESLintRuleTester.InvalidTestCase {
  const pkg = {
    name: '@hyperfrontend/test-lib',
    main: { default: './src/index.js' },
  }
  const workspace = manager.create({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: pkg,
  })
  return {
    code: JSON.stringify(pkg, null, 2),
    filename: workspace.getPath('package.json'),
    errors: [{ messageId: 'noMainField' }],
    output: null,
  }
}

describe('lib-pkg-no-main', () => {
  afterAll(() => {
    manager.cleanupAll()
  })

  ruleTester.run('lib-pkg-no-main', rule, {
    valid: [createValidWithExportsCase(), createNonPublishableCase(), createApplicationCase()],
    invalid: [
      createMainOnlyCase(),
      createMainWithExportsCase(),
      createMainLastPropertyWithExportsCase(),
      createMainWithNonStringValueCase(),
    ],
  })
})
