import type { RuleTester as ESLintRuleTester } from 'eslint'
import { after as afterAll } from 'node:test'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { describe, expect, it } from '@hyperfrontend/testing'
import {
  createJsonRuleTester,
  createTempWorkspaceManager,
  NON_PUBLISHABLE_LIBRARY_PROJECT_JSON,
  PUBLISHABLE_LIBRARY_PROJECT_JSON,
} from '../testing'
import rule, { readmeDescription, RULE_NAME } from './lib-pkg-description'

const manager = createTempWorkspaceManager()
const ruleTester = createJsonRuleTester()

/** The sentence the fixture readme opens with. */
const OPENING = 'One line about the package.'

/** A readme shaped like a publishable package's: title, badges, opening line, first section. */
const README = [
  '# @hyperfrontend/test-lib',
  '',
  '<p align="center">',
  '  <img src="https://img.shields.io/npm/v/x" alt="npm">',
  '</p>',
  '',
  OPENING,
  '',
  '## What is it?',
  '',
].join('\n')

/**
 * A package.json test case laid out beside a readme.
 *
 * @param packageJson - The manifest under test.
 * @param readme - The readme beside it, or null for a package with none.
 * @param projectJson - The project configuration, publishable unless said otherwise.
 * @returns The case's code and filename.
 */
function laidOut(
  packageJson: Record<string, unknown>,
  readme: string | null = README,
  projectJson: Record<string, unknown> = PUBLISHABLE_LIBRARY_PROJECT_JSON
): ESLintRuleTester.ValidTestCase {
  const workspace = manager.create({ projectJson, packageJson, files: readme === null ? {} : { 'README.md': readme } })
  return { code: stringify(packageJson, null, 2), filename: workspace.getPath('package.json') }
}

describe('lib-pkg-description', () => {
  afterAll(() => {
    manager.cleanupAll()
  })

  it('exports the rule name', () => {
    expect(RULE_NAME).toBe('lib-pkg-description')
  })

  describe('readmeDescription', () => {
    it('reads the line after the badges, and nothing from a readme without badges, without a line, or absent', () => {
      const cases: Array<string | null> = [
        README,
        '# @hyperfrontend/test-lib\n\nNo badges here.\n',
        '# @hyperfrontend/test-lib\n\n<p align="center"><img src="https://img.shields.io/npm/v/x" alt="npm"></p>\n\n## Straight in\n',
        null,
      ]
      const read = cases.map((readme) => {
        const workspace = manager.create({ files: readme === null ? {} : { 'README.md': readme } })
        return readmeDescription(workspace.getPath('.'))
      })
      expect(read).toEqual([OPENING, null, null, null])
    })
  })

  ruleTester.run(RULE_NAME, rule, {
    valid: [
      {
        name: 'skips a package that is not publishable',
        ...laidOut({ name: 'internal', description: 'Other.' }, README, NON_PUBLISHABLE_LIBRARY_PROJECT_JSON),
      },
      { name: 'skips a package with no readme', ...laidOut({ name: '@hyperfrontend/test-lib', description: 'Other.' }, null) },
      {
        name: 'skips a readme with no opening line',
        ...laidOut({ name: '@hyperfrontend/test-lib', description: 'Other.' }, '# @hyperfrontend/test-lib\n\n## Straight in\n'),
      },
      {
        name: 'accepts a manifest whose description is the opening line',
        ...laidOut({ name: '@hyperfrontend/test-lib', description: OPENING }),
      },
      {
        name: 'ignores a nested field of the same name',
        ...laidOut({ name: '@hyperfrontend/test-lib', description: OPENING, exports: { '.': { description: 'Other.' } } }),
      },
      { name: 'leaves a description that is not text to the field rule', ...laidOut({ name: '@hyperfrontend/test-lib', description: {} }) },
    ],
    invalid: [
      {
        name: 'copies the opening line into a manifest that says something else',
        ...laidOut({ name: '@hyperfrontend/test-lib', description: 'Other words, with a "quote".' }),
        errors: [{ messageId: 'descriptionDrift' }],
        output: stringify({ name: '@hyperfrontend/test-lib', description: OPENING }, null, 2),
      },
    ],
  })
})
