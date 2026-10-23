import type { RuleModule } from './rule'
import { readdirSync } from 'node:fs'
import { join, posix } from 'node:path'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { entries, keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { describe, expect, it } from '@hyperfrontend/testing'
import { PACKAGED_RULES } from '../rules/catalogue'
import { RULE_IDS } from '../rules/ids'
import { createRegistry } from './registry'
import { defineRule } from './rule'

const RULES = join(import.meta.dirname, '..', 'rules')

/** The families whose ids carry no prefix. */
const BARE = ['javascript', 'conventions']

/** Every rule module under `rules/`, as the id its directory gives it. */
const onDisk = readdirSync(RULES, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== 'shared')
  .flatMap((family) =>
    readdirSync(join(RULES, family.name))
      .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
      .map((file) => (BARE.includes(family.name) ? file.slice(0, -3) : posix.join(family.name, file.slice(0, -3))))
  )
  .sort()

const example = defineRule({ id: 'local/example', language: 'text', fixable: false, create: () => ({}) })

describe('PACKAGED_RULES', () => {
  it('lists every rule module under rules/ and nothing else', () => {
    expect(keys(PACKAGED_RULES).sort()).toEqual(onDisk)
  })

  it('lists the same ids, in order, as the id list directives are checked against', () => {
    expect(keys(PACKAGED_RULES)).toEqual(RULE_IDS)
  })

  it('names each module by the id the module declares', async () => {
    const mismatched: string[] = []
    for (const [id, load] of entries(PACKAGED_RULES)) {
      if ((await load()).default.id !== id) mismatched.push(id)
    }
    expect(mismatched).toEqual([])
  })
})

describe('createRegistry', () => {
  it('knows a packaged rule', () => {
    expect(createRegistry().has('no-var')).toBe(true)
  })

  it('knows a rule a family registers under its prefix', () => {
    expect(createRegistry({ local: { example } }).has('local/example')).toBe(true)
  })

  it('does not know an unregistered id', () => {
    expect(createRegistry().has('local/example')).toBe(false)
  })

  it('refuses a family under a packaged prefix', () => {
    expect(() => createRegistry({ typescript: { example } })).toThrow('The rule family typescript cannot be registered')
  })

  it('refuses a prefix that is not one lowercase segment', () => {
    expect(() => createRegistry({ 'My/Family': { example } })).toThrow('The rule family My/Family cannot be registered')
  })

  it('rejects an id that names no rule', async () => {
    await expect(createRegistry().load(['local/no-such-rule'])).rejects.toThrow('Definition for rule local/no-such-rule was not found')
  })

  it('answers nothing for no ids', async () => {
    expect((await createRegistry().load([])).size).toBe(0)
  })

  it('loads a packaged rule by its id', async () => {
    expect((await createRegistry().load(['no-var'])).get('no-var')?.id).toBe('no-var')
  })

  it('answers a registered rule module as given', async () => {
    expect((await createRegistry({ local: { example } }).load(['local/example'])).get('local/example')).toBe(example)
  })

  it('loads a rule from a function answering a module namespace', async () => {
    const registry = createRegistry({ local: { example: async () => ({ default: example }) } })
    expect((await registry.load(['local/example'])).get('local/example')).toBe(example)
  })

  it('loads a rule from a function answering the rule itself', async () => {
    const registry = createRegistry({ local: { example: async () => example } })
    expect((await registry.load(['local/example'])).get('local/example')).toBe(example)
  })

  it('names the rule when its module cannot be loaded', async () => {
    const registry = createRegistry({ local: { broken: async (): Promise<RuleModule> => Promise.reject(createError('missing file')) } })
    await expect(registry.load(['local/broken'])).rejects.toThrow('Rule local/broken could not be loaded: missing file')
  })

  it('answers a repeated id once', async () => {
    expect((await createRegistry().load(['no-var', 'no-var'])).size).toBe(1)
  })

  it('keeps a module loaded for a later call', async () => {
    const registry = createRegistry()
    const first = (await registry.load(['no-var'])).get('no-var')
    expect((await registry.load(['no-var'])).get('no-var')).toBe(first)
  })
})
