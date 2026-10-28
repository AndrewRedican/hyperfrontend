import type { FileRecord } from './files'
import type { GraphMeta } from './meta'
import type { PersistedState } from './state'
import { fromEntries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { describe, expect, it } from '@hyperfrontend/testing'
import { planUpdate } from './invalidate'
import { SCHEMA } from './meta'

const meta: GraphMeta = {
  schema: SCHEMA,
  algorithm: 'a',
  reader: 'r',
  node: '24',
  config: { 'nx.json': 'n', 'package.json': 'p', 'package-lock.json': 'l', 'tsconfig.base.json': 't' },
}

const files: FileRecord[] = [
  { path: 'README.md', hash: 'm1' },
  { path: 'libs/a/src/index.ts', hash: 'a1' },
  { path: 'libs/a/src/other.ts', hash: 'o1' },
]

/**
 * A persisted state over the given files, remembering imports for every code file.
 *
 * @param records - The files
 * @param stored - The meta the state carries
 * @returns The state
 */
function persisted(records: readonly FileRecord[], stored: GraphMeta = meta): PersistedState {
  const imports = fromEntries(
    records.filter((record) => record.path.endsWith('.ts')).map((record) => [record.path, { hash: record.hash, imports: [] }])
  )
  return {
    files: { files: records },
    imports: { files: imports },
    graph: { projects: [], nodes: [], records: [], edges: {} },
    entries: { entries: {} },
    meta: stored,
  }
}

/**
 * The plan without its reuse map, which is compared by its keys.
 *
 * @param previous - The persisted state, or null
 * @param records - The files now
 * @param now - The meta now
 * @returns The plan's fields and the reused paths
 */
function plan(previous: PersistedState | null, records: readonly FileRecord[], now: GraphMeta = meta): Record<string, unknown> {
  const { reuse, ...rest } = planUpdate(previous, now, records)
  return { ...rest, reuse: [...reuse.keys()] }
}

describe('planUpdate', () => {
  it('builds cold and parses every code file without a persisted state', () => {
    expect(plan(null, files)).toEqual({
      mode: 'cold',
      reasons: ['no persisted state'],
      added: [],
      changed: [],
      deleted: [],
      reparse: ['libs/a/src/index.ts', 'libs/a/src/other.ts'],
      reuse: [],
    })
  })

  it('loads warm when the meta and the files agree', () => {
    expect(plan(persisted(files), files)).toEqual({
      mode: 'warm',
      reasons: ['nothing changed'],
      added: [],
      changed: [],
      deleted: [],
      reparse: [],
      reuse: ['libs/a/src/index.ts', 'libs/a/src/other.ts'],
    })
  })

  it('reparses the changed and added code files and reuses the rest', () => {
    const now: FileRecord[] = [
      { path: 'README.md', hash: 'm2' },
      { path: 'libs/a/src/index.ts', hash: 'a2' },
      { path: 'libs/a/src/new.ts', hash: 'n1' },
      { path: 'libs/a/src/other.ts', hash: 'o1' },
    ]
    expect(plan(persisted(files), now)).toEqual({
      mode: 'incremental',
      reasons: ['1 added', '2 changed', '0 deleted'],
      added: ['libs/a/src/new.ts'],
      changed: ['README.md', 'libs/a/src/index.ts'],
      deleted: [],
      reparse: ['libs/a/src/index.ts', 'libs/a/src/new.ts'],
      reuse: ['libs/a/src/other.ts'],
    })
  })

  it('drops a deleted file and parses nothing for it', () => {
    expect(plan(persisted(files), files.slice(0, 2))).toEqual(
      expect.objectContaining({ mode: 'incremental', deleted: ['libs/a/src/other.ts'], reparse: [], reuse: ['libs/a/src/index.ts'] })
    )
  })

  it('builds cold without reusing imports when the reader changed', () => {
    expect(plan(persisted(files, { ...meta, reader: 'other' }), files)).toEqual(
      expect.objectContaining({ mode: 'cold', reasons: ['reader'], reparse: ['libs/a/src/index.ts', 'libs/a/src/other.ts'], reuse: [] })
    )
  })

  it('builds cold but reuses imports by hash when only a global configuration file changed', () => {
    expect(plan(persisted(files, { ...meta, config: { ...meta.config, 'nx.json': 'other' } }), files)).toEqual(
      expect.objectContaining({
        mode: 'cold',
        reasons: ['config:nx.json'],
        reparse: [],
        reuse: ['libs/a/src/index.ts', 'libs/a/src/other.ts'],
      })
    )
  })
})
