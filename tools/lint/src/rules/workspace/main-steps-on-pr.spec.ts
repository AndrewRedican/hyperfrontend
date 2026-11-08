import { join } from 'node:path'
import { testRule } from '@hyperfrontend/linter/testing'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempDir } from '@hyperfrontend/testing/fs'
import rule from './main-steps-on-pr.ts'

/**
 * A workflow with a plan job and an environment job.
 *
 * @param steps - The names of the environment job's steps
 * @returns The workflow's text
 */
function workflow(...steps: string[]): string {
  return [
    'jobs:',
    '  plan:',
    '    steps:',
    '      - name: Plan only',
    '        run: plan',
    '',
    '  environment:',
    '    name: ${{ matrix.os }}',
    '    steps:',
    ...steps.flatMap((step) => [`      - name: ${step}`, '        run: |', '          echo step', '']),
    '  status:',
    '    steps:',
    '      - name: Status only',
    '',
  ].join('\n')
}

const workflows = createTempDir({ prefix: 'main-steps-', tree: { 'ci-pr.yml': workflow('Checkout', 'Command line', 'Run') } })
const MAIN = join(workflows.path, 'ci-main.yml')
const ALONE = join(workflows.path, 'alone', 'ci-main.yml')
const WITH_EXTRA = workflow('Checkout', 'Command line', 'Command line through cmd', 'Run')
const WITH_AUTH = workflow('Checkout', 'npm auth', 'Command line', 'Run')

/**
 * Where a step's name sits in a workflow.
 *
 * @param text - The workflow
 * @param name - The step's name
 * @returns The line and column of its first character and of the character after it
 */
function at(text: string, name: string): { line: number; column: number; endLine: number; endColumn: number } {
  const lines = text.split(/\r?\n/)
  const index = lines.indexOf(`      - name: ${name}`)
  return { line: index + 1, column: 15, endLine: index + 1, endColumn: 15 + name.length }
}

testRule(rule, {
  valid: [
    { name: 'a main workflow whose every step the pull request runs', path: MAIN, text: workflow('Checkout', 'Run') },
    { name: 'a step listed as main-only', path: MAIN, text: WITH_AUTH, options: { mainOnly: ['npm auth'] } },
    { name: 'steps of the other jobs', path: MAIN, text: workflow('Checkout').replace('Plan only', 'Publish only') },
    { name: 'a workflow with carriage returns', path: MAIN, text: workflow('Checkout', 'Run').replaceAll('\n', '\r\n') },
  ],
  invalid: [
    {
      name: 'a step only the main workflow runs, at its name',
      path: MAIN,
      text: WITH_EXTRA,
      errors: [
        {
          message:
            "Step 'Command line through cmd' of the environment job runs on main only: add it to the environment job of ci-pr.yml so a pull request runs it first, or list it in mainOnly when it publishes.",
          ...at(WITH_EXTRA, 'Command line through cmd'),
        },
      ],
    },
    {
      name: 'a main-only name that is no step of the environment job',
      path: MAIN,
      text: workflow('Checkout'),
      options: { mainOnly: ['Plan only'] },
      errors: [
        {
          message: "mainOnly names 'Plan only', which is no step of the environment job.",
          line: 1,
          column: 1,
          endLine: null,
          endColumn: null,
        },
      ],
    },
    {
      name: 'a main-only name the pull request runs too',
      path: MAIN,
      text: workflow('Checkout', 'Run'),
      options: { mainOnly: ['Run'] },
      errors: [
        {
          message: "mainOnly names 'Run', which the environment job of ci-pr.yml runs too.",
          line: 1,
          column: 1,
          endLine: null,
          endColumn: null,
        },
      ],
    },
  ],
})

describe('a main workflow with no pull-request workflow beside it', () => {
  it('reports every step', () => {
    const text = workflow('Checkout', 'Run')
    testRule(rule, {
      valid: [],
      invalid: [
        {
          name: 'every step of the environment job',
          path: ALONE,
          text,
          errors: ['Checkout', 'Run'].map((name) => ({
            message: `Step '${name}' of the environment job runs on main only: add it to the environment job of ci-pr.yml so a pull request runs it first, or list it in mainOnly when it publishes.`,
            ...at(text, name),
          })),
        },
      ],
    })
  })

  it('removes the disposable workflows', () => {
    workflows.remove()
    expect(workflows.path).toBeTruthy()
  })
})
