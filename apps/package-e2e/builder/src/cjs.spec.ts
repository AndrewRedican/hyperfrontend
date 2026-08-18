/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/builder`
 * Tests that the package is requireable, its subpaths resolve, and the bin is wired.
 */

describe('@hyperfrontend/builder CJS', () => {
  it('is requireable', () => {
    const pkg = require('@hyperfrontend/builder')
    expect(pkg).toBeDefined()
  })

  it('exposes the documented public API', () => {
    const pkg = require('@hyperfrontend/builder')
    const expected = [
      'build',
      'createBuildContext',
      'runBinPhase',
      'runBundlePhase',
      'runPackagePhase',
      'createMemoryMonitor',
      'recover',
      'byNames',
      'byPrefix',
    ]
    for (const name of expected) {
      expect(typeof pkg[name]).toBe('function')
    }
  })

  it('resolves the /presets subpath export with working predicates', () => {
    const { byNames, byPrefix } = require('@hyperfrontend/builder/presets')
    expect(typeof byNames).toBe('function')
    expect(typeof byPrefix).toBe('function')
    const isNamed = byNames(['internal-utils'])
    expect(isNamed('internal-utils')).toBe(true)
    expect(isNamed('rollup')).toBe(false)
    const isScoped = byPrefix('@hyperfrontend/')
    expect(isScoped('@hyperfrontend/logging')).toBe(true)
    expect(isScoped('rollup')).toBe(false)
  })

  it('exposes a runnable hf-build bin (`--help` exits 0)', () => {
    const { execFileSync } = require('node:child_process')
    const { dirname, join } = require('node:path')
    const pkg = require('@hyperfrontend/builder/package.json')
    const binRelative = pkg.bin['hf-build']
    expect(typeof binRelative).toBe('string')
    const packageDir = dirname(require.resolve('@hyperfrontend/builder/package.json'))
    const binPath = join(packageDir, binRelative)
    // execFileSync throws on a non-zero exit code, so a clean return asserts exit 0.
    const output = execFileSync('node', [binPath, '--help'], { encoding: 'utf8' })
    expect(output).toContain('Usage: hf-build')
  })

  it('ships the bin with the `#!/usr/bin/env node` shebang', () => {
    const { readFileSync } = require('node:fs')
    const { dirname, join } = require('node:path')
    const pkg = require('@hyperfrontend/builder/package.json')
    const packageDir = dirname(require.resolve('@hyperfrontend/builder/package.json'))
    const binPath = join(packageDir, pkg.bin['hf-build'])
    const firstLine = readFileSync(binPath, 'utf8').split('\n', 1)[0]
    expect(firstLine).toBe('#!/usr/bin/env node')
  })

  it('ships the bin with the executable bit set after extraction', () => {
    const { statSync } = require('node:fs')
    const { dirname, join } = require('node:path')
    const pkg = require('@hyperfrontend/builder/package.json')
    const packageDir = dirname(require.resolve('@hyperfrontend/builder/package.json'))
    const binPath = join(packageDir, pkg.bin['hf-build'])
    // 0o111 = any execute bit (owner/group/other); npm preserves tar mode on install.
    expect(statSync(binPath).mode & 0o111).not.toBe(0)
  })

  it('includes the bin file in the published `files` allowlist', () => {
    const pkg = require('@hyperfrontend/builder/package.json')
    const binRelative = pkg.bin['hf-build'].replace(/^\.\//, '')
    expect(pkg.files).toContain(binRelative)
  })
})
