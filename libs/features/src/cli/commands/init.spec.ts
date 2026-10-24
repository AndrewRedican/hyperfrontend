import type { CommitResult } from '@hyperfrontend/project-scope/vfs'
import type { FeatureContract } from '../../shared/types'
import type { CliFlags } from '../args'
import type { RunInitOptions } from './init'
import { appendFileSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { beforeEach } from 'node:test'
import { createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { createCapturedOutput } from '@hyperfrontend/testing/process'
import { runInit } from './init'

const CONTRACT: FeatureContract = { emitted: [{ type: 'tick' }], accepted: [{ type: 'setTz' }] }

const mkFlags = (over: Partial<CliFlags>): CliFlags => ({ ci: false, yes: false, dryRun: false, help: false, ...over })

const commitResult = (dryRun: boolean): CommitResult => ({ created: 2, updated: 1, deleted: 0, changes: [], dryRun }) as CommitResult

const baseDeps = (over: Partial<RunInitOptions>): RunInitOptions => {
  const stdout = createCapturedOutput()
  const stderr = createCapturedOutput()
  return {
    flags: mkFlags({}),
    cwd: '/workspace',
    stdout,
    stderr,
    loadContract: () => Promise.resolve(CONTRACT),
    commit: (_tree, opts) => commitResult(opts?.dryRun ?? false),
    ...over,
  }
}

describe('runInit', () => {
  it('scaffolds successfully in headless mode', async () => {
    const tree = createMemoryTree({ 'src/main.ts': 'const x = 1\n' })
    const code = await runInit(
      baseDeps({ flags: mkFlags({ name: 'clock', contract: './c.json', entry: 'src/main.ts', ci: true }), createTreeFn: () => tree })
    )
    expect(code).toBe(0)
  })

  it('writes the glue module for the feature', async () => {
    const tree = createMemoryTree({ 'src/main.ts': 'const x = 1\n' })
    await runInit(
      baseDeps({ flags: mkFlags({ name: 'clock', contract: './c.json', entry: 'src/main.ts', yes: true }), createTreeFn: () => tree })
    )
    expect(tree.read('src/hyperfrontend.feature.ts', 'utf-8')).toEqual(expect.stringContaining('clock'))
  })

  it('writes the feature config', async () => {
    const tree = createMemoryTree({ 'src/main.ts': 'const x = 1\n' })
    await runInit(
      baseDeps({ flags: mkFlags({ name: 'clock', contract: './c.json', entry: 'src/main.ts', ci: true }), createTreeFn: () => tree })
    )
    expect(tree.read('feature.config.json', 'utf-8')).toEqual(expect.stringContaining('"name": "clock"'))
  })

  it('wires the marker-guarded import into the entry file', async () => {
    const tree = createMemoryTree({ 'src/main.ts': 'const x = 1\n' })
    await runInit(
      baseDeps({ flags: mkFlags({ name: 'clock', contract: './c.json', entry: 'src/main.ts', ci: true }), createTreeFn: () => tree })
    )
    expect(tree.read('src/main.ts', 'utf-8')).toEqual(expect.stringContaining('<hf:feature>'))
  })

  it('accepts an absolute entry path', async () => {
    const tree = createMemoryTree({ 'src/main.ts': 'const x = 1\n' })
    const code = await runInit(
      baseDeps({
        flags: mkFlags({ name: 'clock', contract: './c.json', entry: '/workspace/src/main.ts', ci: true }),
        createTreeFn: () => tree,
      })
    )
    expect(code).toBe(0)
  })

  it('does not duplicate an existing canonical marker block', async () => {
    const existing = "// <hf:feature>\nimport './hyperfrontend.feature'\n// </hf:feature>\nconst x = 1\n"
    const tree = createMemoryTree({ 'src/main.ts': existing })
    await runInit(
      baseDeps({ flags: mkFlags({ name: 'clock', contract: './c.json', entry: 'src/main.ts', ci: true }), createTreeFn: () => tree })
    )
    expect(tree.read('src/main.ts', 'utf-8')).toBe(existing)
  })

  it('regenerates a stale import between existing markers', async () => {
    const existing = "// <hf:feature>\nimport './stale-glue'\n// </hf:feature>\nconst x = 1\n"
    const tree = createMemoryTree({ 'src/main.ts': existing })
    await runInit(
      baseDeps({ flags: mkFlags({ name: 'clock', contract: './c.json', entry: 'src/main.ts', ci: true }), createTreeFn: () => tree })
    )
    expect(tree.read('src/main.ts', 'utf-8')).toBe("// <hf:feature>\nimport './hyperfrontend.feature'\n// </hf:feature>\nconst x = 1\n")
  })

  it('names the entry file in the corrupted-marker error', async () => {
    const err = createCapturedOutput()
    const tree = createMemoryTree({ 'src/main.ts': '// <hf:feature>\nconst x = 1\n' })
    await runInit(
      baseDeps({
        flags: mkFlags({ name: 'clock', contract: './c.json', entry: 'src/main.ts', ci: true }),
        createTreeFn: () => tree,
        stderr: err,
      })
    )
    expect(err.text()).toEqual(expect.stringContaining("src/main.ts: found a '// <hf:feature>' begin marker without a matching"))
  })

  it('exits non-zero on a corrupted entry marker', async () => {
    const tree = createMemoryTree({ 'src/main.ts': '// <hf:feature>\nconst x = 1\n' })
    const code = await runInit(
      baseDeps({ flags: mkFlags({ name: 'clock', contract: './c.json', entry: 'src/main.ts', ci: true }), createTreeFn: () => tree })
    )
    expect(code).toBe(1)
  })

  it('honors --dry-run in the summary', async () => {
    const out = createCapturedOutput()
    const tree = createMemoryTree({ 'src/main.ts': 'const x = 1\n' })
    await runInit(
      baseDeps({
        flags: mkFlags({ name: 'clock', contract: './c.json', entry: 'src/main.ts', ci: true, dryRun: true }),
        createTreeFn: () => tree,
        stdout: out,
      })
    )
    expect(out.text()).toEqual(expect.stringContaining('Would scaffold'))
  })

  it('errors when a required value is missing in headless mode', async () => {
    const err = createCapturedOutput()
    const code = await runInit(baseDeps({ flags: mkFlags({ ci: true }), stderr: err }))
    expect(code).toBe(1)
  })

  it('names the missing flag in the headless error', async () => {
    const err = createCapturedOutput()
    await runInit(baseDeps({ flags: mkFlags({ ci: true }), stderr: err }))
    expect(err.text()).toEqual(expect.stringContaining('--name'))
  })

  it('errors when the contract is missing in headless mode', async () => {
    const code = await runInit(baseDeps({ flags: mkFlags({ name: 'clock', ci: true }) }))
    expect(code).toBe(1)
  })

  it('errors when the entry is missing in headless mode', async () => {
    const code = await runInit(baseDeps({ flags: mkFlags({ name: 'clock', contract: './c.json', ci: true }) }))
    expect(code).toBe(1)
  })

  it('wires a relative glue import for an entry in a subdirectory', async () => {
    const tree = createMemoryTree({ 'src/app/main.ts': 'const x = 1\n' })
    await runInit(
      baseDeps({ flags: mkFlags({ name: 'clock', contract: './c.json', entry: 'src/app/main.ts', ci: true }), createTreeFn: () => tree })
    )
    expect(tree.read('src/app/main.ts', 'utf-8')).toEqual(expect.stringContaining("import '../hyperfrontend.feature'"))
  })

  it('cancels gracefully when an interactive prompt is aborted', async () => {
    const code = await runInit(baseDeps({ promptName: () => Promise.resolve(null) }))
    expect(code).toBe(130)
  })

  it('cancels when the contract prompt is aborted', async () => {
    const code = await runInit(baseDeps({ flags: mkFlags({ name: 'clock' }), promptContract: () => Promise.resolve(null) }))
    expect(code).toBe(130)
  })

  it('cancels when the entry prompt is aborted', async () => {
    const code = await runInit(
      baseDeps({
        flags: mkFlags({ name: 'clock', contract: './c.json' }),
        discoverEntries: () => [],
        promptEntry: () => Promise.resolve(null),
      })
    )
    expect(code).toBe(130)
  })

  it('errors when the entry file does not exist', async () => {
    const err = createCapturedOutput()
    const tree = createMemoryTree({})
    const code = await runInit(
      baseDeps({
        flags: mkFlags({ name: 'clock', contract: './c.json', entry: 'src/missing.ts', ci: true }),
        createTreeFn: () => tree,
        stderr: err,
      })
    )
    expect(code).toBe(1)
  })

  it('reports the missing entry file', async () => {
    const err = createCapturedOutput()
    const tree = createMemoryTree({})
    await runInit(
      baseDeps({
        flags: mkFlags({ name: 'clock', contract: './c.json', entry: 'src/missing.ts', ci: true }),
        createTreeFn: () => tree,
        stderr: err,
      })
    )
    expect(err.text()).toEqual(expect.stringContaining('Entry file not found'))
  })

  it('surfaces a non-Error thrown during loading', async () => {
    const err = createCapturedOutput()
    const code = await runInit(
      baseDeps({
        flags: mkFlags({ name: 'clock', contract: './c.json', entry: 'src/main.ts', ci: true }),
        loadContract: () => Promise.reject('boom'),
        stderr: err,
      })
    )
    expect(code).toBe(1)
  })

  describe('contract declaration bridge', () => {
    it('stages a .d.ts beside a JSON contract', async () => {
      const tree = createMemoryTree({ 'src/main.ts': 'const x = 1\n' })
      await runInit(
        baseDeps({ flags: mkFlags({ name: 'clock', contract: 'c.json', entry: 'src/main.ts', ci: true }), createTreeFn: () => tree })
      )
      expect(tree.read('c.d.ts', 'utf-8')).toEqual(expect.stringContaining('declare const contract'))
    })

    it('emits a glue import the declaration bridge resolves', async () => {
      const tree = createMemoryTree({ 'src/main.ts': 'const x = 1\n' })
      await runInit(
        baseDeps({ flags: mkFlags({ name: 'clock', contract: 'c.json', entry: 'src/main.ts', ci: true }), createTreeFn: () => tree })
      )
      expect(tree.read('src/hyperfrontend.feature.ts', 'utf-8')).toEqual(expect.stringContaining("import contract from '../c'"))
    })

    it('stages no .d.ts for a TypeScript contract', async () => {
      const tree = createMemoryTree({ 'src/main.ts': 'const x = 1\n' })
      await runInit(
        baseDeps({ flags: mkFlags({ name: 'clock', contract: 'c.contract.ts', entry: 'src/main.ts', ci: true }), createTreeFn: () => tree })
      )
      expect(tree.exists('c.contract.d.ts')).toBe(false)
    })
  })

  describe('config merge', () => {
    const staleConfig = '{"$schema":"s","name":"old","version":"2.0.0","contract":"c.json","protocol":"v4"}\n'

    it('overwrites a stale name from the flags', async () => {
      const tree = createMemoryTree({ 'src/main.ts': 'const x = 1\n', 'feature.config.json': staleConfig })
      await runInit(
        baseDeps({ flags: mkFlags({ name: 'clock', contract: 'c.json', entry: 'src/main.ts', ci: true }), createTreeFn: () => tree })
      )
      expect(tree.read('feature.config.json', 'utf-8')).toEqual(expect.stringContaining('"name": "clock"'))
    })

    it('inherits the recorded version when no flag is given', async () => {
      const tree = createMemoryTree({ 'src/main.ts': 'const x = 1\n', 'feature.config.json': staleConfig })
      await runInit(
        baseDeps({ flags: mkFlags({ name: 'clock', contract: 'c.json', entry: 'src/main.ts', ci: true }), createTreeFn: () => tree })
      )
      expect(tree.read('feature.config.json', 'utf-8')).toEqual(expect.stringContaining('"version": "2.0.0"'))
    })

    it('lets a version flag override the recorded version', async () => {
      const tree = createMemoryTree({ 'src/main.ts': 'const x = 1\n', 'feature.config.json': staleConfig })
      await runInit(
        baseDeps({
          flags: mkFlags({ name: 'clock', contract: 'c.json', entry: 'src/main.ts', version: '3.0.0', ci: true }),
          createTreeFn: () => tree,
        })
      )
      expect(tree.read('feature.config.json', 'utf-8')).toEqual(expect.stringContaining('"version": "3.0.0"'))
    })

    it('preserves unmanaged keys verbatim', async () => {
      const tree = createMemoryTree({ 'src/main.ts': 'const x = 1\n', 'feature.config.json': staleConfig })
      await runInit(
        baseDeps({ flags: mkFlags({ name: 'clock', contract: 'c.json', entry: 'src/main.ts', ci: true }), createTreeFn: () => tree })
      )
      expect(tree.read('feature.config.json', 'utf-8')).toEqual(expect.stringContaining('"protocol": "v4"'))
    })

    it('persists a url flag into the config', async () => {
      const tree = createMemoryTree({ 'src/main.ts': 'const x = 1\n' })
      await runInit(
        baseDeps({
          flags: mkFlags({ name: 'clock', contract: 'c.json', entry: 'src/main.ts', url: '/clock', ci: true }),
          createTreeFn: () => tree,
        })
      )
      expect(tree.read('feature.config.json', 'utf-8')).toEqual(expect.stringContaining('"url": "/clock"'))
    })

    it('defaults the persisted url to the root path', async () => {
      const tree = createMemoryTree({ 'src/main.ts': 'const x = 1\n' })
      await runInit(
        baseDeps({ flags: mkFlags({ name: 'clock', contract: 'c.json', entry: 'src/main.ts', ci: true }), createTreeFn: () => tree })
      )
      expect(tree.read('feature.config.json', 'utf-8')).toEqual(expect.stringContaining('"url": "/"'))
    })

    it('rejects an existing config that is not valid JSON', async () => {
      const err = createCapturedOutput()
      const tree = createMemoryTree({ 'src/main.ts': 'const x = 1\n', 'feature.config.json': '{ nope' })
      const code = await runInit(
        baseDeps({
          flags: mkFlags({ name: 'clock', contract: 'c.json', entry: 'src/main.ts', ci: true }),
          createTreeFn: () => tree,
          stderr: err,
        })
      )
      expect([code, err.text()]).toEqual([1, expect.stringContaining('feature.config.json exists but is not valid JSON')])
    })

    it('rejects an existing config holding a JSON string', async () => {
      const err = createCapturedOutput()
      const tree = createMemoryTree({ 'src/main.ts': 'const x = 1\n', 'feature.config.json': '"clock"' })
      const code = await runInit(
        baseDeps({
          flags: mkFlags({ name: 'clock', contract: 'c.json', entry: 'src/main.ts', ci: true }),
          createTreeFn: () => tree,
          stderr: err,
        })
      )
      expect([code, err.text()]).toEqual([1, expect.stringContaining('feature.config.json exists but is not a JSON object')])
    })

    it('rejects an existing config holding JSON null', async () => {
      const tree = createMemoryTree({ 'src/main.ts': 'const x = 1\n', 'feature.config.json': 'null' })
      const code = await runInit(
        baseDeps({ flags: mkFlags({ name: 'clock', contract: 'c.json', entry: 'src/main.ts', ci: true }), createTreeFn: () => tree })
      )
      expect(code).toBe(1)
    })

    it('rejects an existing config holding a JSON array', async () => {
      const tree = createMemoryTree({ 'src/main.ts': 'const x = 1\n', 'feature.config.json': '[]' })
      const code = await runInit(
        baseDeps({ flags: mkFlags({ name: 'clock', contract: 'c.json', entry: 'src/main.ts', ci: true }), createTreeFn: () => tree })
      )
      expect(code).toBe(1)
    })

    it('keeps an existing glue when the config lacks a recorded name', async () => {
      const partial = '{"version":"2.0.0","contract":"c.json"}\n'
      const tree = createMemoryTree({
        'src/main.ts': 'const x = 1\n',
        'src/hyperfrontend.feature.ts': 'edited glue',
        'feature.config.json': partial,
      })
      await runInit(
        baseDeps({ flags: mkFlags({ name: 'clock', contract: 'c.json', entry: 'src/main.ts', ci: true }), createTreeFn: () => tree })
      )
      expect(tree.read('src/hyperfrontend.feature.ts', 'utf-8')).toBe('edited glue')
    })

    it('keeps an existing glue when the recorded version is not a string', async () => {
      const partial = '{"name":"old","version":2,"contract":"c.json"}\n'
      const tree = createMemoryTree({
        'src/main.ts': 'const x = 1\n',
        'src/hyperfrontend.feature.ts': 'edited glue',
        'feature.config.json': partial,
      })
      await runInit(
        baseDeps({ flags: mkFlags({ name: 'clock', contract: 'c.json', entry: 'src/main.ts', ci: true }), createTreeFn: () => tree })
      )
      expect(tree.read('src/hyperfrontend.feature.ts', 'utf-8')).toBe('edited glue')
    })

    it('keeps an existing glue when the config lacks a recorded contract', async () => {
      const partial = '{"name":"old","version":"2.0.0"}\n'
      const tree = createMemoryTree({
        'src/main.ts': 'const x = 1\n',
        'src/hyperfrontend.feature.ts': 'edited glue',
        'feature.config.json': partial,
      })
      await runInit(
        baseDeps({ flags: mkFlags({ name: 'clock', contract: 'c.json', entry: 'src/main.ts', ci: true }), createTreeFn: () => tree })
      )
      expect(tree.read('src/hyperfrontend.feature.ts', 'utf-8')).toBe('edited glue')
    })
  })

  describe('with real fixtures', () => {
    const tmp = useTempDir({ prefix: 'hf-init-' })

    beforeEach(() => {
      tmp.write('c.json', '{ "emitted": [], "accepted": [] }')
    })

    it('loads the contract through the default tiered loader', async () => {
      const tree = createMemoryTree({ 'src/main.ts': 'const x = 1\n' })
      const code = await runInit(
        baseDeps({
          cwd: tmp.path,
          flags: mkFlags({ name: 'clock', contract: './c.json', entry: 'src/main.ts', ci: true }),
          createTreeFn: () => tree,
          loadContract: undefined,
        })
      )
      expect(code).toBe(0)
    })

    it('scaffolds end-to-end against the real filesystem', async () => {
      tmp.write('src/main.ts', 'const x = 1\n')
      const code = await runInit({
        flags: mkFlags({ name: 'clock', contract: './c.json', entry: 'src/main.ts', ci: true, cwd: '.' }),
        cwd: tmp.path,
        stdout: createCapturedOutput(),
        stderr: createCapturedOutput(),
      })
      expect(code).toBe(0)
    })

    it('discovers entry candidates through the default heuristics', async () => {
      tmp.write('package.json', '{ "name": "demo" }')
      tmp.write('src/index.ts', 'export const x = 1\n')
      const tree = createMemoryTree({ 'src/index.ts': 'export const x = 1\n' })
      const code = await runInit(
        baseDeps({
          cwd: tmp.path,
          flags: mkFlags({ name: 'clock', contract: './c.json' }),
          createTreeFn: () => tree,
          promptEntry: () => Promise.resolve('src/index.ts'),
        })
      )
      expect(code).toBe(0)
    })
  })

  describe('idempotent re-runs against the real filesystem', () => {
    const tmp = useTempDir({ prefix: 'hf-init-rerun-' })

    const runReal = async (over: Partial<CliFlags> = {}): Promise<{ code: number; out: string; err: string }> => {
      const out = createCapturedOutput()
      const err = createCapturedOutput()
      const code = await runInit({
        flags: mkFlags({ name: 'clock', contract: './c.json', entry: 'src/main.ts', ci: true, ...over }),
        cwd: tmp.path,
        stdout: out,
        stderr: err,
      })
      return { code, out: out.text(), err: err.text() }
    }

    beforeEach(() => {
      tmp.write('c.json', '{ "emitted": [{ "type": "tick" }], "accepted": [{ "type": "setTz" }] }')
      tmp.write('src/main.ts', 'const x = 1\n')
    })

    it('summarizes a fresh scaffold with truthful counts', async () => {
      const { out } = await runReal()
      expect(out).toEqual(expect.stringContaining('Scaffolded feature "clock" (created 3, updated 1, kept 0)'))
    })

    it('treats a same-flags re-run as a full no-op', async () => {
      await runReal()
      const { out } = await runReal()
      expect(out).toEqual(expect.stringContaining('Feature "clock" is up to date (created 0, updated 0, kept 4)'))
    })

    it('previews a no-op re-run truthfully under --dry-run', async () => {
      await runReal()
      const { out } = await runReal({ dryRun: true })
      expect(out).toEqual(expect.stringContaining('Feature "clock" is up to date (created 0, updated 0, kept 4) [dry run]'))
    })

    it('inherits the recorded version across re-runs', async () => {
      await runReal({ version: '1.2.3' })
      await runReal()
      expect(tmp.read('feature.config.json')).toEqual(expect.stringContaining('"version": "1.2.3"'))
    })

    it('updates the config on a re-run with a different name', async () => {
      await runReal()
      await runReal({ name: 'metronome' })
      expect(tmp.read('feature.config.json')).toEqual(expect.stringContaining('"name": "metronome"'))
    })

    it('regenerates a pristine glue on a re-run with a different name', async () => {
      await runReal()
      await runReal({ name: 'metronome' })
      expect(tmp.read('src/hyperfrontend.feature.ts')).toEqual(expect.stringContaining("name: 'metronome'"))
    })

    it('counts the different-name regeneration truthfully', async () => {
      await runReal()
      const { out } = await runReal({ name: 'metronome' })
      expect(out).toEqual(expect.stringContaining('Scaffolded feature "metronome" (created 0, updated 3, kept 1)'))
    })

    it('keeps an author-edited glue on a different-name re-run', async () => {
      await runReal()
      appendFileSync(tmp.resolve('src', 'hyperfrontend.feature.ts'), 'const mine = 1\n')
      await runReal({ name: 'metronome' })
      expect(tmp.read('src/hyperfrontend.feature.ts')).toEqual(expect.stringContaining('const mine = 1'))
    })

    it('recreates only a deleted config', async () => {
      await runReal()
      unlinkSync(tmp.resolve('feature.config.json'))
      const { out } = await runReal()
      expect(out).toEqual(expect.stringContaining('Scaffolded feature "clock" (created 1, updated 0, kept 3)'))
    })

    it('restores the config content after deletion', async () => {
      await runReal()
      unlinkSync(tmp.resolve('feature.config.json'))
      await runReal()
      expect(tmp.read('feature.config.json')).toEqual(expect.stringContaining('"name": "clock"'))
    })

    it('regenerates only a deleted glue', async () => {
      await runReal()
      unlinkSync(tmp.resolve('src', 'hyperfrontend.feature.ts'))
      const { out } = await runReal()
      expect(out).toEqual(expect.stringContaining('Scaffolded feature "clock" (created 1, updated 0, kept 3)'))
    })

    it('rewires only an unwired entry', async () => {
      await runReal()
      tmp.write('src/main.ts', 'const x = 1\n')
      const { out } = await runReal()
      expect(out).toEqual(expect.stringContaining('Scaffolded feature "clock" (created 0, updated 1, kept 3)'))
    })

    it('emits the declaration bridge beside the JSON contract', async () => {
      await runReal()
      expect(tmp.read('c.d.ts')).toEqual(expect.stringContaining('declare const contract'))
    })

    it('regenerates only a deleted declaration bridge', async () => {
      await runReal()
      unlinkSync(tmp.resolve('c.d.ts'))
      const { out } = await runReal()
      expect(out).toEqual(expect.stringContaining('Scaffolded feature "clock" (created 1, updated 0, kept 3)'))
    })

    it('repairs an entry that lost its end marker beside the managed import', async () => {
      await runReal()
      const entryPath = tmp.resolve('src', 'main.ts')
      writeFileSync(entryPath, readFileSync(entryPath, 'utf-8').replace('// </hf:feature>\n', ''))
      await runReal()
      expect(readFileSync(entryPath, 'utf-8')).toEqual(expect.stringContaining('// </hf:feature>'))
    })

    it('commits nothing when the entry marker is corrupted', async () => {
      tmp.write('src/main.ts', '// <hf:feature>\nconst x = 1\n')
      await runReal()
      expect(tmp.exists('feature.config.json')).toBe(false)
    })
  })
})
