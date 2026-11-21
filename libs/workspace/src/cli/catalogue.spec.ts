import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { describe, expect, it } from '@hyperfrontend/testing'
import { COMMANDS, isOwnCommand, USAGE } from './catalogue'

describe('isOwnCommand', () => {
  it.each(['run', 'run-many', 'affected', 'format', 'generate', 'show', 'graph', 'hooks', 'push'])('owns %s', (word) => {
    expect(isOwnCommand(word)).toBe(true)
  })

  it.each(['pack', 'toString', ''])('does not own %j', (word) => {
    expect(isOwnCommand(word)).toBe(false)
  })
})

describe('COMMANDS', () => {
  it('leaves out run, which the dispatch answers itself', () => {
    expect(keys(COMMANDS)).not.toContain('run')
  })
})

describe('USAGE', () => {
  it('lists run and every command of the table', () => {
    expect(['run', ...keys(COMMANDS)].filter((command) => !USAGE.includes(`\n  ${command} `))).toEqual([])
  })
})
