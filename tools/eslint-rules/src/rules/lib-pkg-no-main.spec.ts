import type { RuleTester as ESLintRuleTester } from 'eslint'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RuleTester } from 'eslint'
import rule from './lib-pkg-no-main'

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
 * Publishable library project.json.
 */
const publishableProjectJson = {
  projectType: 'library',
  targets: { build: {}, publish: {} },
}

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
  const projectDir = createTempProject({
    projectJson: publishableProjectJson,
    packageJson: validPackageJson,
  })
  return {
    code: JSON.stringify(validPackageJson, null, 2),
    filename: join(projectDir, 'package.json'),
  }
}

function createNonPublishableCase(): ESLintRuleTester.ValidTestCase {
  const projectDir = createTempProject({
    projectJson: {
      projectType: 'library',
      targets: { build: {} }, // No publish target
    },
    packageJson: { name: 'internal-lib', main: './src/index.js' },
  })
  return {
    code: JSON.stringify({ name: 'internal-lib', main: './src/index.js' }, null, 2),
    filename: join(projectDir, 'package.json'),
  }
}

function createApplicationCase(): ESLintRuleTester.ValidTestCase {
  const projectDir = createTempProject({
    projectJson: {
      projectType: 'application',
      targets: { build: {}, publish: {} },
    },
    packageJson: { name: 'test-app', main: './src/main.js' },
  })
  return {
    code: JSON.stringify({ name: 'test-app', main: './src/main.js' }, null, 2),
    filename: join(projectDir, 'package.json'),
  }
}

function createMainOnlyCase(): ESLintRuleTester.InvalidTestCase {
  const pkg = {
    name: '@hyperfrontend/test-lib',
    main: './src/index.js',
  }
  const projectDir = createTempProject({
    projectJson: publishableProjectJson,
    packageJson: pkg,
  })
  return {
    code: JSON.stringify(pkg, null, 2),
    filename: join(projectDir, 'package.json'),
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
  const projectDir = createTempProject({
    projectJson: publishableProjectJson,
    packageJson: pkg,
  })
  return {
    code: JSON.stringify(pkg, null, 2),
    filename: join(projectDir, 'package.json'),
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
  // main is THE LAST PROPERTY - this tests the leading comma removal branch
  const pkg = {
    name: '@hyperfrontend/test-lib',
    exports: {
      '.': './src/index.js',
    },
    main: './src/index.js',
  }
  const projectDir = createTempProject({
    projectJson: publishableProjectJson,
    packageJson: pkg,
  })
  return {
    code: JSON.stringify(pkg, null, 2),
    filename: join(projectDir, 'package.json'),
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
  // main has a non-string value (object) - fix returns null
  const pkg = {
    name: '@hyperfrontend/test-lib',
    main: { default: './src/index.js' },
  }
  const projectDir = createTempProject({
    projectJson: publishableProjectJson,
    packageJson: pkg,
  })
  return {
    code: JSON.stringify(pkg, null, 2),
    filename: join(projectDir, 'package.json'),
    errors: [{ messageId: 'noMainField' }],
    // No output - fix returns null when main is not a string
    output: null,
  }
}

describe('lib-pkg-no-main', () => {
  afterAll(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
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
