import { after as afterAll } from 'node:test'
import { describe } from '@hyperfrontend/testing'
import { createJsonRuleTester, createTempWorkspaceManager } from '../testing'
import rule from './lib-builder-implicit-dependency'

const manager = createTempWorkspaceManager()
const ruleTester = createJsonRuleTester()

/**
 * Creates a temp-workspace project.json on disk and returns its path, so the
 * rule's disk-based guard reads the same shape as the linted source.
 *
 * @param projectJson - The project.json contents to materialize.
 * @returns Absolute path to the written project.json.
 */
function projectPath(projectJson: object): string {
  return manager.create({ projectJson }).getPath('project.json')
}

const LIBRARY_WITH_BUILD = {
  name: 'lib-example',
  projectType: 'library',
  targets: { build: {} },
}

describe('lib-builder-implicit-dependency', () => {
  afterAll(() => {
    manager.cleanupAll()
  })

  ruleTester.run('lib-builder-implicit-dependency', rule, {
    valid: [
      {
        name: 'skips application projects',
        code: JSON.stringify({ projectType: 'application', targets: { build: {} } }, null, 2),
        filename: projectPath({ projectType: 'application', targets: { build: {} } }),
      },
      {
        name: 'skips libraries without a targets block',
        code: JSON.stringify({ name: 'lib-example', projectType: 'library' }, null, 2),
        filename: projectPath({ name: 'lib-example', projectType: 'library' }),
      },
      {
        name: 'skips libraries without a build target',
        code: JSON.stringify({ name: 'lib-example', projectType: 'library', targets: { publish: {} } }, null, 2),
        filename: projectPath({ name: 'lib-example', projectType: 'library', targets: { publish: {} } }),
      },
      {
        name: 'skips the lib-builder tooling project itself (avoids a graph cycle)',
        code: JSON.stringify({ name: 'lib-builder', projectType: 'library', targets: { build: {} } }, null, 2),
        filename: projectPath({ name: 'lib-builder', projectType: 'library', targets: { build: {} } }),
      },
      {
        name: 'passes when both tooling projects are already declared',
        code: JSON.stringify(
          { name: 'lib-example', projectType: 'library', targets: { build: {} }, implicitDependencies: ['lib-builder', 'tool-package'] },
          null,
          2
        ),
        filename: projectPath({
          name: 'lib-example',
          projectType: 'library',
          targets: { build: {} },
          implicitDependencies: ['lib-builder', 'tool-package'],
        }),
      },
      {
        name: 'passes when tooling projects sit alongside unrelated implicit dependencies',
        code: JSON.stringify(
          {
            name: 'lib-example',
            projectType: 'library',
            targets: { build: {} },
            implicitDependencies: ['lib-other', 'lib-builder', 'tool-package'],
          },
          null,
          2
        ),
        filename: projectPath({
          name: 'lib-example',
          projectType: 'library',
          targets: { build: {} },
          implicitDependencies: ['lib-other', 'lib-builder', 'tool-package'],
        }),
      },
    ],
    invalid: [
      {
        name: 'adds implicitDependencies when the field is absent',
        code: ['{', '  "name": "lib-example",', '  "projectType": "library",', '  "targets": { "build": {} }', '}'].join('\n'),
        filename: projectPath(LIBRARY_WITH_BUILD),
        output: [
          '{',
          '  "name": "lib-example",',
          '  "projectType": "library",',
          '  "targets": { "build": {} },',
          '  "implicitDependencies": ["lib-builder", "tool-package"]',
          '}',
        ].join('\n'),
        errors: [{ messageId: 'missingImplicitDependency', data: { missing: '"lib-builder", "tool-package"' } }],
      },
      {
        name: 'appends only the missing tooling project when one is present',
        code: [
          '{',
          '  "name": "lib-example",',
          '  "projectType": "library",',
          '  "targets": { "build": {} },',
          '  "implicitDependencies": ["lib-builder"]',
          '}',
        ].join('\n'),
        filename: projectPath({ ...LIBRARY_WITH_BUILD, implicitDependencies: ['lib-builder'] }),
        output: [
          '{',
          '  "name": "lib-example",',
          '  "projectType": "library",',
          '  "targets": { "build": {} },',
          '  "implicitDependencies": ["lib-builder", "tool-package"]',
          '}',
        ].join('\n'),
        errors: [{ messageId: 'missingImplicitDependency', data: { missing: '"tool-package"' } }],
      },
      {
        name: 'preserves unrelated implicit dependencies while appending tooling',
        code: [
          '{',
          '  "name": "lib-example",',
          '  "projectType": "library",',
          '  "targets": { "build": {} },',
          '  "implicitDependencies": ["lib-other"]',
          '}',
        ].join('\n'),
        filename: projectPath({ ...LIBRARY_WITH_BUILD, implicitDependencies: ['lib-other'] }),
        output: [
          '{',
          '  "name": "lib-example",',
          '  "projectType": "library",',
          '  "targets": { "build": {} },',
          '  "implicitDependencies": ["lib-other", "lib-builder", "tool-package"]',
          '}',
        ].join('\n'),
        errors: [{ messageId: 'missingImplicitDependency', data: { missing: '"lib-builder", "tool-package"' } }],
      },
      {
        name: 'ignores non-string array entries when computing missing tooling',
        code: [
          '{',
          '  "name": "lib-example",',
          '  "projectType": "library",',
          '  "targets": { "build": {} },',
          '  "implicitDependencies": ["lib-builder", 123, {}]',
          '}',
        ].join('\n'),
        filename: projectPath({ ...LIBRARY_WITH_BUILD, implicitDependencies: ['lib-builder'] }),
        output: [
          '{',
          '  "name": "lib-example",',
          '  "projectType": "library",',
          '  "targets": { "build": {} },',
          '  "implicitDependencies": ["lib-builder", "tool-package"]',
          '}',
        ].join('\n'),
        errors: [{ messageId: 'missingImplicitDependency', data: { missing: '"tool-package"' } }],
      },
      {
        name: 'applies to an unnamed library with a build target',
        code: ['{', '  "projectType": "library",', '  "targets": { "build": {} }', '}'].join('\n'),
        filename: projectPath({ projectType: 'library', targets: { build: {} } }),
        output: [
          '{',
          '  "projectType": "library",',
          '  "targets": { "build": {} },',
          '  "implicitDependencies": ["lib-builder", "tool-package"]',
          '}',
        ].join('\n'),
        errors: [{ messageId: 'missingImplicitDependency', data: { missing: '"lib-builder", "tool-package"' } }],
      },
      {
        name: 'reports when implicitDependencies is not an array',
        code: [
          '{',
          '  "name": "lib-example",',
          '  "projectType": "library",',
          '  "targets": { "build": {} },',
          '  "implicitDependencies": "lib-builder"',
          '}',
        ].join('\n'),
        filename: projectPath({ ...LIBRARY_WITH_BUILD, implicitDependencies: 'lib-builder' }),
        errors: [{ messageId: 'invalidImplicitDependencies' }],
      },
    ],
  })
})
