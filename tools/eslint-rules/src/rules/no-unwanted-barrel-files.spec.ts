import type { InvalidTestCase, ValidTestCase } from '@typescript-eslint/rule-tester'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { RuleTester } from '@typescript-eslint/rule-tester'
import rule from './no-unwanted-barrel-files'

type TestOptions = readonly []
type MessageIds = 'unwantedBarrelFile'

/**
 * Creates a temporary project structure for testing.
 *
 * @param config - Configuration for the temporary project.
 * @param config.projectJson - Optional project.json content.
 * @param config.packageJson - Optional package.json content.
 * @param config.indexFiles - Optional list of index files to create.
 * @returns The path to the temporary project directory.
 */
function createTempProject(config: { projectJson?: object; packageJson?: object; indexFiles?: string[] }): string {
  const testDir = join(tmpdir(), `eslint-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(testDir, { recursive: true })

  if (config.projectJson) {
    writeFileSync(join(testDir, 'project.json'), JSON.stringify(config.projectJson, null, 2))
  }

  if (config.packageJson) {
    writeFileSync(join(testDir, 'package.json'), JSON.stringify(config.packageJson, null, 2))
  }

  if (config.indexFiles) {
    for (const indexFile of config.indexFiles) {
      const fullPath = join(testDir, indexFile)
      mkdirSync(dirname(fullPath), { recursive: true })
      writeFileSync(fullPath, 'export {};\n')
    }
  }

  return testDir
}

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: false,
    },
  },
})

const tempDirs: string[] = []

/**
 * Creates a valid test case for non-index.ts files.
 *
 * @returns A valid test case configuration.
 */
function createNonIndexFileCase(): ValidTestCase<TestOptions> {
  return {
    code: 'export const foo = 1;',
    filename: '/some/path/utils.ts',
  }
}

/**
 * Creates a valid test case for main entry point with no exports field.
 *
 * @returns A valid test case configuration.
 */
function createMainEntryPointCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({
    projectJson: {
      projectType: 'library',
      targets: { build: {}, publish: {} },
    },
    packageJson: { name: 'test-lib' },
  })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src'), { recursive: true })
  return {
    code: 'export * from "./lib";',
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Creates a valid test case for declared export entry point.
 *
 * @returns A valid test case configuration.
 */
function createDeclaredExportCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({
    projectJson: {
      projectType: 'library',
      targets: { build: {}, publish: {} },
    },
    packageJson: {
      name: 'test-lib',
      exports: {
        './browser': './src/browser/index.js',
      },
    },
  })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src', 'browser'), { recursive: true })
  return {
    code: 'export * from "./implementation";',
    filename: join(projectDir, 'src', 'browser', 'index.ts'),
  }
}

/**
 * Creates a valid test case for non-library project.
 *
 * @returns A valid test case configuration.
 */
function createNonLibraryCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({
    projectJson: {
      projectType: 'application',
      targets: { build: {}, publish: {} },
    },
    packageJson: { name: 'test-app' },
  })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src', 'internal'), { recursive: true })
  return {
    code: 'export {}',
    filename: join(projectDir, 'src', 'internal', 'index.ts'),
  }
}

/**
 * Creates a valid test case for library without publish target.
 *
 * @returns A valid test case configuration.
 */
function createNonPublishableCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({
    projectJson: {
      projectType: 'library',
      targets: { build: {} },
    },
    packageJson: { name: 'internal-lib' },
  })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src', 'internal'), { recursive: true })
  return {
    code: 'export {}',
    filename: join(projectDir, 'src', 'internal', 'index.ts'),
  }
}

/**
 * Creates a valid test case for index.ts without project.json.
 *
 * @returns A valid test case configuration.
 */
function createNoProjectJsonCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({
    packageJson: { name: 'test-lib' },
  })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src'), { recursive: true })
  return {
    code: 'export {}',
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Creates an invalid test case for undeclared barrel file with no exports.
 *
 * @returns An invalid test case configuration.
 */
function createUndeclaredBarrelNoExportsCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject({
    projectJson: {
      projectType: 'library',
      targets: { build: {}, publish: {} },
    },
    packageJson: { name: 'test-lib' },
  })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src', 'lib', 'creators'), { recursive: true })
  return {
    code: 'export * from "./creator";',
    filename: join(projectDir, 'src', 'lib', 'creators', 'index.ts'),
    errors: [{ messageId: 'unwantedBarrelFile' }],
  }
}

/**
 * Creates an invalid test case for undeclared barrel file with exports.
 *
 * @returns An invalid test case configuration.
 */
function createUndeclaredBarrelWithExportsCase(): InvalidTestCase<MessageIds, TestOptions> {
  const projectDir = createTempProject({
    projectJson: {
      projectType: 'library',
      targets: { build: {}, publish: {} },
    },
    packageJson: {
      name: 'test-lib',
      exports: {
        './browser': './src/browser/index.js',
        './node': './src/node/index.js',
      },
    },
  })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src', 'lib', 'utils'), { recursive: true })
  return {
    code: 'export * from "./internal-helper";',
    filename: join(projectDir, 'src', 'lib', 'utils', 'index.ts'),
    errors: [{ messageId: 'unwantedBarrelFile' }],
  }
}

/**
 * Creates a valid test case for object-style exports.
 *
 * @returns A valid test case configuration.
 */
function createObjectStyleExportsCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({
    projectJson: {
      projectType: 'library',
      targets: { build: {}, publish: {} },
    },
    packageJson: {
      name: 'test-lib',
      exports: {
        './browser': {
          import: './src/browser/index.js',
          require: './src/browser/index.cjs',
        },
      },
    },
  })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src', 'browser'), { recursive: true })
  return {
    code: 'export * from "./implementation";',
    filename: join(projectDir, 'src', 'browser', 'index.ts'),
  }
}

/**
 * Creates a valid test case for invalid JSON in package.json.
 *
 * @returns A valid test case configuration.
 */
function createInvalidPackageJsonCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({
    projectJson: {
      projectType: 'library',
      targets: { build: {}, publish: {} },
    },
  })
  tempDirs.push(projectDir)
  writeFileSync(join(projectDir, 'package.json'), 'invalid json {{{')
  mkdirSync(join(projectDir, 'src'), { recursive: true })
  return {
    code: 'export {}',
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Creates a valid test case for invalid JSON in project.json.
 *
 * @returns A valid test case configuration.
 */
function createInvalidProjectJsonCase(): ValidTestCase<TestOptions> {
  const testDir = join(tmpdir(), `eslint-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(testDir, { recursive: true })
  tempDirs.push(testDir)
  writeFileSync(join(testDir, 'project.json'), 'invalid json {{{')
  mkdirSync(join(testDir, 'src'), { recursive: true })
  return {
    code: 'export {}',
    filename: join(testDir, 'src', 'index.ts'),
  }
}

/**
 * Creates a valid test case for unresolvable export object.
 *
 * @returns A valid test case configuration.
 */
function createUnresolvableExportCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({
    projectJson: {
      projectType: 'library',
      targets: { build: {}, publish: {} },
    },
    packageJson: {
      name: 'test-lib',
      exports: {
        './special': {
          types: './src/special/index.d.ts',
        },
      },
    },
  })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src'), { recursive: true })
  return {
    code: 'export * from "./lib";',
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Creates a valid test case for null export value in package.json.
 *
 * @returns A valid test case configuration.
 */
function createNullExportValueCase(): ValidTestCase<TestOptions> {
  const testDir = join(tmpdir(), `eslint-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(testDir, { recursive: true })
  tempDirs.push(testDir)
  writeFileSync(
    join(testDir, 'project.json'),
    JSON.stringify({
      projectType: 'library',
      targets: { build: {}, publish: {} },
    })
  )
  writeFileSync(
    join(testDir, 'package.json'),
    JSON.stringify({
      name: 'test-lib',
      exports: {
        './special': null,
      },
    })
  )
  mkdirSync(join(testDir, 'src'), { recursive: true })
  return {
    code: 'export * from "./lib";',
    filename: join(testDir, 'src', 'index.ts'),
  }
}

/**
 * Creates a valid test case for empty exports object.
 *
 * @returns A valid test case configuration.
 */
function createEmptyExportsCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({
    projectJson: {
      projectType: 'library',
      targets: { build: {}, publish: {} },
    },
    packageJson: {
      name: 'test-lib',
      exports: {},
    },
  })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src'), { recursive: true })
  return {
    code: 'export * from "./lib";',
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

/**
 * Creates a valid test case for require-style exports.
 *
 * @returns A valid test case configuration.
 */
function createRequireStyleExportsCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({
    projectJson: {
      projectType: 'library',
      targets: { build: {}, publish: {} },
    },
    packageJson: {
      name: 'test-lib',
      exports: {
        './node': {
          require: './src/node/index.cjs',
        },
      },
    },
  })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src', 'node'), { recursive: true })
  return {
    code: 'export * from "./implementation";',
    filename: join(projectDir, 'src', 'node', 'index.ts'),
  }
}

/**
 * Creates a valid test case for default-style exports.
 *
 * @returns A valid test case configuration.
 */
function createDefaultStyleExportsCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({
    projectJson: {
      projectType: 'library',
      targets: { build: {}, publish: {} },
    },
    packageJson: {
      name: 'test-lib',
      exports: {
        './default': {
          default: './src/default/index.js',
        },
      },
    },
  })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src', 'default'), { recursive: true })
  return {
    code: 'export * from "./implementation";',
    filename: join(projectDir, 'src', 'default', 'index.ts'),
  }
}

/**
 * Creates a valid test case for export paths not ending in js/cjs/mjs.
 *
 * @returns A valid test case configuration.
 */
function createNonJsExportPathCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({
    projectJson: {
      projectType: 'library',
      targets: { build: {}, publish: {} },
    },
    packageJson: {
      name: 'test-lib',
      exports: {
        './special': './src/special/index.ts',
      },
    },
  })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src', 'special'), { recursive: true })
  return {
    code: 'export * from "./implementation";',
    filename: join(projectDir, 'src', 'special', 'index.ts'),
  }
}

/**
 * Creates a valid test case for library without package.json.
 *
 * @returns A valid test case configuration.
 */
function createNoPackageJsonCase(): ValidTestCase<TestOptions> {
  const projectDir = createTempProject({
    projectJson: {
      projectType: 'library',
      targets: { build: {}, publish: {} },
    },
  })
  tempDirs.push(projectDir)
  mkdirSync(join(projectDir, 'src'), { recursive: true })
  return {
    code: 'export {}',
    filename: join(projectDir, 'src', 'index.ts'),
  }
}

describe('no-unwanted-barrel-files', () => {
  afterAll(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  ruleTester.run('no-unwanted-barrel-files', rule, {
    valid: [
      {
        name: 'does not trigger for non-index.ts files',
        ...createNonIndexFileCase(),
      },
      {
        name: 'does not trigger for main entry point (no exports field)',
        ...createMainEntryPointCase(),
      },
      {
        name: 'does not trigger for declared export entry point',
        ...createDeclaredExportCase(),
      },
      {
        name: 'does not trigger for non-library project',
        ...createNonLibraryCase(),
      },
      {
        name: 'does not trigger for library without publish target',
        ...createNonPublishableCase(),
      },
      {
        name: 'does not trigger for index.ts without project.json',
        ...createNoProjectJsonCase(),
      },
      {
        name: 'does not trigger for object-style exports',
        ...createObjectStyleExportsCase(),
      },
      {
        name: 'does not trigger when package.json has invalid JSON',
        ...createInvalidPackageJsonCase(),
      },
      {
        name: 'does not trigger when project.json has invalid JSON',
        ...createInvalidProjectJsonCase(),
      },
      {
        name: 'does not trigger for export objects without import/require/default',
        ...createUnresolvableExportCase(),
      },
      {
        name: 'does not trigger for library without package.json',
        ...createNoPackageJsonCase(),
      },
      {
        name: 'does not trigger for null export value',
        ...createNullExportValueCase(),
      },
      {
        name: 'does not trigger for empty exports object',
        ...createEmptyExportsCase(),
      },
      {
        name: 'does not trigger for require-style exports',
        ...createRequireStyleExportsCase(),
      },
      {
        name: 'does not trigger for default-style exports',
        ...createDefaultStyleExportsCase(),
      },
      {
        name: 'does not trigger for non-js export paths',
        ...createNonJsExportPathCase(),
      },
    ],
    invalid: [
      {
        name: 'triggers for undeclared barrel file (no exports)',
        ...createUndeclaredBarrelNoExportsCase(),
      },
      {
        name: 'triggers for undeclared barrel file (with exports)',
        ...createUndeclaredBarrelWithExportsCase(),
      },
    ],
  })
})
