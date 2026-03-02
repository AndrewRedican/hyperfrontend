import type { RuleTester as ESLintRuleTester } from 'eslint'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RuleTester } from 'eslint'
import rule from './lib-pkg-fields'

const tempDirs: string[] = []

/**
 * Creates a temporary project structure for testing.
 *
 * @param config - Configuration for the temporary project.
 * @param config.projectJson - Optional project.json content.
 * @param config.packageJson - Optional package.json content.
 * @returns The path to the temporary project directory.
 */
function createTempProject(config: { projectJson?: object; packageJson?: object }): string {
  const testDir = mkdtempSync(join(tmpdir(), 'eslint-test-'))
  tempDirs.push(testDir)

  if (config.projectJson) {
    writeFileSync(join(testDir, 'project.json'), JSON.stringify(config.projectJson, null, 2), { mode: 0o600 })
  }

  if (config.packageJson) {
    writeFileSync(join(testDir, 'package.json'), JSON.stringify(config.packageJson, null, 2), { mode: 0o600 })
  }

  mkdirSync(join(testDir, 'src'), { recursive: true })
  return testDir
}

const ruleTester = new RuleTester({
  languageOptions: {
    parser: require('jsonc-eslint-parser'),
  },
})

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

/**
 * Publishable library project.json.
 */
const publishableProjectJson = {
  projectType: 'library',
  targets: { build: {}, publish: {} },
}

function createNonPublishableCase(): ESLintRuleTester.ValidTestCase {
  const projectDir = createTempProject({
    projectJson: {
      projectType: 'library',
      targets: { build: {} },
    },
    packageJson: { name: 'internal-lib' }, // Missing required fields but should be skipped
  })
  return {
    code: JSON.stringify({ name: 'internal-lib' }, null, 2),
    filename: join(projectDir, 'package.json'),
  }
}

function createApplicationCase(): ESLintRuleTester.ValidTestCase {
  const projectDir = createTempProject({
    projectJson: {
      projectType: 'application',
      targets: { build: {}, publish: {} },
    },
    packageJson: { name: 'test-app' },
  })
  return {
    code: JSON.stringify({ name: 'test-app' }, null, 2),
    filename: join(projectDir, 'package.json'),
  }
}

function createNoProjectJsonCase(): ESLintRuleTester.ValidTestCase {
  const projectDir = createTempProject({
    packageJson: { name: 'standalone-pkg' },
  })
  return {
    code: JSON.stringify({ name: 'standalone-pkg' }, null, 2),
    filename: join(projectDir, 'package.json'),
  }
}

function createValidPublishableCase(): ESLintRuleTester.ValidTestCase {
  const projectDir = createTempProject({
    projectJson: publishableProjectJson,
    packageJson: validPackageJson,
  })
  return {
    code: JSON.stringify(validPackageJson, null, 2),
    filename: join(projectDir, 'package.json'),
  }
}

function createMissingNameCase(): ESLintRuleTester.InvalidTestCase {
  const pkg = { ...validPackageJson }
  delete (<Record<string, unknown>>pkg)['name']
  const projectDir = createTempProject({
    projectJson: publishableProjectJson,
    packageJson: pkg,
  })
  return {
    code: JSON.stringify(pkg, null, 2),
    filename: join(projectDir, 'package.json'),
    errors: [{ messageId: 'missingName' }],
  }
}

function createMissingDescriptionCase(): ESLintRuleTester.InvalidTestCase {
  const pkg = { ...validPackageJson }
  delete (<Record<string, unknown>>pkg)['description']
  const projectDir = createTempProject({
    projectJson: publishableProjectJson,
    packageJson: pkg,
  })
  return {
    code: JSON.stringify(pkg, null, 2),
    filename: join(projectDir, 'package.json'),
    errors: [{ messageId: 'missingDescription' }],
  }
}

function createMissingLicenseCase(): ESLintRuleTester.InvalidTestCase {
  const pkg = { ...validPackageJson }
  delete (<Record<string, unknown>>pkg)['license']
  const projectDir = createTempProject({
    projectJson: publishableProjectJson,
    packageJson: pkg,
  })
  return {
    code: JSON.stringify(pkg, null, 2),
    filename: join(projectDir, 'package.json'),
    errors: [{ messageId: 'missingLicense' }],
  }
}

function createMissingSideEffectsCase(): ESLintRuleTester.InvalidTestCase {
  const pkg = { ...validPackageJson }
  delete (<Record<string, unknown>>pkg)['sideEffects']
  const projectDir = createTempProject({
    projectJson: publishableProjectJson,
    packageJson: pkg,
  })
  return {
    code: JSON.stringify(pkg, null, 2),
    filename: join(projectDir, 'package.json'),
    errors: [{ messageId: 'missingSideEffects' }],
  }
}

function createMissingEnginesCase(): ESLintRuleTester.InvalidTestCase {
  const pkg = { ...validPackageJson }
  delete (<Record<string, unknown>>pkg)['engines']
  const projectDir = createTempProject({
    projectJson: publishableProjectJson,
    packageJson: pkg,
  })
  return {
    code: JSON.stringify(pkg, null, 2),
    filename: join(projectDir, 'package.json'),
    errors: [{ messageId: 'missingEngines' }],
  }
}

function createMissingKeywordsCase(): ESLintRuleTester.InvalidTestCase {
  const pkg = { ...validPackageJson }
  delete (<Record<string, unknown>>pkg)['keywords']
  const projectDir = createTempProject({
    projectJson: publishableProjectJson,
    packageJson: pkg,
  })
  return {
    code: JSON.stringify(pkg, null, 2),
    filename: join(projectDir, 'package.json'),
    errors: [{ messageId: 'missingKeywords' }],
  }
}

function createMissingAllFieldsCase(): ESLintRuleTester.InvalidTestCase {
  const pkg = { version: '1.0.0' }
  const projectDir = createTempProject({
    projectJson: publishableProjectJson,
    packageJson: pkg,
  })
  return {
    code: JSON.stringify(pkg, null, 2),
    filename: join(projectDir, 'package.json'),
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
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
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
