/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/linter`.
 *
 * The packed tarball is installed into a consumer outside the workspace and every test runs under plain Node with no
 * loader hooks: the CommonJS build of every entry is required natively, and the main entry lints a text against a
 * configuration on disk.
 */

'use strict'

const { join } = require('node:path')
const { before } = require('node:test')
const { describe, it, expect } = require('@hyperfrontend/testing')
const { usePackedConsumer } = require('@hyperfrontend/testing/consumer')

/** A project whose configuration applies one rule to every JavaScript file. */
const PROJECT = {
  'project/lint.config.mjs': "export default [{ files: ['**/*.js'], rules: { 'no-debugger': 'error' } }]\n",
}

const consumer = usePackedConsumer({ tarball: process.env.HF_E2E_TARBALL })

before(() => consumer.writeTree(PROJECT))

describe('@hyperfrontend/linter CJS', () => {
  it('requires every export entry', () => {
    expect(consumer.entries('require').filter((entry) => !entry.ok)).toEqual([])
  })

  it('requires the main entry and lints a text', () => {
    const errorCount = consumer.run(
      async (target) => {
        const { lint } = require('@hyperfrontend/linter')
        const report = await lint({ cwd: target.cwd, config: 'lint.config.mjs', text: { path: 'a.js', text: 'debugger\n' } })
        return report.errorCount
      },
      { kind: 'require', args: { cwd: join(consumer.path, 'project') } }
    )
    expect(errorCount).toBe(1)
  })

  it('requires the secondary entries', () => {
    const kinds = consumer.run(
      () => {
        const helpers = require('@hyperfrontend/linter/helpers')
        const testing = require('@hyperfrontend/linter/testing')
        return [typeof helpers.positionAt, typeof testing.testRule]
      },
      { kind: 'require' }
    )
    expect(kinds).toEqual(['function', 'function'])
  })
})
