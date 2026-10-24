import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempDir } from '@hyperfrontend/testing/fs'
import { runHfLint } from './hf-lint'

const DIR = createTempDir({
  prefix: 'hf-lint-',
  tree: {
    'lint.config.ts': "export default [{ files: ['**/*.js'], rules: { 'no-debugger': 'error' } }]\n",
    'a.js': 'debugger\n',
    'piped.txt': 'const a = 1\n',
  },
})
const PROJECT = DIR.path

/** A process whose streams are captured. */
interface Captured {
  readonly stdout: { write(text: string): void }
  readonly stderr: { write(text: string): void }
  readonly out: string[]
  readonly errors: string[]
}

const captured = (): Captured => {
  const out: string[] = []
  const errors: string[] = []
  return { stdout: { write: (text) => void out.push(text) }, stderr: { write: (text) => void errors.push(text) }, out, errors }
}

describe('runHfLint', () => {
  it('answers 1 for a problem found in the working directory', async () => {
    expect(await runHfLint({ argv: [], cwd: PROJECT, stdin: 0, ...captured() })).toBe(1)
  })

  it('writes the report to standard output', async () => {
    const run = captured()
    await runHfLint({ argv: ['--format', 'json'], cwd: PROJECT, stdin: 0, ...run })
    expect(run.out.join('')).toContain('"ruleId":"no-debugger"')
  })

  it('writes a usage error to standard error', async () => {
    const run = captured()
    await runHfLint({ argv: ['--colour'], cwd: PROJECT, stdin: 0, ...run })
    expect(run.errors.join('')).toContain('Unknown option --colour')
  })

  it('lints standard input from the source it is given', async () => {
    const run = captured()
    const code = await runHfLint({
      argv: ['--stdin', '--stdin-filename', 'piped.js'],
      cwd: PROJECT,
      stdin: join(PROJECT, 'piped.txt'),
      ...run,
    })
    expect(code).toBe(0)
  })

  it('leaves no temporary project behind', () => {
    DIR.remove()
    expect(existsSync(PROJECT)).toBe(false)
  })
})
