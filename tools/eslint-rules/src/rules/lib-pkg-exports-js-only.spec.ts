import type { RuleTester as ESLintRuleTester } from 'eslint'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RuleTester } from 'eslint'
import rule from './lib-pkg-exports-js-only'

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
  const projectDir = createTempProject({
    projectJson: publishableProjectJson,
    packageJson: pkg,
  })
  return {
    code: JSON.stringify(pkg, null, 2),
    filename: join(projectDir, 'package.json'),
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
  const projectDir = createTempProject({
    projectJson: publishableProjectJson,
    packageJson: pkg,
  })
  return {
    code: JSON.stringify(pkg, null, 2),
    filename: join(projectDir, 'package.json'),
  }
}

function createNonPublishableCase(): ESLintRuleTester.ValidTestCase {
  const projectDir = createTempProject({
    projectJson: {
      projectType: 'library',
      targets: { build: {} }, // No publish target
    },
    packageJson: {
      name: 'internal-lib',
      exports: { '.': './src/index.ts' }, // Would be invalid but skipped
    },
  })
  return {
    code: JSON.stringify({ name: 'internal-lib', exports: { '.': './src/index.ts' } }, null, 2),
    filename: join(projectDir, 'package.json'),
  }
}

function createTsExtensionCase(): ESLintRuleTester.InvalidTestCase {
  const pkg = {
    name: '@hyperfrontend/test-lib',
    exports: {
      '.': './src/index.ts',
    },
  }
  const projectDir = createTempProject({
    projectJson: publishableProjectJson,
    packageJson: pkg,
  })
  return {
    code: JSON.stringify(pkg, null, 2),
    filename: join(projectDir, 'package.json'),
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
  const projectDir = createTempProject({
    projectJson: publishableProjectJson,
    packageJson: pkg,
  })
  return {
    code: JSON.stringify(pkg, null, 2),
    filename: join(projectDir, 'package.json'),
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
  const projectDir = createTempProject({
    projectJson: publishableProjectJson,
    packageJson: pkg,
  })
  return {
    code: JSON.stringify(pkg, null, 2),
    filename: join(projectDir, 'package.json'),
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
  const projectDir = createTempProject({
    projectJson: publishableProjectJson,
    packageJson: pkg,
  })
  return {
    code: JSON.stringify(pkg, null, 2),
    filename: join(projectDir, 'package.json'),
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
  const projectDir = createTempProject({
    projectJson: publishableProjectJson,
    packageJson: pkg,
  })
  return {
    code: JSON.stringify(pkg, null, 2),
    filename: join(projectDir, 'package.json'),
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
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
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
