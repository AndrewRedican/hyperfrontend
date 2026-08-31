import type { RuleTester as ESLintRuleTester } from 'eslint'
import { after as afterAll } from 'node:test'
import { describe } from '@hyperfrontend/testing'
import {
  createJsonRuleTester,
  createTempWorkspaceManager,
  NON_PUBLISHABLE_LIBRARY_PROJECT_JSON,
  PUBLISHABLE_LIBRARY_PROJECT_JSON,
} from '../testing'
import rule from './lib-pkg-exports-js-only'

const manager = createTempWorkspaceManager()
const ruleTester = createJsonRuleTester()

function createValidJsExportsCase(): ESLintRuleTester.ValidTestCase {
  const pkg = {
    name: '@hyperfrontend/test-lib',
    exports: {
      '.': './src/index.js',
      './utils': './src/utils/index.mjs',
      './cjs': './src/cjs/index.cjs',
      './package.json': './package.json',
    },
  }
  const workspace = manager.create({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: pkg,
  })
  return {
    code: JSON.stringify(pkg, null, 2),
    filename: workspace.getPath('package.json'),
  }
}

function createValidConditionalExportsCase(): ESLintRuleTester.ValidTestCase {
  const pkg = {
    name: '@hyperfrontend/test-lib',
    exports: {
      '.': {
        import: './src/index.mjs',
        require: './src/index.cjs',
      },
    },
  }
  const workspace = manager.create({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: pkg,
  })
  return {
    code: JSON.stringify(pkg, null, 2),
    filename: workspace.getPath('package.json'),
  }
}

function createNonPublishableCase(): ESLintRuleTester.ValidTestCase {
  const workspace = manager.create({
    projectJson: NON_PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: {
      name: 'internal-lib',
      exports: { '.': './src/index.ts' },
    },
  })
  return {
    code: JSON.stringify({ name: 'internal-lib', exports: { '.': './src/index.ts' } }, null, 2),
    filename: workspace.getPath('package.json'),
  }
}

function createTsExtensionCase(): ESLintRuleTester.InvalidTestCase {
  const pkg = {
    name: '@hyperfrontend/test-lib',
    exports: {
      '.': './src/index.ts',
    },
  }
  const workspace = manager.create({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: pkg,
  })
  return {
    code: JSON.stringify(pkg, null, 2),
    filename: workspace.getPath('package.json'),
    errors: [{ messageId: 'invalidExtension' }],
    output: `{
  "name": "@hyperfrontend/test-lib",
  "exports": {
    ".": "./src/index.js"
  }
}`,
  }
}

function createTsxExtensionCase(): ESLintRuleTester.InvalidTestCase {
  const pkg = {
    name: '@hyperfrontend/test-lib',
    exports: {
      './component': './src/component.tsx',
    },
  }
  const workspace = manager.create({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: pkg,
  })
  return {
    code: JSON.stringify(pkg, null, 2),
    filename: workspace.getPath('package.json'),
    errors: [{ messageId: 'invalidExtension' }],
    output: `{
  "name": "@hyperfrontend/test-lib",
  "exports": {
    "./component": "./src/component.js"
  }
}`,
  }
}

function createMtsExtensionCase(): ESLintRuleTester.InvalidTestCase {
  const pkg = {
    name: '@hyperfrontend/test-lib',
    exports: {
      '.': './src/index.mts',
    },
  }
  const workspace = manager.create({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: pkg,
  })
  return {
    code: JSON.stringify(pkg, null, 2),
    filename: workspace.getPath('package.json'),
    errors: [{ messageId: 'invalidExtension' }],
    output: `{
  "name": "@hyperfrontend/test-lib",
  "exports": {
    ".": "./src/index.mjs"
  }
}`,
  }
}

function createCtsExtensionCase(): ESLintRuleTester.InvalidTestCase {
  const pkg = {
    name: '@hyperfrontend/test-lib',
    exports: {
      '.': './src/index.cts',
    },
  }
  const workspace = manager.create({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: pkg,
  })
  return {
    code: JSON.stringify(pkg, null, 2),
    filename: workspace.getPath('package.json'),
    errors: [{ messageId: 'invalidExtension' }],
    output: `{
  "name": "@hyperfrontend/test-lib",
  "exports": {
    ".": "./src/index.cjs"
  }
}`,
  }
}

function createConditionalTsCase(): ESLintRuleTester.InvalidTestCase {
  const pkg = {
    name: '@hyperfrontend/test-lib',
    exports: {
      '.': {
        import: './src/index.ts',
        require: './src/index.ts',
      },
    },
  }
  const workspace = manager.create({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: pkg,
  })
  return {
    code: JSON.stringify(pkg, null, 2),
    filename: workspace.getPath('package.json'),
    errors: [{ messageId: 'invalidExtension' }, { messageId: 'invalidExtension' }],
    output: `{
  "name": "@hyperfrontend/test-lib",
  "exports": {
    ".": {
      "import": "./src/index.js",
      "require": "./src/index.js"
    }
  }
}`,
  }
}

describe('lib-pkg-exports-js-only', () => {
  afterAll(() => {
    manager.cleanupAll()
  })

  ruleTester.run('lib-pkg-exports-js-only', rule, {
    valid: [createValidJsExportsCase(), createValidConditionalExportsCase(), createNonPublishableCase()],
    invalid: [
      createTsExtensionCase(),
      createTsxExtensionCase(),
      createMtsExtensionCase(),
      createCtsExtensionCase(),
      createConditionalTsCase(),
    ],
  })
})
