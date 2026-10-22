import { resolve } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { loadRules, rulePath } from './registry.ts'

const RULES = resolve(import.meta.dirname, '..', 'rules')

describe('rulePath', () => {
  it('places an unprefixed id in the javascript family', () => {
    expect(rulePath('no-var')).toBe(resolve(RULES, 'javascript', 'no-var.ts'))
  })

  it('places a prefixed id in its family', () => {
    expect(rulePath('workspace/no-enum')).toBe(resolve(RULES, 'workspace', 'no-enum.ts'))
  })
})

describe('loadRules', () => {
  it('rejects an id that names no module', async () => {
    await expect(loadRules(['workspace/no-such-rule'])).rejects.toThrow('Rule workspace/no-such-rule not found')
  })

  it('answers nothing for no ids', async () => {
    expect((await loadRules([])).size).toBe(0)
  })

  it('loads a rule module by its id', async () => {
    expect((await loadRules(['workspace/lib-pkg-no-main'])).get('workspace/lib-pkg-no-main')?.id).toBe('workspace/lib-pkg-no-main')
  })

  it('answers a repeated id once', async () => {
    expect((await loadRules(['workspace/lib-pkg-no-main', 'workspace/lib-pkg-no-main'])).size).toBe(1)
  })

  it('keeps a module loaded for a later call', async () => {
    const first = (await loadRules(['workspace/lib-pkg-no-main'])).get('workspace/lib-pkg-no-main')
    expect((await loadRules(['workspace/lib-pkg-no-main'])).get('workspace/lib-pkg-no-main')).toBe(first)
  })
})
