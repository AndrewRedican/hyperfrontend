import type { RuleTester as ESLintRuleTester } from 'eslint'
import {
  createJsonRuleTester,
  createTempWorkspaceManager,
  APPLICATION_PROJECT_JSON,
  NON_PUBLISHABLE_LIBRARY_PROJECT_JSON,
  PUBLISHABLE_LIBRARY_PROJECT_JSON,
} from '../testing'
import rule from './lib-pkg-fields'

const manager = createTempWorkspaceManager()
const ruleTester = createJsonRuleTester()

/**
 * Complete valid package.json content with all required fields.
 */
const validPackageJson = {
  name: '@hyperfrontend/test-lib',
  description: 'A test library',
  license: 'MIT',
  sideEffects: false,
  engines: { node: '>=18.0.0' },
  keywords: ['test', 'library'],
  exports: {
    '.': './src/index.js',
    './browser': './src/browser/index.js',
  },
}

function createNonPublishableCase(): ESLintRuleTester.ValidTestCase {
  const workspace = manager.create({
    projectJson: NON_PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: { name: 'internal-lib' },
  })
  return {
    code: JSON.stringify({ name: 'internal-lib' }, null, 2),
    filename: workspace.getPath('package.json'),
  }
}

function createApplicationCase(): ESLintRuleTester.ValidTestCase {
  const workspace = manager.create({
    projectJson: { ...APPLICATION_PROJECT_JSON, targets: { ...APPLICATION_PROJECT_JSON.targets, publish: {} } },
    packageJson: { name: 'test-app' },
  })
  return {
    code: JSON.stringify({ name: 'test-app' }, null, 2),
    filename: workspace.getPath('package.json'),
  }
}

function createNoProjectJsonCase(): ESLintRuleTester.ValidTestCase {
  const workspace = manager.create({
    packageJson: { name: 'standalone-pkg' },
  })
  return {
    code: JSON.stringify({ name: 'standalone-pkg' }, null, 2),
    filename: workspace.getPath('package.json'),
  }
}

function createValidPublishableCase(): ESLintRuleTester.ValidTestCase {
  const workspace = manager.create({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: validPackageJson,
  })
  return {
    code: JSON.stringify(validPackageJson, null, 2),
    filename: workspace.getPath('package.json'),
  }
}

function createMissingNameCase(): ESLintRuleTester.InvalidTestCase {
  const pkg = { ...validPackageJson }
  delete (pkg as Record<string, unknown>)['name']
  const workspace = manager.create({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: pkg,
  })
  return {
    code: JSON.stringify(pkg, null, 2),
    filename: workspace.getPath('package.json'),
    errors: [{ messageId: 'missingName' }],
  }
}

function createMissingDescriptionCase(): ESLintRuleTester.InvalidTestCase {
  const pkg = { ...validPackageJson }
  delete (pkg as Record<string, unknown>)['description']
  const workspace = manager.create({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: pkg,
  })
  return {
    code: JSON.stringify(pkg, null, 2),
    filename: workspace.getPath('package.json'),
    errors: [{ messageId: 'missingDescription' }],
  }
}

function createMissingLicenseCase(): ESLintRuleTester.InvalidTestCase {
  const pkg = { ...validPackageJson }
  delete (pkg as Record<string, unknown>)['license']
  const workspace = manager.create({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: pkg,
  })
  return {
    code: JSON.stringify(pkg, null, 2),
    filename: workspace.getPath('package.json'),
    errors: [{ messageId: 'missingLicense' }],
  }
}

function createMissingSideEffectsCase(): ESLintRuleTester.InvalidTestCase {
  const pkg = { ...validPackageJson }
  delete (pkg as Record<string, unknown>)['sideEffects']
  const workspace = manager.create({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: pkg,
  })
  return {
    code: JSON.stringify(pkg, null, 2),
    filename: workspace.getPath('package.json'),
    errors: [{ messageId: 'missingSideEffects' }],
  }
}

function createMissingEnginesCase(): ESLintRuleTester.InvalidTestCase {
  const pkg = { ...validPackageJson }
  delete (pkg as Record<string, unknown>)['engines']
  const workspace = manager.create({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: pkg,
  })
  return {
    code: JSON.stringify(pkg, null, 2),
    filename: workspace.getPath('package.json'),
    errors: [{ messageId: 'missingEngines' }],
  }
}

function createMissingKeywordsCase(): ESLintRuleTester.InvalidTestCase {
  const pkg = { ...validPackageJson }
  delete (pkg as Record<string, unknown>)['keywords']
  const workspace = manager.create({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: pkg,
  })
  return {
    code: JSON.stringify(pkg, null, 2),
    filename: workspace.getPath('package.json'),
    errors: [{ messageId: 'missingKeywords' }],
  }
}

function createMissingAllFieldsCase(): ESLintRuleTester.InvalidTestCase {
  const pkg = { version: '1.0.0' }
  const workspace = manager.create({
    projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    packageJson: pkg,
  })
  return {
    code: JSON.stringify(pkg, null, 2),
    filename: workspace.getPath('package.json'),
    errors: [
      { messageId: 'missingName' },
      { messageId: 'missingDescription' },
      { messageId: 'missingLicense' },
      { messageId: 'missingSideEffects' },
      { messageId: 'missingEngines' },
      { messageId: 'missingKeywords' },
    ],
  }
}

describe('lib-pkg-fields', () => {
  afterAll(() => {
    manager.cleanupAll()
  })

  ruleTester.run('lib-pkg-fields', rule, {
    valid: [
      {
        name: 'skips non-publishable libraries (no publish target)',
        ...createNonPublishableCase(),
      },
      {
        name: 'skips application projects',
        ...createApplicationCase(),
      },
      {
        name: 'skips when no project.json exists',
        ...createNoProjectJsonCase(),
      },
      {
        name: 'passes for publishable library with all required fields',
        ...createValidPublishableCase(),
      },
    ],
    invalid: [
      {
        name: 'reports missing name field',
        ...createMissingNameCase(),
      },
      {
        name: 'reports missing description field',
        ...createMissingDescriptionCase(),
      },
      {
        name: 'reports missing license field',
        ...createMissingLicenseCase(),
      },
      {
        name: 'reports missing sideEffects field',
        ...createMissingSideEffectsCase(),
      },
      {
        name: 'reports missing engines field',
        ...createMissingEnginesCase(),
      },
      {
        name: 'reports missing keywords field',
        ...createMissingKeywordsCase(),
      },
      {
        name: 'reports all missing fields at once',
        ...createMissingAllFieldsCase(),
      },
    ],
  })
})
