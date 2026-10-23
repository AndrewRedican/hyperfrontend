#!/usr/bin/env node
/**
 * Installs the packed @hyperfrontend/linter into a throwaway consumer outside the workspace and
 * checks what a consumer does with it on the running Node.js: the `hf-lint` bin lints, fixes and
 * sets its exit code, `lint` runs from code, and a rule registered through `families` reports
 * and passes its `testRule` tests. Plain JavaScript with no dependencies, so it runs on the
 * package's floor release.
 *
 * Usage, from the workspace root after `npx nx build lib-linter`:
 *
 *   node apps/package-e2e/linter/scripts/consumer-smoke.mjs
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const DIST = resolve(import.meta.dirname, '..', '..', '..', '..', 'dist', 'libs', 'linter')
const WINDOWS = process.platform === 'win32'

/**
 * Runs npm, through a shell on Windows where npm is a .cmd shim, with each argument quoted.
 *
 * @param args - The npm arguments
 * @param cwd - Where to run it
 * @returns What npm printed
 */
const npm = (args, cwd) =>
  execFileSync('npm', WINDOWS ? args.map((arg) => `"${arg}"`) : args, {
    cwd,
    encoding: 'utf8',
    shell: WINDOWS,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

const root = mkdtempSync(join(tmpdir(), 'linter-smoke-'))
const failures = []

/**
 * Records a check.
 *
 * @param name - What was checked
 * @param passed - Whether it held
 * @param detail - What was seen, printed when it did not hold
 */
const check = (name, passed, detail) => {
  process.stdout.write(`${passed ? 'ok' : 'not ok'} - ${name}\n`)
  if (!passed) failures.push(`${name}: ${detail}`)
}

try {
  npm(['pack', DIST, '--pack-destination', root], root)
  const tarball = join(
    root,
    readdirSync(root).find((name) => name.endsWith('.tgz'))
  )
  const consumer = join(root, 'consumer')
  mkdirSync(join(consumer, 'src'), { recursive: true })
  mkdirSync(join(consumer, 'lint-rules'))
  writeFileSync(join(consumer, 'package.json'), '{ "name": "consumer", "version": "1.0.0", "private": true, "type": "module" }\n')
  npm(['install', '--save-dev', '--offline', '--no-audit', '--no-fund', tarball], consumer)

  writeFileSync(
    join(consumer, 'lint-rules', 'no-focused-tests.ts'),
    [
      "import { defineRule } from '@hyperfrontend/linter'",
      '',
      'export default defineRule({',
      "  id: 'local/no-focused-tests',",
      "  language: 'code',",
      '  fixable: true,',
      '  create: (context) => ({',
      '    MemberExpression(node) {',
      "      if (node.object?.name !== 'it' || node.property?.name !== 'only') return",
      "      context.report({ start: node.start, end: node.end, message: 'Remove .only.', fix: { start: node.object.end, end: node.end, text: '' } })",
      '    },',
      '  }),',
      '})',
      '',
    ].join('\n')
  )
  writeFileSync(
    join(consumer, 'lint-rules', 'no-focused-tests.spec.ts'),
    [
      "import { testRule } from '@hyperfrontend/linter/testing'",
      "import rule from './no-focused-tests.ts'",
      '',
      'testRule(rule, {',
      "  valid: [{ name: 'a plain test', path: '/p/a.ts', text: 'it(1)\\n' }],",
      "  invalid: [{ name: 'a focused test', path: '/p/a.ts', text: 'it.only(1)\\n', errors: [{ message: 'Remove .only.', line: 1, column: 1 }], output: 'it(1)\\n' }],",
      '})',
      '',
    ].join('\n')
  )
  writeFileSync(
    join(consumer, 'lint.config.ts'),
    [
      "import { CODE, CODE_RULES } from '@hyperfrontend/linter'",
      "import noFocusedTests from './lint-rules/no-focused-tests.ts'",
      '',
      'export default [',
      "  { families: { local: { 'no-focused-tests': noFocusedTests } } },",
      '  { files: CODE, rules: CODE_RULES },',
      "  { files: ['src/**/*.ts'], rules: { 'local/no-focused-tests': 'error' } },",
      ']',
      '',
    ].join('\n')
  )
  const source = join(consumer, 'src', 'a.spec.ts')
  writeFileSync(source, "var total = 1\nit.only('adds', () => total)\n")

  const bin = join(consumer, 'node_modules', '@hyperfrontend', 'linter', 'bin', 'hf-lint.mjs')
  const report = spawnSync(process.execPath, [bin, '--format', 'json'], { cwd: consumer, encoding: 'utf8' })
  const rules = report.status === 1 ? JSON.parse(report.stdout).flatMap((file) => file.messages.map((message) => message.ruleId)) : []
  check(
    'hf-lint exits with 1 and reports the core and the registered rule',
    ['local/no-focused-tests', 'no-var'].every((id) => rules.includes(id)),
    report.stderr || report.stdout
  )

  const fixed = spawnSync(process.execPath, [bin, '--fix'], { cwd: consumer, encoding: 'utf8' })
  const text = readFileSync(source, 'utf8')
  check(
    'hf-lint --fix rewrites the file and exits with 0',
    fixed.status === 0 && text === "const total = 1\nit('adds', () => total)\n",
    `${fixed.status} ${JSON.stringify(text)}`
  )

  writeFileSync(
    join(consumer, 'api.mjs'),
    "import { lint } from '@hyperfrontend/linter'\nconst report = await lint({ cwd: process.cwd(), patterns: ['src'] })\nprocess.stdout.write(String(report.errorCount))\n"
  )
  const api = spawnSync(process.execPath, ['api.mjs'], { cwd: consumer, encoding: 'utf8' })
  check('lint() runs from code', api.status === 0 && api.stdout === '0', api.stderr || api.stdout)

  const tests = spawnSync(process.execPath, ['--test', join('lint-rules', '*.spec.ts')], { cwd: consumer, encoding: 'utf8' })
  check('testRule runs the rule tests on node --test', tests.status === 0, tests.stdout + tests.stderr)
} finally {
  rmSync(root, { recursive: true, force: true })
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`)
  process.exitCode = 1
}
