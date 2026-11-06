import { describe, expect, it } from '@hyperfrontend/testing'
import { selfCommand } from './self'

describe('selfCommand', () => {
  it('starts the same entry on the same Node.js with the same flags', () => {
    expect(
      selfCommand(
        {
          execPath: '/usr/bin/node',
          execArgv: ['--import', './hook.ts'],
          argv: ['/usr/bin/node', '/work/bin/hf.mjs', 'run-many', '-t', 'build'],
        },
        ['run', 'lib-a:build', '--verbose']
      )
    ).toEqual(['/usr/bin/node', '--import', './hook.ts', '/work/bin/hf.mjs', 'run', 'lib-a:build', '--verbose'])
  })
})
