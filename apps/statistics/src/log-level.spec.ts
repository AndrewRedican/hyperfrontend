import { describe, expect, it } from '@hyperfrontend/testing'
import { asLogLevel } from './log-level'

describe('asLogLevel', () => {
  it.each(['none', 'error', 'warn', 'log', 'info', 'debug'])('reads the level %s', (level) => {
    expect(asLogLevel().read(level)).toBe(level)
  })

  it('refuses a word that is no level', () => {
    expect(asLogLevel().read('verbose')).toBeUndefined()
  })

  it('says what it expects and that it holds no secret', () => {
    expect({ expected: asLogLevel().expected, secret: asLogLevel().secret }).toEqual({
      expected: 'one of none, error, warn, log, info and debug',
      secret: false,
    })
  })
})
