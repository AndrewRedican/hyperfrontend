import type { ExecFile } from './run-nx'
import { join } from 'node:path'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { HEADLESS_NX_ENV, nxExecutable, nxRunner, runNxJson } from './run-nx'

const checkout = useTempDir({ prefix: 'run-nx-' })

/**
 * Writes an Nx manifest into the checkout.
 *
 * @param manifest - The manifest, as Nx's package.json would carry it
 */
function installNx(manifest: object): void {
  checkout.write('node_modules/nx/package.json', manifest)
}

describe('nxExecutable', () => {
  it('reads the executable from the manifest', () => {
    installNx({ bin: { nx: 'bin/nx.js' } })
    expect(nxExecutable(checkout.path)).toBe(join(checkout.path, 'node_modules', 'nx', 'bin', 'nx.js'))
  })

  it('falls back to bin/nx.js when the manifest names no executable', () => {
    installNx({})
    expect(nxExecutable(checkout.path)).toBe(join(checkout.path, 'node_modules', 'nx', 'bin', 'nx.js'))
  })
})

describe('nxRunner', () => {
  it('runs the executable on the current Node with the arguments given', () => {
    installNx({ bin: { nx: 'bin/nx.js' } })
    const exec = jest.fn<Parameters<ExecFile>, string>(() => '[]')
    nxRunner(checkout.path, { exec })(['show', 'projects'])
    expect(exec.mock.calls[0]?.slice(0, 2)).toEqual([
      process.execPath,
      [join(checkout.path, 'node_modules', 'nx', 'bin', 'nx.js'), 'show', 'projects'],
    ])
  })

  it('runs headless in the checkout with the environment given on top', () => {
    installNx({ bin: { nx: 'bin/nx.js' } })
    const exec = jest.fn<Parameters<ExecFile>, string>(() => '')
    nxRunner(checkout.path, { exec, env: { NX_VERBOSE_LOGGING: 'true' }, maxBuffer: 1024 })(['graph'])
    expect(exec.mock.calls[0]?.[2]).toEqual({
      cwd: checkout.path,
      encoding: 'utf8',
      maxBuffer: 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: expect.objectContaining({ ...HEADLESS_NX_ENV, NX_VERBOSE_LOGGING: 'true' }),
    })
  })

  it('returns the command output', () => {
    installNx({ bin: { nx: 'bin/nx.js' } })
    expect(nxRunner(checkout.path, { exec: () => 'output' })(['graph'])).toBe('output')
  })

  it('defaults to a 64 MiB output limit', () => {
    installNx({ bin: { nx: 'bin/nx.js' } })
    const exec = jest.fn<Parameters<ExecFile>, string>(() => '')
    nxRunner(checkout.path, { exec })(['graph'])
    expect(exec.mock.calls[0]?.[2].maxBuffer).toBe(64 * 1024 * 1024)
  })
})

describe('nxRunner over a real process', () => {
  it('runs the installed executable and returns what it printed', () => {
    installNx({ bin: { nx: 'bin/nx.js' } })
    checkout.write(
      'node_modules/nx/bin/nx.js',
      'process.stdout.write(JSON.stringify({ args: process.argv.slice(2), daemon: process.env.NX_DAEMON }))'
    )
    expect(JSON.parse(nxRunner(checkout.path)(['show', 'projects']))).toEqual({ args: ['show', 'projects'], daemon: 'false' })
  })
})

describe('runNxJson', () => {
  it('parses what the command printed', () => {
    expect(runNxJson<string[]>(() => '["lib-a"]', ['show', 'projects', '--json'])).toEqual(['lib-a'])
  })

  it('throws when the command printed no JSON', () => {
    expect(() => runNxJson(() => 'NX   Daemon started', ['show', 'projects'])).toThrow(
      'nx show projects did not print JSON: NX   Daemon started'
    )
  })
})
