import { describe, expect, it } from '@hyperfrontend/testing'
import { launchOf } from './program'

/** A process started from an entry module with a flag of its own. */
const STARTED = { execPath: '/usr/bin/node', execArgv: ['--enable-source-maps'], argv: ['/usr/bin/node', '/repo/bin/hf.mjs', 'hooks'] }

describe('launchOf', () => {
  it('starts node as the running Node.js', () => {
    expect(launchOf(['node', 'script.mjs', '--staged'], STARTED, 'linux')).toEqual({
      file: '/usr/bin/node',
      args: ['script.mjs', '--staged'],
      shell: false,
    })
  })

  it('starts hf as the command line that is running, the way it was started', () => {
    expect(launchOf(['hf', 'format', '--write'], STARTED, 'win32')).toEqual({
      file: '/usr/bin/node',
      args: ['--enable-source-maps', '/repo/bin/hf.mjs', 'format', '--write'],
      shell: false,
    })
  })

  it('starts any other program by name where a shim is a file to execute', () => {
    expect(launchOf(['cl', '.git/COMMIT_EDITMSG'], STARTED, 'linux')).toEqual({ file: 'cl', args: ['.git/COMMIT_EDITMSG'], shell: false })
  })

  it('starts any other program through the shell on Windows, where a shim is a batch file', () => {
    expect(launchOf(['cl', '.git/COMMIT_EDITMSG'], STARTED, 'win32')).toEqual({ file: 'cl .git/COMMIT_EDITMSG', args: [], shell: true })
  })
})
