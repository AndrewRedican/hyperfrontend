import { describe, expect, it } from '@hyperfrontend/testing'
import { quoteForCmd, shimCommand } from './shim'

describe('core/process/shim', () => {
  describe('quoteForCmd', () => {
    it.each([
      'install',
      '--save-dev',
      '--loglevel=error',
      '@hyperfrontend/features@0.11.5',
      'C:\\packs\\lib.tgz',
      './dist/libs/x',
      'node@18.0.0',
    ])('leaves %s as written', (argument) => {
      expect(quoteForCmd(argument)).toBe(argument)
    })

    it('quotes a path with a space and escapes the space and the quotes', () => {
      expect(quoteForCmd('C:\\My Packages\\lib.tgz')).toBe('^"C:\\My^ Packages\\lib.tgz^"')
    })

    it('escapes every character cmd.exe interprets', () => {
      expect(quoteForCmd('a&b|c<d>e^f(g)h;i,j')).toBe('^"a^&b^|c^<d^>e^^f^(g^)h^;i^,j^"')
    })

    it('doubles a trailing backslash so it does not escape the closing quote', () => {
      expect(quoteForCmd('C:\\My Dir\\')).toBe('^"C:\\My^ Dir\\\\^"')
    })

    it('quotes an empty argument so it survives as one', () => {
      expect(quoteForCmd('')).toBe('^"^"')
    })

    it.each(['say "hi"', '%PATH%', 'wow!', 'one\ntwo', 'one\rtwo', 'nul\0byte'])('refuses %j', (argument) => {
      expect(() => quoteForCmd(argument)).toThrow('Windows shim')
    })
  })

  describe('shimCommand', () => {
    it('starts the command directly with its arguments off Windows', () => {
      expect(shimCommand('npm', ['install', 'My Packages/lib.tgz'], 'linux')).toEqual({
        file: 'npm',
        args: ['install', 'My Packages/lib.tgz'],
        shell: false,
      })
    })

    it('joins one quoted command line with no argument array on Windows', () => {
      expect(shimCommand('npm', ['install', 'C:\\My Packages\\lib.tgz', '--save-exact'], 'win32')).toEqual({
        file: 'npm install ^"C:\\My^ Packages\\lib.tgz^" --save-exact',
        args: [],
        shell: true,
      })
    })

    it('refuses an unsafe argument on Windows', () => {
      expect(() => shimCommand('npm', ['view', '%NAME%'], 'win32')).toThrow('Windows shim')
    })

    it('passes the same argument through untouched off Windows', () => {
      expect(shimCommand('npm', ['view', '%NAME%'], 'darwin').args).toEqual(['view', '%NAME%'])
    })

    it('defaults to the running platform', () => {
      expect(shimCommand('npm', ['pack']).shell).toBe(process.platform === 'win32')
    })
  })
})
