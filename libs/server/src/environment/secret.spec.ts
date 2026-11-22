import { format, inspect } from 'node:util'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createSecret } from './secret'

const TEXT = 'correct-horse-battery-staple'

describe('createSecret', () => {
  it('gives the text back through reveal', () => {
    expect(createSecret(TEXT).reveal()).toBe(TEXT)
  })

  it('prints the mask through String', () => {
    expect(String(createSecret(TEXT))).toBe('[secret]')
  })

  it('prints the mask in a template', () => {
    expect(`key=${createSecret(TEXT)}`).toBe('key=[secret]')
  })

  it('prints the mask in an error message', () => {
    expect(new Error(`refused ${createSecret(TEXT)}`).message).toBe('refused [secret]')
  })

  it('prints the mask through JSON.stringify', () => {
    expect(JSON.stringify({ key: createSecret(TEXT) })).toBe('{"key":"[secret]"}')
  })

  it('prints the mask through inspect', () => {
    expect(inspect(createSecret(TEXT))).toBe('[secret]')
  })

  it('prints the mask through inspect when nested', () => {
    expect(inspect({ key: createSecret(TEXT) })).toBe('{ key: [secret] }')
  })

  it('prints the mask through inspect when its hidden members are shown', () => {
    expect(inspect({ key: createSecret(TEXT) }, { showHidden: true, depth: null })).toBe('{ key: [secret] }')
  })

  it.each([['%s'], ['%o'], ['%O'], ['%j'], ['%d']])('keeps the text out of format under %s', (placeholder: string) => {
    expect(format(placeholder, createSecret(TEXT))).not.toContain(TEXT)
  })

  it('prints the mask through format', () => {
    expect(format('key=%s', createSecret(TEXT))).toBe('key=[secret]')
  })

  it('prints the mask through format without a placeholder', () => {
    expect(format('key', createSecret(TEXT))).toBe('key [secret]')
  })

  it('is frozen', () => {
    expect(Object.isFrozen(createSecret(TEXT))).toBe(true)
  })

  it('keeps the text out of its own enumerable members', () => {
    expect(Object.values(createSecret(TEXT)).filter((member) => typeof member !== 'function')).toEqual([])
  })

  it('is refused by structuredClone', () => {
    expect(() => structuredClone(createSecret(TEXT))).toThrow()
  })
})
