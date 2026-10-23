import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { WORKSPACE_FAMILIES } from './families.ts'

/**
 * The rule modules a family's directory holds, by name.
 *
 * @param family - The family's directory under src/rules
 * @returns The module names, sorted
 */
const onDisk = (family: string): string[] =>
  readdirSync(join(import.meta.dirname, '..', 'src', 'rules', family))
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
    .map((file) => file.slice(0, -3))
    .sort()

describe('WORKSPACE_FAMILIES', () => {
  it('registers every workspace rule module by its file name', () => {
    expect(Object.keys(WORKSPACE_FAMILIES['workspace'] ?? {}).sort()).toEqual(onDisk('workspace'))
  })

  it('registers every project rule module by its file name', () => {
    expect(Object.keys(WORKSPACE_FAMILIES['projects'] ?? {}).sort()).toEqual(onDisk('projects'))
  })

  it('loads a rule whose id is its family and file name', async () => {
    const load = WORKSPACE_FAMILIES['projects']?.['module-boundaries'] as () => Promise<{ default: { id: string } }>
    expect((await load()).default.id).toBe('projects/module-boundaries')
  })
})
