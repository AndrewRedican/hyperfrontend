import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { quoteForCmd, shimCommand } from './shim'

describe('process/shim', () => {
  describe('quoteForCmd', () => {
    for (const argument of [
      'install',
      '--save-dev',
      '--loglevel=error',
      '@hyperfrontend/features@0.11.5',
      'C:\\packs\\lib.tgz',
      './dist/libs/x',
    ]) {
      it(`leaves ${argument} as written`, () => {
        assert.equal(quoteForCmd(argument), argument)
      })
    }

    it('quotes a path with a space and escapes the space and the quotes', () => {
      assert.equal(quoteForCmd('C:\\My Packages\\lib.tgz'), '^"C:\\My^ Packages\\lib.tgz^"')
    })

    it('escapes every character cmd.exe interprets', () => {
      assert.equal(quoteForCmd('a&b|c<d>e^f(g)h;i,j'), '^"a^&b^|c^<d^>e^^f^(g^)h^;i^,j^"')
    })

    it('doubles a trailing backslash so it does not escape the closing quote', () => {
      assert.equal(quoteForCmd('C:\\My Dir\\'), '^"C:\\My^ Dir\\\\^"')
    })

    it('quotes an empty argument so it survives as one', () => {
      assert.equal(quoteForCmd(''), '^"^"')
    })

    for (const argument of ['say "hi"', '%PATH%', 'wow!', 'one\ntwo', 'one\rtwo', 'nul\0byte']) {
      it(`refuses ${JSON.stringify(argument)}`, () => {
        assert.throws(() => quoteForCmd(argument), /Windows shim/)
      })
    }
  })

  describe('shimCommand', () => {
    it('starts the command directly with its arguments off Windows', () => {
      assert.deepEqual(shimCommand('npm', ['install', 'My Packages/lib.tgz'], 'linux'), {
        file: 'npm',
        args: ['install', 'My Packages/lib.tgz'],
        shell: false,
      })
    })

    it('joins one quoted command line with no argument array on Windows', () => {
      assert.deepEqual(shimCommand('npm', ['install', 'C:\\My Packages\\lib.tgz', '--save-exact'], 'win32'), {
        file: 'npm install ^"C:\\My^ Packages\\lib.tgz^" --save-exact',
        args: [],
        shell: true,
      })
    })

    it('refuses an unsafe argument on Windows', () => {
      assert.throws(() => shimCommand('npm', ['view', '%NAME%'], 'win32'), /Windows shim/)
    })

    it('passes the same argument through untouched off Windows', () => {
      assert.deepEqual(shimCommand('npm', ['view', '%NAME%'], 'darwin').args, ['view', '%NAME%'])
    })

    it('defaults to the running platform', () => {
      assert.equal(shimCommand('npm', ['pack']).shell, process.platform === 'win32')
    })
  })
})
