import type { GraphMeta } from './meta'
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { keys, values } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createGraphWorkspace } from '../__test-utils__/workspace'
import { readStateFile } from './read'
import { buildState, readState, STATE_FILES, stateDirectory, stateStatus, verifyState } from './state'
import { envelopeText } from './write'

const root = createGraphWorkspace()

/**
 * The modification times of the five state files.
 *
 * @returns Each file name to its mtime
 */
function mtimes(): Record<string, number> {
  const times: Record<string, number> = {}
  for (const name of values(STATE_FILES)) times[name] = statSync(join(stateDirectory(root), name)).mtimeMs
  return times
}

describe('buildState', () => {
  it('builds cold and writes the five files when nothing is persisted', () => {
    const { outcome } = buildState(root)
    expect({ mode: outcome.plan.mode, written: outcome.written }).toEqual({ mode: 'cold', written: values(STATE_FILES) })
  })

  it('builds warm and writes nothing when nothing changed', () => {
    const before = mtimes()
    const { outcome } = buildState(root)
    expect({ mode: outcome.plan.mode, written: outcome.written, same: mtimes() }).toEqual({ mode: 'warm', written: [], same: before })
  })

  it('verifies against a cold build after a warm one', () => {
    expect(verifyState(root)).toEqual({ ok: true, differences: [] })
  })

  it('reparses only an edited code file and leaves the meta alone', () => {
    writeFileSync(join(root, 'libs/b/src/index.ts'), "import 'left-pad'\nexport const b = 2\n")
    const { outcome } = buildState(root)
    expect({ mode: outcome.plan.mode, reparse: outcome.plan.reparse, written: outcome.written }).toEqual({
      mode: 'incremental',
      reparse: ['libs/b/src/index.ts'],
      written: ['files.json', 'imports.json', 'graph.json', 'entries.json'],
    })
  })

  it('records an added file', () => {
    writeFileSync(join(root, 'libs/b/src/added.ts'), 'export const added = 1\n')
    expect(buildState(root).outcome.plan.added).toEqual(['libs/b/src/added.ts'])
  })

  it('drops a deleted file from the imports it remembers', () => {
    rmSync(join(root, 'libs/b/src/added.ts'))
    const { outcome, state } = buildState(root)
    expect({ deleted: outcome.plan.deleted, remembered: 'libs/b/src/added.ts' in state.imports.files }).toEqual({
      deleted: ['libs/b/src/added.ts'],
      remembered: false,
    })
  })

  it('records a rename as a deletion and an addition', () => {
    writeFileSync(join(root, 'libs/d/src/renamed.ts'), readFileSync(join(root, 'libs/d/src/index.ts')))
    rmSync(join(root, 'libs/d/src/index.ts'))
    const { plan } = buildState(root).outcome
    expect({ added: plan.added, deleted: plan.deleted }).toEqual({ added: ['libs/d/src/renamed.ts'], deleted: ['libs/d/src/index.ts'] })
  })

  it('rebuilds cold but reuses the imports when nx.json changes', () => {
    writeFileSync(join(root, 'nx.json'), `${readFileSync(join(root, 'nx.json'), 'utf8')}\n`)
    const { plan } = buildState(root).outcome
    expect({ mode: plan.mode, reasons: plan.reasons, reparse: plan.reparse }).toEqual({
      mode: 'cold',
      reasons: ['config:nx.json'],
      reparse: [],
    })
  })

  it('rebuilds cold and reparses everything when the persisted reader differs', () => {
    const path = join(stateDirectory(root), STATE_FILES.meta)
    const meta = readStateFile<GraphMeta>(path) as GraphMeta
    writeFileSync(path, envelopeText({ ...meta, reader: 'other' }))
    const { plan } = buildState(root).outcome
    expect({ mode: plan.mode, reasons: plan.reasons, reparsed: plan.reparse.length > 0 }).toEqual({
      mode: 'cold',
      reasons: ['reader'],
      reparsed: true,
    })
  })

  it('discards a corrupted state and builds cold', () => {
    writeFileSync(join(stateDirectory(root), STATE_FILES.graph), '{"body":')
    expect(buildState(root).outcome.plan.reasons).toEqual(['no persisted state'])
  })

  it('builds cold on request', () => {
    expect(buildState(root, { force: true }).outcome.plan.mode).toBe('cold')
  })
})

describe('verifyState', () => {
  it('names the files a cold build no longer agrees with', () => {
    writeFileSync(join(root, 'libs/b/src/index.ts'), 'export const b = 4\n')
    expect(verifyState(root)).toEqual({ ok: false, differences: ['files.json', 'imports.json', 'graph.json', 'entries.json'] })
  })

  it('reports a missing state', () => {
    rmSync(stateDirectory(root), { recursive: true, force: true })
    expect(verifyState(root)).toEqual({ ok: false, differences: ['no persisted state'] })
  })
})

describe('stateStatus', () => {
  it('reports no state and a cold plan when nothing is persisted', () => {
    expect(stateStatus(root)).toEqual(
      expect.objectContaining({ present: false, meta: null, digests: null, plan: expect.objectContaining({ mode: 'cold' }) })
    )
  })

  it('reports the persisted meta, the digests and a warm plan after a build', () => {
    const { state } = buildState(root)
    const status = stateStatus(root)
    expect({ present: status.present, meta: status.meta, names: keys(status.digests ?? {}), mode: status.plan.mode }).toEqual({
      present: true,
      meta: state.meta,
      names: values(STATE_FILES),
      mode: 'warm',
    })
  })
})

describe('readState', () => {
  it('answers nothing when one file is invalid', () => {
    writeFileSync(join(stateDirectory(root), STATE_FILES.entries), 'broken')
    expect(readState(root)).toBeNull()
  })
})

describe('two checkouts of the same tree', () => {
  it('write byte-identical state files', () => {
    const [first, second] = [createGraphWorkspace(), createGraphWorkspace()]
    buildState(first)
    buildState(second)
    const texts = (at: string): string[] => values(STATE_FILES).map((name) => readFileSync(join(stateDirectory(at), name), 'utf8'))
    try {
      expect(texts(second)).toEqual(texts(first))
    } finally {
      rmSync(first, { recursive: true, force: true })
      rmSync(second, { recursive: true, force: true })
    }
  })
})

describe('the disposable workspace', () => {
  it('is removed at the end', () => {
    rmSync(root, { recursive: true, force: true })
    expect(existsSync(root)).toBe(false)
  })
})
