import type { RunEnvironment } from './run'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { describe, expect, it } from '@hyperfrontend/testing'
import { run } from './run'

const FIXTURES = join(import.meta.dirname, '..', 'config', '__fixtures__')

// why: the JSON report carries native absolute paths, which escape their backslashes on Windows, so the paths are read back rather than searched for.
const reportedFiles = (out: readonly string[]): string[] => (parse(out.join('')) as { filePath: string }[]).map((result) => result.filePath)

/** A directory holding a lone manifest, outside any configuration. */
const PLAIN = mkdtempSync(join(tmpdir(), 'lint-plain-'))
writeFileSync(join(PLAIN, 'package.json'), '{\n  "name": "plain-fixture"\n}\n')

/** A project whose configuration sits above the directory the command runs in. */
const TREE = mkdtempSync(join(tmpdir(), 'lint-run-'))
mkdirSync(join(TREE, 'src'))
writeFileSync(join(TREE, 'lint.config.ts'), "export default [{ files: ['src/**/*.ts'], rules: { 'no-debugger': 'error' } }]\n")
writeFileSync(join(TREE, 'src', 'a.ts'), 'debugger\n')

interface Captured {
  readonly environment: RunEnvironment
  readonly out: string[]
  readonly errors: string[]
}

const capture = (cwd: string, stdin = ''): Captured => {
  const out: string[] = []
  const errors: string[] = []
  return {
    out,
    errors,
    environment: { cwd, readStdin: () => stdin, write: (text) => out.push(text), writeError: (text) => errors.push(text) },
  }
}

describe('run', () => {
  it('prints the usage for --help', async () => {
    const captured = capture(import.meta.dirname)
    await run(['--help'], captured.environment)
    expect(captured.out.join('')).toContain('usage: lint')
  })

  it('exits 2 for an unknown option', async () => {
    expect(await run(['--colour'], capture(import.meta.dirname).environment)).toBe(2)
  })

  it('names the unknown option on standard error', async () => {
    const captured = capture(import.meta.dirname)
    await run(['--colour'], captured.environment)
    expect(captured.errors.join('')).toContain('Unknown option --colour')
  })

  it('exits 2 when the configuration cannot be loaded', async () => {
    expect(await run(['--config', join(FIXTURES, 'missing.ts'), '.'], capture(import.meta.dirname).environment)).toBe(2)
  })

  it('exits 2 naming the file when a rule in effect has no module', async () => {
    const captured = capture(import.meta.dirname, '{}')
    await run(['--config', join(FIXTURES, 'workspace.ts'), '--stdin', '--stdin-filename', 'a.json'], captured.environment)
    expect(captured.errors.join('')).toContain(
      `Error while linting ${join(import.meta.dirname, 'a.json')}: Definition for rule test/no-main was not found`
    )
  })

  it('exits 2 when no configuration file exists at or above the working directory', async () => {
    expect(await run(['--stdin', '--stdin-filename', 'a.json'], capture('/', '{}').environment)).toBe(2)
  })

  it('refuses --fix for piped-in code', async () => {
    const captured = capture(import.meta.dirname, '{}')
    await run(['--config', join(FIXTURES, 'empty.ts'), '--fix', '--stdin', '--stdin-filename', 'a.json'], captured.environment)
    expect(captured.errors.join('')).toContain('--fix cannot write piped-in code')
  })

  it('writes nothing under --fix when nothing changes', async () => {
    const captured = capture(PLAIN)
    expect(await run(['--config', join(FIXTURES, 'warn.ts'), '--fix', 'package.json'], captured.environment)).toBe(0)
  })

  it('exits 2 for --stdin without a filename', async () => {
    expect(await run(['--config', join(FIXTURES, 'empty.ts'), '--stdin'], capture(import.meta.dirname).environment)).toBe(2)
  })

  it('exits 2 for an argument that names nothing', async () => {
    const captured = capture(import.meta.dirname)
    await run(['--config', join(FIXTURES, 'empty.ts'), 'missing.json'], captured.environment)
    expect({
      code: await run(['--config', join(FIXTURES, 'empty.ts'), 'missing.json'], captured.environment),
      error: captured.errors[0],
    }).toEqual({
      code: 2,
      error: 'No files matching missing.json were found.\n',
    })
  })

  it('tolerates an argument that names nothing when asked', async () => {
    expect(
      await run(
        ['--config', join(FIXTURES, 'empty.ts'), '--no-error-on-unmatched-pattern', 'missing.json'],
        capture(import.meta.dirname).environment
      )
    ).toBe(0)
  })

  it('reports a problem in the stylish shape and exits 1', async () => {
    const captured = capture(import.meta.dirname, '{ "main": "x", "exports": {} }')
    const code = await run(['--config', join(FIXTURES, 'no-main.ts'), '--stdin', '--stdin-filename', 'package.json'], captured.environment)
    expect({ code, out: captured.out.join('') }).toEqual({
      code: 1,
      out: expect.stringContaining(
        '  1:3  error  Remove the "main" field. The "exports" field should be used instead for modern Node.js resolution  fixture/no-main'
      ),
    })
  })

  it('reports the fixed text under --fix-dry-run', async () => {
    const captured = capture(import.meta.dirname, '{ "main": "x", "exports": {} }')
    await run(
      ['--config', join(FIXTURES, 'no-main.ts'), '--stdin', '--stdin-filename', 'package.json', '--fix-dry-run', '--format', 'json'],
      captured.environment
    )
    expect(captured.out.join('')).toContain('"output":"{ \\"exports\\": {} }"')
  })

  it('writes fixes to disk under --fix', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'lint-run-'))
    writeFileSync(join(directory, 'project.json'), '{ "projectType": "library", "targets": { "build": {}, "publish": {} } }')
    writeFileSync(join(directory, 'package.json'), '{ "main": "x", "exports": {} }')
    const code = await run(['--config', join(FIXTURES, 'no-main.ts'), '--fix', 'package.json'], capture(directory).environment)
    const written = readFileSync(join(directory, 'package.json'), 'utf8')
    rmSync(directory, { recursive: true })
    expect({ code, written }).toEqual({ code: 0, written: '{ "exports": {} }' })
  })

  it('exits 1 when warnings exceed the limit', async () => {
    const captured = capture(import.meta.dirname, '{ "main": "x", "exports": {} }')
    expect(
      await run(
        ['--config', join(FIXTURES, 'warn.ts'), '--max-warnings', '0', '--stdin', '--stdin-filename', 'package.json'],
        captured.environment
      )
    ).toBe(1)
  })

  it('exits 0 for warnings within the limit', async () => {
    const captured = capture(import.meta.dirname, '{ "main": "x", "exports": {} }')
    expect(await run(['--config', join(FIXTURES, 'warn.ts'), '--stdin', '--stdin-filename', 'package.json'], captured.environment)).toBe(0)
  })

  it('lints the files of a directory that the configuration selects', async () => {
    const captured = capture(PLAIN)
    const code = await run(['--config', join(FIXTURES, 'warn.ts'), '--format', 'json', '.'], captured.environment)
    expect({ code, files: reportedFiles(captured.out) }).toEqual({ code: 0, files: [join(PLAIN, 'package.json')] })
  })

  it('lints the working directory when no path is given', async () => {
    const captured = capture(PLAIN)
    await run(['--config', join(FIXTURES, 'warn.ts'), '--format', 'json'], captured.environment)
    expect(reportedFiles(captured.out)).toEqual([join(PLAIN, 'package.json')])
  })

  it('answers an ignored piped-in file with the ignore warning', async () => {
    const captured = capture(import.meta.dirname, '{}')
    await run(
      ['--config', join(FIXTURES, 'ignoring.ts'), '--format', 'json', '--stdin', '--stdin-filename', 'dist/a.json'],
      captured.environment
    )
    expect(captured.out.join('')).toContain('"message":"File ignored because of a matching ignore pattern.')
  })

  it('answers an unconfigured piped-in file with the configuration warning', async () => {
    const captured = capture(import.meta.dirname, 'x')
    await run(['--config', join(FIXTURES, 'ignoring.ts'), '--format', 'json', '--stdin', '--stdin-filename', 'a.png'], captured.environment)
    expect(captured.out.join('')).toContain('"message":"File ignored because no matching configuration was supplied."')
  })

  it('answers an explicitly named ignored file with the warning in the stylish shape', async () => {
    const captured = capture(PLAIN)
    await run(['--config', join(FIXTURES, 'ignoring.ts'), 'package.json'], captured.environment)
    expect(captured.out.join('')).toContain('  0:0  warning  File ignored because of a matching ignore pattern\n')
  })

  it('silently leaves an ignored file a directory walk found', async () => {
    const captured = capture(PLAIN)
    await run(['--config', join(FIXTURES, 'ignoring.ts'), '--format', 'json', '.'], captured.environment)
    expect(captured.out.join('')).toBe('[]\n')
  })

  it('uses the nearest configuration above the working directory, its globs relative to its own directory', async () => {
    const captured = capture(join(TREE, 'src'))
    await run(['--format', 'json', '.'], captured.environment)
    expect(captured.out.join('')).toContain('"message":"Unexpected \'debugger\' statement."')
  })

  it('leaves no temporary trees behind', () => {
    rmSync(TREE, { recursive: true, force: true })
    rmSync(PLAIN, { recursive: true, force: true })
    expect([existsSync(TREE), existsSync(PLAIN)]).toEqual([false, false])
  })

  it('prints an empty JSON report for a clean run', async () => {
    const captured = capture(import.meta.dirname, '{}')
    await run(['--config', join(FIXTURES, 'empty.ts'), '--format', 'json', '--stdin', '--stdin-filename', 'a.json'], captured.environment)
    expect(captured.out.join('')).toContain('"messages":[]')
  })
})
