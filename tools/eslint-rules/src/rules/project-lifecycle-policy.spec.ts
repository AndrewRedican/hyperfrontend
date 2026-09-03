import { join } from 'node:path'
import { after as afterAll } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createJsonRuleTester, createTempWorkspaceManager } from '../testing'
import rule, { matchesGlob, matchesWildcard } from './project-lifecycle-policy'

const manager = createTempWorkspaceManager()

/** Policy used by most cases: the frozen state this workspace applies to shipped demos. */
const FROZEN_POLICY = {
  states: {
    frozen: {
      forbiddenTargets: ['lint', 'test', 'e2e'],
      forbiddenScripts: ['lint', 'lint:*', 'test', 'test:*'],
      forbiddenDependencies: ['eslint', 'eslint-*', '@vitest/*', 'vitest'],
      forbiddenFiles: ['**/*.spec.*', 'eslint.config.*'],
      forbidNpmPublishing: true,
    },
  },
}

/** Policy with no file sweep, so cases that only care about manifests never walk the disk. */
const MANIFEST_ONLY_POLICY = {
  states: {
    frozen: {
      forbiddenTargets: ['lint', 'test'],
      forbiddenScripts: ['lint', 'test:*'],
      forbiddenDependencies: ['eslint', '@vitest/*'],
      forbidNpmPublishing: true,
    },
  },
}

/**
 * Creates a project directory holding a project.json and, optionally, extra files.
 *
 * @param config - What the project should contain.
 * @param config.projectJson - Content for project.json.
 * @param config.packageJson - Content for package.json, when the case lints one.
 * @param config.extraFiles - Additional project-relative files to create.
 * @returns Absolute path to the created project root.
 */
function createProject(config: { projectJson: object; packageJson?: object; extraFiles?: Record<string, string> }): string {
  const files: Record<string, string> = {
    'nx.json': JSON.stringify({ version: 2 }, null, 2),
    'apps/demo/project.json': JSON.stringify(config.projectJson, null, 2),
  }
  if (config.packageJson) {
    files['apps/demo/package.json'] = JSON.stringify(config.packageJson, null, 2)
  }
  for (const [path, contents] of Object.entries(config.extraFiles ?? {})) {
    files[`apps/demo/${path}`] = contents
  }
  return join(manager.create({ files }).root, 'apps', 'demo')
}

/** A frozen project.json with the lifecycle marker in place. */
const frozenProject = {
  name: 'demo-thing',
  projectType: 'application',
  metadata: { lifecycle: { state: 'frozen' } },
  targets: { build: {}, typecheck: {} },
}

const ruleTester = createJsonRuleTester()

describe('project-lifecycle-policy', () => {
  afterAll(() => {
    manager.cleanupAll()
  })

  describe('matchesWildcard', () => {
    it('matches an exact name when the pattern carries no wildcard', () => {
      expect(matchesWildcard('lint', 'lint')).toBe(true)
      expect(matchesWildcard('lint', 'test')).toBe(false)
    })

    it('matches everything against a bare star', () => {
      expect(matchesWildcard('anything', '*')).toBe(true)
    })

    it('anchors a trailing wildcard to the prefix', () => {
      expect(matchesWildcard('lint:eslint', 'lint:*')).toBe(true)
      expect(matchesWildcard('build:watch', 'lint:*')).toBe(false)
    })

    it('anchors a leading wildcard to the suffix', () => {
      expect(matchesWildcard('@vitest/eslint-plugin', '*plugin')).toBe(true)
      expect(matchesWildcard('@vitest/coverage', '*plugin')).toBe(false)
    })

    it('rejects a value too short to hold both anchors', () => {
      expect(matchesWildcard('ab', 'abc*xyz')).toBe(false)
    })

    it('matches a middle segment between two wildcards', () => {
      expect(matchesWildcard('@scope/eslint-plugin-thing', '*eslint*thing')).toBe(true)
      expect(matchesWildcard('@scope/other-plugin', '*eslint*thing')).toBe(false)
    })

    it('rejects when a middle segment only appears inside the suffix', () => {
      expect(matchesWildcard('a-mid', 'a*mid*mid')).toBe(false)
    })

    it('skips empty middle segments produced by adjacent wildcards', () => {
      expect(matchesWildcard('abcdef', 'a**f')).toBe(true)
    })
  })

  describe('matchesGlob', () => {
    it('matches an exact path', () => {
      expect(matchesGlob('eslint.config.ts', 'eslint.config.*')).toBe(true)
    })

    it('spans any number of directories with a double star', () => {
      expect(matchesGlob('src/deep/nested/thing.spec.ts', '**/*.spec.*')).toBe(true)
      expect(matchesGlob('thing.spec.ts', '**/*.spec.*')).toBe(true)
    })

    it('spans exactly one segment with a single star', () => {
      expect(matchesGlob('src/main.ts', 'src/*')).toBe(true)
      expect(matchesGlob('src/deep/main.ts', 'src/*')).toBe(false)
    })

    it('fails when the path runs out before the pattern does', () => {
      expect(matchesGlob('src', 'src/deep/main.ts')).toBe(false)
    })

    it('fails when the pattern runs out before the path does', () => {
      expect(matchesGlob('src/main.ts', 'src')).toBe(false)
    })

    it('fails when a literal segment differs', () => {
      expect(matchesGlob('src/main.ts', 'lib/main.ts')).toBe(false)
    })

    it('matches a trailing double star against everything below it', () => {
      expect(matchesGlob('src/a/b.ts', 'src/**')).toBe(true)
    })

    it('fails when a double star is followed by more pattern than path', () => {
      expect(matchesGlob('a', '**/b')).toBe(false)
    })
  })

  ruleTester.run('project-lifecycle-policy', rule, {
    valid: [
      {
        name: 'skips a project declaring no lifecycle metadata',
        code: JSON.stringify({ name: 'lib-thing', targets: { lint: {}, test: {} } }, null, 2),
        options: [FROZEN_POLICY],
        filename: join(createProject({ projectJson: { name: 'lib-thing', targets: { lint: {}, test: {} } } }), 'project.json'),
      },
      {
        name: 'skips a lifecycle state with no configured policy',
        code: JSON.stringify({ metadata: { lifecycle: { state: 'active' } }, targets: { lint: {} } }, null, 2),
        options: [FROZEN_POLICY],
        filename: join(
          createProject({ projectJson: { metadata: { lifecycle: { state: 'active' } }, targets: { lint: {} } } }),
          'project.json'
        ),
      },
      {
        name: 'skips a non-string lifecycle state',
        code: JSON.stringify({ metadata: { lifecycle: { state: 7 } }, targets: { lint: {} } }, null, 2),
        options: [FROZEN_POLICY],
        filename: join(createProject({ projectJson: { metadata: { lifecycle: { state: 7 } }, targets: { lint: {} } } }), 'project.json'),
      },
      {
        name: 'accepts a frozen project.json declaring only permitted targets',
        code: JSON.stringify(frozenProject, null, 2),
        options: [MANIFEST_ONLY_POLICY],
        filename: join(createProject({ projectJson: frozenProject }), 'project.json'),
      },
      {
        name: 'accepts a frozen package.json that is private and declares nothing forbidden',
        code: JSON.stringify({ name: '@x/demo', private: true, scripts: { build: 'vite build' } }, null, 2),
        options: [MANIFEST_ONLY_POLICY],
        filename: join(
          createProject({ projectJson: frozenProject, packageJson: { name: '@x/demo', private: true, scripts: { build: 'vite build' } } }),
          'package.json'
        ),
      },
      {
        name: 'ignores a manifest that is neither project.json nor package.json',
        code: JSON.stringify({ scripts: { lint: 'eslint .' } }, null, 2),
        options: [MANIFEST_ONLY_POLICY],
        filename: join(createProject({ projectJson: frozenProject }), 'tsconfig.json'),
      },
      {
        name: 'ignores a targets value that is not an object',
        code: JSON.stringify({ metadata: { lifecycle: { state: 'frozen' } }, targets: 'nonsense' }, null, 2),
        options: [MANIFEST_ONLY_POLICY],
        filename: join(
          createProject({ projectJson: { metadata: { lifecycle: { state: 'frozen' } }, targets: 'nonsense' } }),
          'project.json'
        ),
      },
      {
        name: 'ignores a nested targets key that is not at the top level',
        code: JSON.stringify({ metadata: { lifecycle: { state: 'frozen' } }, nested: { targets: { lint: {} } } }, null, 2),
        options: [MANIFEST_ONLY_POLICY],
        filename: join(
          createProject({ projectJson: { metadata: { lifecycle: { state: 'frozen' } }, nested: { targets: { lint: {} } } } }),
          'project.json'
        ),
      },
      {
        name: 'ignores nested package.json fields that are not at the top level',
        code: JSON.stringify({ private: true, nested: { scripts: { lint: 'eslint .' } } }, null, 2),
        options: [MANIFEST_ONLY_POLICY],
        filename: join(
          createProject({ projectJson: frozenProject, packageJson: { private: true, nested: { scripts: { lint: 'eslint .' } } } }),
          'package.json'
        ),
      },
      {
        name: 'ignores scripts and dependency fields that are not objects',
        code: JSON.stringify({ private: true, scripts: 'nope', devDependencies: 'nope' }, null, 2),
        options: [MANIFEST_ONLY_POLICY],
        filename: join(
          createProject({ projectJson: frozenProject, packageJson: { private: true, scripts: 'nope', devDependencies: 'nope' } }),
          'package.json'
        ),
      },
      {
        name: 'runs no file sweep when the state configures no forbidden files',
        code: JSON.stringify(frozenProject, null, 2),
        options: [MANIFEST_ONLY_POLICY],
        filename: join(createProject({ projectJson: frozenProject, extraFiles: { 'src/a.spec.ts': 'export {}' } }), 'project.json'),
      },
      {
        name: 'accepts a project whose files match none of the forbidden globs',
        code: JSON.stringify(frozenProject, null, 2),
        options: [FROZEN_POLICY],
        filename: join(createProject({ projectJson: frozenProject, extraFiles: { 'src/main.ts': 'export {}' } }), 'project.json'),
      },
    ],

    invalid: [
      {
        name: 'reports a forbidden target and suggests removing it',
        code: JSON.stringify({ metadata: { lifecycle: { state: 'frozen' } }, targets: { build: {}, lint: {} } }, null, 2),
        options: [MANIFEST_ONLY_POLICY],
        filename: join(
          createProject({ projectJson: { metadata: { lifecycle: { state: 'frozen' } }, targets: { build: {}, lint: {} } } }),
          'project.json'
        ),
        errors: [
          {
            messageId: 'forbiddenTarget',
            data: { state: 'frozen', name: 'lint' },
            suggestions: [
              {
                messageId: 'removeProperty',
                data: { name: 'lint' },
                output: JSON.stringify({ metadata: { lifecycle: { state: 'frozen' } }, targets: { build: {} } }, null, 2),
              },
            ],
          },
        ],
      },
      {
        name: 'reports a publishing target ahead of the generic target policy',
        code: JSON.stringify({ metadata: { lifecycle: { state: 'frozen' } }, targets: { publish: {} } }, null, 2),
        options: [MANIFEST_ONLY_POLICY],
        filename: join(
          createProject({ projectJson: { metadata: { lifecycle: { state: 'frozen' } }, targets: { publish: {} } } }),
          'project.json'
        ),
        errors: [{ messageId: 'publishingTarget', data: { state: 'frozen', name: 'publish' }, suggestions: 1 }],
      },
      {
        name: 'reports every target when the policy forbids all of them',
        code: JSON.stringify({ metadata: { lifecycle: { state: 'planned' } }, targets: { build: {}, lint: {} } }, null, 2),
        options: [{ states: { planned: { forbiddenTargets: ['*'] } } }],
        filename: join(
          createProject({ projectJson: { metadata: { lifecycle: { state: 'planned' } }, targets: { build: {}, lint: {} } } }),
          'project.json'
        ),
        errors: [
          { messageId: 'forbiddenTarget', data: { state: 'planned', name: 'build' }, suggestions: 1 },
          { messageId: 'forbiddenTarget', data: { state: 'planned', name: 'lint' }, suggestions: 1 },
        ],
      },
      {
        name: 'reports a file matching a forbidden glob',
        code: JSON.stringify(frozenProject, null, 2),
        options: [FROZEN_POLICY],
        filename: join(
          createProject({
            projectJson: frozenProject,
            extraFiles: {
              'src/thing.spec.ts': 'export {}',
              'eslint.config.ts': 'export {}',
              // why: build output and dependencies mirror the source, so the sweep must not report the same violation twice
              'dist/thing.spec.js': 'export {}',
              'node_modules/dep/thing.spec.js': 'export {}',
            },
          }),
          'project.json'
        ),
        errors: [
          { messageId: 'forbiddenFile', data: { state: 'frozen', path: 'src/thing.spec.ts', pattern: '**/*.spec.*' } },
          { messageId: 'forbiddenFile', data: { state: 'frozen', path: 'eslint.config.ts', pattern: 'eslint.config.*' } },
        ],
      },
      {
        name: 'reports a forbidden script and suggests removing it',
        code: '{\n  "private": true,\n  "scripts": {\n    "lint": "eslint .",\n    "build": "vite build"\n  }\n}',
        options: [MANIFEST_ONLY_POLICY],
        filename: join(
          createProject({
            projectJson: frozenProject,
            packageJson: { private: true, scripts: { lint: 'eslint .', build: 'vite build' } },
          }),
          'package.json'
        ),
        errors: [
          {
            messageId: 'forbiddenScript',
            data: { state: 'frozen', name: 'lint' },
            suggestions: [
              {
                messageId: 'removeProperty',
                data: { name: 'lint' },
                output: '{\n  "private": true,\n  "scripts": {\n    \n    "build": "vite build"\n  }\n}',
              },
            ],
          },
        ],
      },
      {
        name: 'takes the preceding comma when removing the last property',
        code: '{\n  "private": true,\n  "scripts": {\n    "build": "vite build",\n    "test:unit": "vitest"\n  }\n}',
        options: [MANIFEST_ONLY_POLICY],
        filename: join(
          createProject({
            projectJson: frozenProject,
            packageJson: { private: true, scripts: { build: 'vite build', 'test:unit': 'vitest' } },
          }),
          'package.json'
        ),
        errors: [
          {
            messageId: 'forbiddenScript',
            data: { state: 'frozen', name: 'test:unit' },
            suggestions: [
              {
                messageId: 'removeProperty',
                data: { name: 'test:unit' },
                output: '{\n  "private": true,\n  "scripts": {\n    "build": "vite build"\n  }\n}',
              },
            ],
          },
        ],
      },
      {
        name: 'reports a forbidden dependency in any dependency field, with no suggestion',
        code: JSON.stringify({ private: true, devDependencies: { eslint: '9.0.0' }, dependencies: { '@vitest/ui': '1.0.0' } }, null, 2),
        options: [MANIFEST_ONLY_POLICY],
        filename: join(
          createProject({
            projectJson: frozenProject,
            packageJson: { private: true, devDependencies: { eslint: '9.0.0' }, dependencies: { '@vitest/ui': '1.0.0' } },
          }),
          'package.json'
        ),
        errors: [
          { messageId: 'forbiddenDependency', data: { state: 'frozen', name: 'eslint' } },
          { messageId: 'forbiddenDependency', data: { state: 'frozen', name: '@vitest/ui' } },
        ],
      },
      {
        name: 'reports publishConfig on a project that is never published',
        code: JSON.stringify({ private: true, publishConfig: { access: 'public' } }, null, 2),
        options: [MANIFEST_ONLY_POLICY],
        filename: join(
          createProject({ projectJson: frozenProject, packageJson: { private: true, publishConfig: { access: 'public' } } }),
          'package.json'
        ),
        errors: [{ messageId: 'forbiddenPublishConfig', data: { state: 'frozen', name: 'publishConfig' }, suggestions: 1 }],
      },
      {
        name: 'reports a package.json that declares no private field at all',
        code: JSON.stringify({ name: '@x/demo' }, null, 2),
        options: [MANIFEST_ONLY_POLICY],
        filename: join(createProject({ projectJson: frozenProject, packageJson: { name: '@x/demo' } }), 'package.json'),
        errors: [{ messageId: 'missingPrivate', data: { state: 'frozen' } }],
      },
      {
        name: 'reports a private field set to false and suggests flipping it',
        code: '{\n  "private": false\n}',
        options: [MANIFEST_ONLY_POLICY],
        filename: join(createProject({ projectJson: frozenProject, packageJson: { private: false } }), 'package.json'),
        errors: [
          {
            messageId: 'missingPrivate',
            data: { state: 'frozen' },
            suggestions: [{ messageId: 'addPrivate', output: '{\n  "private": true\n}' }],
          },
        ],
      },
    ],
  })
})
