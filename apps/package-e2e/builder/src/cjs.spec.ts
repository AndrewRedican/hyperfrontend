/**
 * CJS (CommonJS) E2E tests for @hyperfrontend/builder
 * Tests that the package is requireable, its subpaths resolve, and the bin is wired.
 */

describe('@hyperfrontend/builder CJS', () => {
  it('should be requireable', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require('@hyperfrontend/builder')
    expect(pkg).toBeDefined()
  })

  it('should expose the documented public API', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
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

  it('should resolve the /presets subpath export with working predicates', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
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

  it('should expose a runnable hf-build bin (`--help` exits 0)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { execFileSync } = require('node:child_process')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { dirname, join } = require('node:path')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require('@hyperfrontend/builder/package.json')
    const binRelative = pkg.bin['hf-build']
    expect(typeof binRelative).toBe('string')
    const packageDir = dirname(require.resolve('@hyperfrontend/builder/package.json'))
    const binPath = join(packageDir, binRelative)
    // execFileSync throws on a non-zero exit code, so a clean return asserts exit 0.
    const output = execFileSync('node', [binPath, '--help'], { encoding: 'utf8' })
    expect(output).toContain('Usage: hf-build')
  })

  it('should ship the bin with the `#!/usr/bin/env node` shebang', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readFileSync } = require('node:fs')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { dirname, join } = require('node:path')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require('@hyperfrontend/builder/package.json')
    const packageDir = dirname(require.resolve('@hyperfrontend/builder/package.json'))
    const binPath = join(packageDir, pkg.bin['hf-build'])
    const firstLine = readFileSync(binPath, 'utf8').split('\n', 1)[0]
    expect(firstLine).toBe('#!/usr/bin/env node')
  })

  it('should ship the bin with the executable bit set after extraction', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { statSync } = require('node:fs')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { dirname, join } = require('node:path')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require('@hyperfrontend/builder/package.json')
    const packageDir = dirname(require.resolve('@hyperfrontend/builder/package.json'))
    const binPath = join(packageDir, pkg.bin['hf-build'])
    // 0o111 = any execute bit (owner/group/other); npm preserves tar mode on install.
    expect(statSync(binPath).mode & 0o111).not.toBe(0)
  })

  it('should include the bin file in the published `files` allowlist', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require('@hyperfrontend/builder/package.json')
    const binRelative = pkg.bin['hf-build'].replace(/^\.\//, '')
    expect(pkg.files).toContain(binRelative)
  })
})
