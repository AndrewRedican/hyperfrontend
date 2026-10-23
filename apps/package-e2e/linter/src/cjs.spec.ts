/**
 * CJS E2E tests for `@hyperfrontend/linter`: the CommonJS build of every entry is requireable, and
 * the main entry lints a text against a configuration on disk.
 */

'use strict'

const { existsSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { describe, it, expect } = require('@hyperfrontend/testing')

const PROJECT = mkdtempSync(join(tmpdir(), 'linter-e2e-cjs-'))
writeFileSync(join(PROJECT, 'lint.config.mjs'), "export default [{ files: ['**/*.js'], rules: { 'no-debugger': 'error' } }]\n")

describe('@hyperfrontend/linter CJS', () => {
  it('requires the main entry and lints a text', async () => {
    const { lint } = require('@hyperfrontend/linter')
    const report = await lint({ cwd: PROJECT, config: 'lint.config.mjs', text: { path: 'a.js', text: 'debugger\n' } })
    expect(report.errorCount).toBe(1)
  })

  it('requires the secondary entries', () => {
    const helpers = require('@hyperfrontend/linter/helpers')
    const testing = require('@hyperfrontend/linter/testing')
    expect([typeof helpers.positionAt, typeof testing.testRule]).toEqual(['function', 'function'])
  })

  it('leaves no temporary project behind', () => {
    rmSync(PROJECT, { recursive: true, force: true })
    expect(existsSync(PROJECT)).toBe(false)
  })
})
