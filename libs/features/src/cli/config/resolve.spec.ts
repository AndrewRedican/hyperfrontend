import type { CliFlags } from '../args'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { resolveBuildConfig } from './resolve'

const baseFlags: CliFlags = { ci: false, yes: false, dryRun: false, help: false }

describe('resolveBuildConfig', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'hf-resolve-'))
    writeFileSync(join(dir, 'clock.contract.json'), '{ "emitted": [], "accepted": [] }')
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  const writeConfig = (body: string): void => writeFileSync(join(dir, 'feature.config.json'), body)

  it('resolves a discovered JSON config with its contract', async () => {
    writeConfig('{ "name": "clock", "version": "1.0.0", "contract": "./clock.contract.json" }')
    await expect(resolveBuildConfig({ cwd: dir, flags: baseFlags })).resolves.toEqual(
      expect.objectContaining({
        config: expect.objectContaining({ name: 'clock', version: '1.0.0', url: '/' }),
        protocol: 'none',
        sourcePath: join(dir, 'feature.config.json'),
      })
    )
  })

  it('marks a defaulted protocol as not explicit', async () => {
    writeConfig('{ "name": "clock", "version": "1.0.0", "contract": "./clock.contract.json" }')
    await expect(resolveBuildConfig({ cwd: dir, flags: baseFlags })).resolves.toEqual(expect.objectContaining({ protocolExplicit: false }))
  })

  it('threads the resolved protocol into the config for the generators', async () => {
    writeConfig('{ "name": "clock", "version": "1.0.0", "contract": "./clock.contract.json", "protocol": "v2" }')
    await expect(resolveBuildConfig({ cwd: dir, flags: baseFlags })).resolves.toEqual(
      expect.objectContaining({ config: expect.objectContaining({ protocol: 'v2' }) })
    )
  })

  it('lets flags replace config keys', async () => {
    writeConfig('{ "name": "a", "version": "1.0.0", "contract": "./clock.contract.json" }')
    const flags: CliFlags = { ...baseFlags, name: 'b', url: '/x', protocol: 'v2' }
    await expect(resolveBuildConfig({ cwd: dir, flags })).resolves.toEqual(
      expect.objectContaining({ config: expect.objectContaining({ name: 'b', url: '/x' }), protocol: 'v2' })
    )
  })

  it('marks a flag-supplied protocol as explicit', async () => {
    writeConfig('{ "name": "a", "version": "1.0.0", "contract": "./clock.contract.json" }')
    await expect(resolveBuildConfig({ cwd: dir, flags: { ...baseFlags, protocol: 'none' } })).resolves.toEqual(
      expect.objectContaining({ protocol: 'none', protocolExplicit: true })
    )
  })

  it('honors an explicit absolute --config path', async () => {
    writeFileSync(join(dir, 'custom.config.json'), '{ "name": "c", "version": "1.0.0", "contract": "./clock.contract.json" }')
    const flags: CliFlags = { ...baseFlags, config: join(dir, 'custom.config.json') }
    await expect(resolveBuildConfig({ cwd: dir, flags })).resolves.toEqual(
      expect.objectContaining({ config: expect.objectContaining({ name: 'c' }) })
    )
  })

  it('omits sourcePath when only flags supply the config', async () => {
    const flags: CliFlags = { ...baseFlags, name: 'd', version: '1.0.0', contract: './clock.contract.json', protocol: 'v1' }
    await expect(resolveBuildConfig({ cwd: dir, flags })).resolves.toEqual(expect.not.objectContaining({ sourcePath: expect.anything() }))
  })

  it('reads protocol and display from the config file', async () => {
    writeConfig(
      '{ "name": "clock", "version": "1.0.0", "contract": "./clock.contract.json", "protocol": "v1", "display": { "modes": ["dialog"], "dialog": { "width": 480 } }, "url": "/u" }'
    )
    await expect(resolveBuildConfig({ cwd: dir, flags: baseFlags })).resolves.toEqual(
      expect.objectContaining({
        protocol: 'v1',
        protocolExplicit: true,
        config: expect.objectContaining({ url: '/u', display: { modes: ['dialog'], dialog: { width: 480 } } }),
      })
    )
  })

  it('omits display from the resolved config when the config declares none', async () => {
    writeConfig('{ "name": "clock", "version": "1.0.0", "contract": "./clock.contract.json" }')
    await expect(resolveBuildConfig({ cwd: dir, flags: baseFlags })).resolves.toEqual(
      expect.objectContaining({ config: expect.not.objectContaining({ display: expect.anything() }) })
    )
  })

  it('rejects a display that fails validation', async () => {
    writeConfig('{ "name": "clock", "version": "1.0.0", "contract": "./clock.contract.json", "display": { "modes": ["modal"] } }')
    await expect(resolveBuildConfig({ cwd: dir, flags: baseFlags })).rejects.toThrow('Invalid config')
  })

  it('resolves a display carrying a valid dialog position', async () => {
    writeConfig(
      '{ "name": "clock", "version": "1.0.0", "contract": "./clock.contract.json", "display": { "modes": ["dialog"], "dialog": { "position": "bottom-right" } } }'
    )
    await expect(resolveBuildConfig({ cwd: dir, flags: baseFlags })).resolves.toEqual(
      expect.objectContaining({
        config: expect.objectContaining({ display: { modes: ['dialog'], dialog: { position: 'bottom-right' } } }),
      })
    )
  })

  it('rejects a display carrying an invalid position', async () => {
    writeConfig(
      '{ "name": "clock", "version": "1.0.0", "contract": "./clock.contract.json", "display": { "modes": ["dialog"], "dialog": { "position": "middle" } } }'
    )
    await expect(resolveBuildConfig({ cwd: dir, flags: baseFlags })).rejects.toThrow('Invalid config')
  })

  it('names the unknown mode when the display declares one', async () => {
    writeConfig('{ "name": "clock", "version": "1.0.0", "contract": "./clock.contract.json", "display": { "modes": ["modal"] } }')
    await expect(resolveBuildConfig({ cwd: dir, flags: baseFlags })).rejects.toThrow('"display.modes" contains unknown modes: "modal"')
  })

  it('rejects an invalid protocol value', async () => {
    writeConfig('{ "name": "clock", "version": "1.0.0", "contract": "./clock.contract.json", "protocol": "v9" }')
    await expect(resolveBuildConfig({ cwd: dir, flags: baseFlags })).rejects.toThrow('Invalid protocol')
  })

  it('rejects a non-string protocol value', async () => {
    writeConfig('{ "name": "clock", "version": "1.0.0", "contract": "./clock.contract.json", "protocol": 5 }')
    await expect(resolveBuildConfig({ cwd: dir, flags: baseFlags })).rejects.toThrow('Invalid protocol')
  })

  it('retains a contract version matching the config version', async () => {
    writeFileSync(join(dir, 'clock.contract.json'), '{ "emitted": [], "accepted": [], "version": "1.0.0" }')
    writeConfig('{ "name": "clock", "version": "1.0.0", "contract": "./clock.contract.json" }')
    await expect(resolveBuildConfig({ cwd: dir, flags: baseFlags })).resolves.toEqual(
      expect.objectContaining({ contract: expect.objectContaining({ version: '1.0.0' }) })
    )
  })

  it('accepts a contract version that canonicalizes to the config version', async () => {
    writeFileSync(join(dir, 'clock.contract.json'), '{ "emitted": [], "accepted": [], "version": "v1.0.0" }')
    writeConfig('{ "name": "clock", "version": "1.0.0", "contract": "./clock.contract.json" }')
    await expect(resolveBuildConfig({ cwd: dir, flags: baseFlags })).resolves.toEqual(
      expect.objectContaining({ contract: expect.objectContaining({ version: 'v1.0.0' }) })
    )
  })

  it('fails the build naming both values when the contract version differs from the config version', async () => {
    writeFileSync(join(dir, 'clock.contract.json'), '{ "emitted": [], "accepted": [], "version": "2.0.0" }')
    writeConfig('{ "name": "clock", "version": "1.0.0", "contract": "./clock.contract.json" }')
    await expect(resolveBuildConfig({ cwd: dir, flags: baseFlags })).rejects.toThrow(
      'Contract version "2.0.0" does not match the feature version "1.0.0".'
    )
  })

  it('names the config "version" field when it is invalid semver and the contract announces a version', async () => {
    writeFileSync(join(dir, 'clock.contract.json'), '{ "emitted": [], "accepted": [], "version": "1.0.0" }')
    writeConfig('{ "name": "clock", "version": "1.0", "contract": "./clock.contract.json" }')
    await expect(resolveBuildConfig({ cwd: dir, flags: baseFlags })).rejects.toThrow(
      'Invalid config: "version" must be a valid semver version (e.g. "1.2.0"), but got "1.0".'
    )
  })

  it('reads the declared permissions from the config file', async () => {
    writeConfig('{ "name": "clock", "version": "1.0.0", "contract": "./clock.contract.json", "permissions": ["fullscreen", "camera"] }')
    await expect(resolveBuildConfig({ cwd: dir, flags: baseFlags })).resolves.toEqual(
      expect.objectContaining({ config: expect.objectContaining({ permissions: ['fullscreen', 'camera'] }) })
    )
  })

  it('omits permissions from the resolved config when the config declares none', async () => {
    writeConfig('{ "name": "clock", "version": "1.0.0", "contract": "./clock.contract.json" }')
    await expect(resolveBuildConfig({ cwd: dir, flags: baseFlags })).resolves.toEqual(
      expect.objectContaining({ config: expect.not.objectContaining({ permissions: expect.anything() }) })
    )
  })

  it('rejects a permissions value that is not an array', async () => {
    writeConfig('{ "name": "clock", "version": "1.0.0", "contract": "./clock.contract.json", "permissions": "fullscreen" }')
    await expect(resolveBuildConfig({ cwd: dir, flags: baseFlags })).rejects.toThrow(
      '"permissions" must be an array of Permissions-Policy feature names'
    )
  })

  it('rejects a permissions entry that is not a non-empty string', async () => {
    writeConfig('{ "name": "clock", "version": "1.0.0", "contract": "./clock.contract.json", "permissions": ["fullscreen", ""] }')
    await expect(resolveBuildConfig({ cwd: dir, flags: baseFlags })).rejects.toThrow(
      '"permissions" must be an array of Permissions-Policy feature names'
    )
  })

  it('rejects a config that does not resolve to an object', async () => {
    writeConfig('[]')
    await expect(resolveBuildConfig({ cwd: dir, flags: baseFlags })).rejects.toThrow('must resolve to an object')
  })

  it('rejects a config missing required keys', async () => {
    writeConfig('{}')
    await expect(resolveBuildConfig({ cwd: dir, flags: baseFlags })).rejects.toThrow('Invalid config')
  })
})
