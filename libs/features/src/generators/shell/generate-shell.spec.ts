import type { FeatureContract, ResolvedFeatureConfig } from '../../shared/types'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createTree } from '@hyperfrontend/project-scope/vfs'
import { generateShell } from './generate-shell'

const config: ResolvedFeatureConfig = {
  name: 'clock',
  version: '1.0.0',
  contract: './clock.contract.json',
  url: '/clock',
  display: { dialogWidth: 530 },
  protocol: 'v2',
}
const contract: FeatureContract = {
  emitted: [
    {
      type: 'timeUpdated',
      description: 'Fires every second.',
      schema: { type: 'object', properties: { iso: { type: 'string' } }, required: ['iso'] },
    },
  ],
  accepted: [
    { type: 'setTimezone', schema: { type: 'object', properties: { tz: { type: 'string' } }, required: ['tz'] } },
    { type: 'reset' },
  ],
}

const stage = (over: Partial<ResolvedFeatureConfig> = {}): ReturnType<typeof createTree> => {
  const tree = createTree(__dirname)
  generateShell({ ...config, ...over }, contract, tree)
  return tree
}

describe('generateShell', () => {
  it('stages an entry that wraps createShell from the host SDK', () => {
    expect(stage().read('src/index.ts', 'utf-8')).toContain("import { createShell } from '@hyperfrontend/features/host'")
  })

  it('inlines the contract action types into the entry', () => {
    expect(stage().read('src/index.ts', 'utf-8')).toContain("type: 'timeUpdated'")
  })

  it('keeps the inlined contract feature-oriented with emitted actions first', () => {
    expect(stage().read('src/index.ts', 'utf-8')).toContain("emitted: [\n    {\n      type: 'timeUpdated'")
  })

  it('inlines the action schemas into the contract literal', () => {
    expect(stage().read('src/index.ts', 'utf-8')).toContain("required: [\n          'tz',\n        ]")
  })

  it('bakes the resolved display defaults into the entry', () => {
    expect(stage().read('src/index.ts', 'utf-8')).toContain('dialogWidth: 530')
  })

  it('bakes the declared permissions into the entry defaults', () => {
    expect(stage({ permissions: ['fullscreen', 'camera'] }).read('src/index.ts', 'utf-8')).toContain(
      "permissions: [\n    'fullscreen',\n    'camera',\n  ]"
    )
  })

  it('leaves permissions out of the defaults when the feature declares none', () => {
    expect(stage().read('src/index.ts', 'utf-8')).not.toContain('permissions: [')
  })

  it('discloses the baked permission grants in the readme', () => {
    expect(stage({ permissions: ['fullscreen'] }).read('README.md', 'utf-8')).toContain(
      'delegated to its frame automatically: `fullscreen`'
    )
  })

  it('omits the permissions paragraph from the readme when none are declared', () => {
    expect(stage().read('README.md', 'utf-8')).not.toContain('delegated to its frame automatically')
  })

  it('stamps the contract version into the inlined contract literal', () => {
    expect(stage().read('src/index.ts', 'utf-8')).toContain("version: '1.0.0'")
  })

  it('canonicalizes the stamped contract version from the config spelling', () => {
    expect(stage({ version: 'v1.2.0' }).read('src/index.ts', 'utf-8')).toContain("version: '1.2.0'")
  })

  it('bakes the resolved protocol into the connector defaults', () => {
    expect(stage().read('src/index.ts', 'utf-8')).toContain("protocol: 'v2'")
  })

  it('bakes only the url when no display defaults or protocol are configured', () => {
    expect(stage({ display: undefined, protocol: undefined }).read('src/index.ts', 'utf-8')).toContain(
      "const defaults = <const>{\n  url: '/clock',\n}"
    )
  })

  it('projects the accepted actions into a typed send payload map', () => {
    expect(stage().read('src/index.ts', 'utf-8')).toContain('setTimezone: {\n    tz: string\n  }')
  })

  it('projects a schema-less action to an unknown payload', () => {
    expect(stage().read('src/index.ts', 'utf-8')).toContain('reset: unknown')
  })

  it('exports the literal action-name unions from the entry', () => {
    expect(stage().read('src/index.ts', 'utf-8')).toContain('export type HostSendType = keyof HostSendPayloads')
  })

  it('returns the typed handle from createFeatureShell', () => {
    expect(stage().read('src/index.ts', 'utf-8')).toContain(
      'export function createFeatureShell(options: FeatureShellOptions): FeatureShellHandle {'
    )
  })

  it('names the connector package after the feature with module type', () => {
    expect(parse(stage().read('package.json', 'utf-8') ?? '')).toEqual(
      expect.objectContaining({ name: 'clock-shell', version: '1.0.0', type: 'module' })
    )
  })

  it('declares no dependencies in the connector package', () => {
    expect(parse(stage().read('package.json', 'utf-8') ?? '')).not.toHaveProperty('dependencies')
  })

  it('stages a README headed with the connector name', () => {
    expect(stage().read('README.md', 'utf-8')).toContain('# clock-shell')
  })

  it('stops instructing consumers to pass the protocol manually', () => {
    expect(stage().read('README.md', 'utf-8')).not.toContain("protocol: 'v2'")
  })

  it('keeps the host-supplied sharedKey instruction for a v2 build', () => {
    expect(stage().read('README.md', 'utf-8')).toContain("sharedKey: 'your-pre-shared-key'")
  })

  it('notes in the README that the v2 envelope is baked in', () => {
    expect(stage().read('README.md', 'utf-8')).toContain("The `v2` security envelope is baked in from the feature's build")
  })

  it('documents a v1 build without any sharedKey instruction', () => {
    expect(stage({ protocol: 'v1' }).read('README.md', 'utf-8')).not.toContain('sharedKey')
  })

  it('writes a labeled open-connector warning into the README for a protocol-none build', () => {
    expect(stage({ protocol: 'none' }).read('README.md', 'utf-8')).toContain('**Warning: open connector.**')
  })

  it('omits the open-connector warning for a secured build', () => {
    expect(stage().read('README.md', 'utf-8')).not.toContain('**Warning: open connector.**')
  })

  it('points a protocol-none README at rebuilding with a security protocol', () => {
    expect(stage({ protocol: 'none' }).read('README.md', 'utf-8')).toContain('deliberately built open')
  })

  it('instructs manual protocol selection when no protocol was resolved', () => {
    expect(stage({ protocol: undefined }).read('README.md', 'utf-8')).toContain('No security envelope is baked into this connector')
  })

  it('shows a typed send example drawn from the first accepted action', () => {
    expect(stage().read('README.md', 'utf-8')).toContain("shell.send('setTimezone', data)")
  })

  it('shows a typed event example drawn from the first emitted action', () => {
    expect(stage().read('README.md', 'utf-8')).toContain("shell.on('timeUpdated', (data) => console.log(data))")
  })

  it('omits the messaging examples when the contract has no actions', () => {
    const tree = createTree(__dirname)
    generateShell(config, { emitted: [], accepted: [] }, tree)
    expect(tree.read('README.md', 'utf-8')).not.toContain('shell.send(')
  })

  it('delegates metadata staging so the connector includes metadata.json', () => {
    expect(stage().exists('metadata.json')).toBe(true)
  })

  it('stamps the baked protocol into the delegated metadata', () => {
    expect(parse(stage().read('metadata.json', 'utf-8') ?? '')).toEqual(expect.objectContaining({ protocol: 'v2' }))
  })
})
