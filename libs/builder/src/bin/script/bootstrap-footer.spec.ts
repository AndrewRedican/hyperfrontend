import { describe, expect, it } from '@hyperfrontend/testing'
import { defaultBootstrap } from './bootstrap-footer'

describe('defaultBootstrap', () => {
  it('uses module.exports.default for the default export under CJS', () => {
    const footer = defaultBootstrap({ runner: 'default', format: 'cjs' })
    expect(footer.startsWith('module.exports.default(')).toBe(true)
  })

  it('uses dynamic import of import.meta.url for the default export under ESM', () => {
    const footer = defaultBootstrap({ runner: 'default', format: 'esm' })
    expect(footer.startsWith('(await import(import.meta.url)).default(')).toBe(true)
  })

  it('references the named runner directly under CJS', () => {
    const footer = defaultBootstrap({ runner: 'runCz', format: 'cjs' })
    expect(footer.startsWith('runCz(')).toBe(true)
  })

  it('references the named runner directly under ESM', () => {
    const footer = defaultBootstrap({ runner: 'runCz', format: 'esm' })
    expect(footer.startsWith('runCz(')).toBe(true)
  })

  it('forwards process.argv.slice(2), cwd, stderr, and stdout to the runner', () => {
    const footer = defaultBootstrap({ runner: 'r', format: 'cjs' })
    expect(footer).toContain('argv: process.argv.slice(2)')
    expect(footer).toContain('cwd: process.cwd()')
    expect(footer).toContain('stderr: process.stderr')
    expect(footer).toContain('stdout: process.stdout')
  })

  it('maps the resolved exit code through process.exit on success', () => {
    const footer = defaultBootstrap({ runner: 'r', format: 'cjs' })
    expect(footer).toContain('(code) => { process.exit(code) }')
  })

  it('writes a stringified error to stderr and exits 1 on rejection', () => {
    const footer = defaultBootstrap({ runner: 'r', format: 'cjs' })
    expect(footer).toContain("process.stderr.write((error instanceof Error ? error.message : String(error)) + '\\n')")
    expect(footer).toContain('process.exit(1)')
  })
})
