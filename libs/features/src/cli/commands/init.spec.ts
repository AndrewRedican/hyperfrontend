import type { CommitResult, Tree } from '@hyperfrontend/project-scope/vfs'
import type { FeatureContract } from '../../shared/types'
import type { CliFlags } from '../args'
import type { RunInitOptions } from './init'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runInit } from './init'

const CONTRACT: FeatureContract = { emitted: [{ type: 'tick' }], accepted: [{ type: 'setTz' }] }

const mkFlags = (over: Partial<CliFlags>): CliFlags => ({ ci: false, yes: false, dryRun: false, help: false, ...over })

const fakeTree = (initial: Record<string, string> = {}): { tree: Tree; files: Record<string, string> } => {
  const files: Record<string, string> = { ...initial }
  const tree = <Tree>(<unknown>{
    root: '/project',
    read: (path: string): string | null => (path in files ? <string>files[path] : null),
    write: (path: string, content: string): void => {
      files[path] = content
    },
  })
  return { tree, files }
}

const sink = (): { stream: NodeJS.WritableStream; text: () => string } => {
  const chunks: string[] = []
  const stream = <NodeJS.WritableStream>(<unknown>{
    write: (chunk: string): boolean => {
      chunks.push(chunk)
      return true
    },
  })
  return { stream, text: () => chunks.join('') }
}

const commitResult = (dryRun: boolean): CommitResult => <CommitResult>{ created: 2, updated: 1, deleted: 0, changes: [], dryRun }

const baseDeps = (over: Partial<RunInitOptions>): RunInitOptions => {
  const stdout = sink()
  const stderr = sink()
  return {
    flags: mkFlags({}),
    cwd: '/project',
    stdout: stdout.stream,
    stderr: stderr.stream,
    loadContract: () => Promise.resolve(CONTRACT),
    commit: (_tree, opts) => commitResult(opts?.dryRun ?? false),
    ...over,
  }
}

describe('runInit', () => {
  it('scaffolds successfully in headless mode', async () => {
    const { tree } = fakeTree({ 'src/main.ts': 'const x = 1\n' })
    const code = await runInit(
      baseDeps({ flags: mkFlags({ name: 'clock', contract: './c.json', entry: 'src/main.ts', ci: true }), createTreeFn: () => tree })
    )
    expect(code).toBe(0)
  })

  it('writes the glue module for the feature', async () => {
    const { tree, files } = fakeTree({ 'src/main.ts': 'const x = 1\n' })
    await runInit(
      baseDeps({ flags: mkFlags({ name: 'clock', contract: './c.json', entry: 'src/main.ts', yes: true }), createTreeFn: () => tree })
    )
    expect(files['src/hyperfrontend.feature.ts']).toEqual(expect.stringContaining('clock'))
  })

  it('writes the feature config', async () => {
    const { tree, files } = fakeTree({ 'src/main.ts': 'const x = 1\n' })
    await runInit(
      baseDeps({ flags: mkFlags({ name: 'clock', contract: './c.json', entry: 'src/main.ts', ci: true }), createTreeFn: () => tree })
    )
    expect(files['feature.config.json']).toEqual(expect.stringContaining('"name": "clock"'))
  })

  it('wires the marker-guarded import into the entry file', async () => {
    const { tree, files } = fakeTree({ 'src/main.ts': 'const x = 1\n' })
    await runInit(
      baseDeps({ flags: mkFlags({ name: 'clock', contract: './c.json', entry: 'src/main.ts', ci: true }), createTreeFn: () => tree })
    )
    expect(files['src/main.ts']).toEqual(expect.stringContaining('<hf:feature>'))
  })

  it('accepts an absolute entry path', async () => {
    const { tree } = fakeTree({ 'src/main.ts': 'const x = 1\n' })
    const code = await runInit(
      baseDeps({
        flags: mkFlags({ name: 'clock', contract: './c.json', entry: '/project/src/main.ts', ci: true }),
        createTreeFn: () => tree,
      })
    )
    expect(code).toBe(0)
  })

  it('does not duplicate an existing marker block', async () => {
    const existing = '// <hf:feature>\nimport "./x"\n// </hf:feature>\nconst x = 1\n'
    const { tree, files } = fakeTree({ 'src/main.ts': existing })
    await runInit(
      baseDeps({ flags: mkFlags({ name: 'clock', contract: './c.json', entry: 'src/main.ts', ci: true }), createTreeFn: () => tree })
    )
    expect(files['src/main.ts']).toBe(existing)
  })

  it('honors --dry-run in the summary', async () => {
    const out = sink()
    const { tree } = fakeTree({ 'src/main.ts': 'const x = 1\n' })
    await runInit(
      baseDeps({
        flags: mkFlags({ name: 'clock', contract: './c.json', entry: 'src/main.ts', ci: true, dryRun: true }),
        createTreeFn: () => tree,
        stdout: out.stream,
      })
    )
    expect(out.text()).toEqual(expect.stringContaining('Would scaffold'))
  })

  it('errors when a required value is missing in headless mode', async () => {
    const err = sink()
    const code = await runInit(baseDeps({ flags: mkFlags({ ci: true }), stderr: err.stream }))
    expect(code).toBe(1)
  })

  it('names the missing flag in the headless error', async () => {
    const err = sink()
    await runInit(baseDeps({ flags: mkFlags({ ci: true }), stderr: err.stream }))
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
    const { tree, files } = fakeTree({ 'src/app/main.ts': 'const x = 1\n' })
    await runInit(
      baseDeps({ flags: mkFlags({ name: 'clock', contract: './c.json', entry: 'src/app/main.ts', ci: true }), createTreeFn: () => tree })
    )
    expect(files['src/app/main.ts']).toEqual(expect.stringContaining("import '../hyperfrontend.feature'"))
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
    const err = sink()
    const { tree } = fakeTree({})
    const code = await runInit(
      baseDeps({
        flags: mkFlags({ name: 'clock', contract: './c.json', entry: 'src/missing.ts', ci: true }),
        createTreeFn: () => tree,
        stderr: err.stream,
      })
    )
    expect(code).toBe(1)
  })

  it('reports the missing entry file', async () => {
    const err = sink()
    const { tree } = fakeTree({})
    await runInit(
      baseDeps({
        flags: mkFlags({ name: 'clock', contract: './c.json', entry: 'src/missing.ts', ci: true }),
        createTreeFn: () => tree,
        stderr: err.stream,
      })
    )
    expect(err.text()).toEqual(expect.stringContaining('Entry file not found'))
  })

  it('surfaces a non-Error thrown during loading', async () => {
    const err = sink()
    const code = await runInit(
      baseDeps({
        flags: mkFlags({ name: 'clock', contract: './c.json', entry: 'src/main.ts', ci: true }),
        loadContract: () => Promise.reject('boom'),
        stderr: err.stream,
      })
    )
    expect(code).toBe(1)
  })

  describe('with real fixtures', () => {
    let dir: string

    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'hf-init-'))
      writeFileSync(join(dir, 'c.json'), '{ "emitted": [], "accepted": [] }')
    })

    afterEach(() => {
      rmSync(dir, { recursive: true, force: true })
    })

    it('loads the contract through the default tiered loader', async () => {
      const { tree } = fakeTree({ 'src/main.ts': 'const x = 1\n' })
      const code = await runInit(
        baseDeps({
          cwd: dir,
          flags: mkFlags({ name: 'clock', contract: './c.json', entry: 'src/main.ts', ci: true }),
          createTreeFn: () => tree,
          loadContract: undefined,
        })
      )
      expect(code).toBe(0)
    })

    it('scaffolds end-to-end against the real filesystem', async () => {
      mkdirSync(join(dir, 'src'))
      writeFileSync(join(dir, 'src', 'main.ts'), 'const x = 1\n')
      const code = await runInit({
        flags: mkFlags({ name: 'clock', contract: './c.json', entry: 'src/main.ts', ci: true, cwd: '.' }),
        cwd: dir,
        stdout: sink().stream,
        stderr: sink().stream,
      })
      expect(code).toBe(0)
    })

    it('discovers entry candidates through the default heuristics', async () => {
      mkdirSync(join(dir, 'src'))
      writeFileSync(join(dir, 'package.json'), '{ "name": "demo" }')
      writeFileSync(join(dir, 'src', 'index.ts'), 'export const x = 1\n')
      const { tree } = fakeTree({ 'src/index.ts': 'export const x = 1\n' })
      const code = await runInit(
        baseDeps({
          cwd: dir,
          flags: mkFlags({ name: 'clock', contract: './c.json' }),
          createTreeFn: () => tree,
          promptEntry: () => Promise.resolve('src/index.ts'),
        })
      )
      expect(code).toBe(0)
    })
  })
})
