import type { FeatureContract, ResolvedFeatureConfig } from '../../shared/types'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createTree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { generateShell } from './generate-shell'

const config: ResolvedFeatureConfig = {
  name: 'clock',
  version: '1.0.0',
  contract: './clock.contract.json',
  url: '/clock',
  display: { dialog: { width: 530 } },
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
  const tree = createTree(import.meta.dirname)
  generateShell({ ...config, ...over }, contract, tree)
  return tree
}

describe('generateShell', () => {
  it('stages an entry that composes the shell from the host SDK', () => {
    expect(stage().read('src/index.ts', 'utf-8')).toContain(
      "import { createShell, mountDialog, mountEmbedded, mountPopup, mountStandalone } from '@hyperfrontend/features/host'"
    )
  })

  it('imports only the declared mode mounts', () => {
    const entry = stage({ display: { modes: ['embedded'] } }).read('src/index.ts', 'utf-8')
    expect(entry).toContain("import { createShell, mountEmbedded } from '@hyperfrontend/features/host'")
    expect(entry).not.toContain('mountDialog')
    expect(entry).not.toContain('mountPopup')
    expect(entry).not.toContain('mountStandalone')
  })

  it('composes exactly the declared modes in declaration order', () => {
    expect(stage({ display: { modes: ['embedded'] } }).read('src/index.ts', 'utf-8')).toContain('const modes = { embedded: mountEmbedded }')
  })

  it('composes all four modes when the config declares no display', () => {
    expect(stage({ display: undefined, protocol: undefined }).read('src/index.ts', 'utf-8')).toContain(
      'const modes = { embedded: mountEmbedded, dialog: mountDialog, popup: mountPopup, standalone: mountStandalone }'
    )
  })

  it('returns the created shell passing the modes inside the options', () => {
    expect(stage().read('src/index.ts', 'utf-8')).toContain(
      'return <FeatureShellHandle>createShell({ ...defaults, ...rest, onUnresponsive: <UnresponsivePolicy | undefined>onUnresponsive, contract, modes })'
    )
  })

  it('widens the unresponsive policy where it crosses into the SDK', () => {
    const entry = stage({ display: { modes: ['embedded'] } }).read('src/index.ts', 'utf-8')
    expect(entry).toContain('const { onUnresponsive, ...rest } = options')
    expect(entry).toContain('onUnresponsive: <UnresponsivePolicy | undefined>onUnresponsive')
  })

  it('imports the widened policy as a type-only import so the emitted runtime stays unchanged', () => {
    expect(stage({ display: { modes: ['embedded'] } }).read('src/index.ts', 'utf-8')).toContain(
      "import type { UnresponsivePolicy } from '@hyperfrontend/features/host'"
    )
  })

  it('keeps the unresponsive info narrowed to the declared modes', () => {
    const entry = stage({ display: { modes: ['embedded'] } }).read('src/index.ts', 'utf-8')
    expect(entry).toContain("export type FeatureDisplayMode = 'embedded'")
    expect(entry).toContain('displayMode: FeatureDisplayMode')
  })

  it('narrows the generated display-mode union to the declared modes', () => {
    expect(stage({ display: { modes: ['dialog', 'popup'] } }).read('src/index.ts', 'utf-8')).toContain(
      "export type FeatureDisplayMode = 'dialog' | 'popup'"
    )
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

  it('bakes the first declared mode as the default displayMode', () => {
    expect(stage({ display: { modes: ['dialog', 'embedded'] } }).read('src/index.ts', 'utf-8')).toContain("displayMode: 'dialog'")
  })

  it('flattens the fixed embedded size into the embed defaults', () => {
    const entry = stage({ display: { modes: ['embedded'], embedded: { width: 320, height: 240 } } }).read('src/index.ts', 'utf-8')
    expect(entry).toContain('embedWidth: 320')
    expect(entry).toContain('embedHeight: 240')
  })

  it('bakes the dialog box and escape defaults', () => {
    const entry = stage({
      display: { modes: ['dialog'], dialog: { width: 480, height: 360, backdrop: 'none' }, closeOnEscape: false },
    }).read('src/index.ts', 'utf-8')
    expect(entry).toContain('dialogWidth: 480')
    expect(entry).toContain('dialogHeight: 360')
    expect(entry).toContain("dialogBackdrop: 'none'")
    expect(entry).toContain('closeOnEscape: false')
  })

  it('bakes the popup window defaults', () => {
    const entry = stage({ display: { modes: ['popup'], popup: { width: 500, height: 400 } } }).read('src/index.ts', 'utf-8')
    expect(entry).toContain('popupWidth: 500')
    expect(entry).toContain('popupHeight: 400')
  })

  it('bakes the configured dialog position into the defaults', () => {
    expect(stage({ display: { modes: ['dialog'], dialog: { position: 'top-right' } } }).read('src/index.ts', 'utf-8')).toContain(
      "dialogPosition: 'top-right'"
    )
  })

  it('bakes the configured popup position into the defaults', () => {
    expect(stage({ display: { modes: ['popup'], popup: { position: 'bottom-center' } } }).read('src/index.ts', 'utf-8')).toContain(
      "popupPosition: 'bottom-center'"
    )
  })

  it('leaves the position defaults out when the config declares none', () => {
    const entry = stage({ display: { modes: ['dialog', 'popup'], dialog: { width: 480 }, popup: { width: 500 } } }).read(
      'src/index.ts',
      'utf-8'
    )
    expect(entry).not.toContain('dialogPosition:')
    expect(entry).not.toContain('popupPosition:')
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

  it('bakes the resolved protocol into the shell defaults', () => {
    expect(stage().read('src/index.ts', 'utf-8')).toContain("protocol: 'v2'")
  })

  it('bakes only the url and default display mode when nothing else is configured', () => {
    expect(stage({ display: undefined, protocol: undefined }).read('src/index.ts', 'utf-8')).toContain(
      "const defaults = <const>{\n  url: '/clock',\n  displayMode: 'embedded',\n}"
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

  it('names the shell package after the feature with module type', () => {
    expect(parse(stage().read('package.json', 'utf-8') ?? '')).toEqual(
      expect.objectContaining({ name: 'clock-shell', version: '1.0.0', type: 'module' })
    )
  })

  it('declares no dependencies in the shell package', () => {
    expect(parse(stage().read('package.json', 'utf-8') ?? '')).not.toHaveProperty('dependencies')
  })

  it('stages a README headed with the shell name', () => {
    expect(stage().read('README.md', 'utf-8')).toContain('# clock-shell')
  })

  it('documents the declared display modes in the README', () => {
    const readme = stage({ display: { modes: ['dialog', 'popup'] } }).read('README.md', 'utf-8')
    expect(readme).toContain('## Display modes')
    expect(readme).toContain('This feature supports `dialog`, `popup`; `open()` defaults to `dialog`.')
  })

  it('lists all four modes in the README when the config declares no display', () => {
    expect(stage({ display: undefined }).read('README.md', 'utf-8')).toContain(
      'This feature supports `embedded`, `dialog`, `popup`, `standalone`; `open()` defaults to `embedded`.'
    )
  })

  it('shows an explicit displayMode example for a multi-mode feature', () => {
    expect(stage().read('README.md', 'utf-8')).toContain("shell.open({ displayMode: 'standalone' })")
  })

  it('omits the explicit displayMode example for a single-mode feature', () => {
    expect(stage({ display: { modes: ['dialog'] } }).read('README.md', 'utf-8')).not.toContain('shell.open({ displayMode:')
  })

  it('notes in the README that undeclared modes are excluded from types and bundle', () => {
    expect(stage().read('README.md', 'utf-8')).toContain('Undeclared modes are excluded from both the generated types and the bundled code')
  })

  it('shows the container option in the quick start for an embedded-capable feature', () => {
    expect(stage().read('README.md', 'utf-8')).toContain("container: '#clock',")
  })

  it('omits the container line from the quick start for a non-embedded feature', () => {
    expect(stage({ display: { modes: ['popup'] } }).read('README.md', 'utf-8')).not.toContain('container:')
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

  it('writes a labeled open-shell warning into the README for a protocol-none build', () => {
    expect(stage({ protocol: 'none' }).read('README.md', 'utf-8')).toContain('**Warning: open shell.**')
  })

  it('omits the open-shell warning for a secured build', () => {
    expect(stage().read('README.md', 'utf-8')).not.toContain('**Warning: open shell.**')
  })

  it('points a protocol-none README at rebuilding with a security protocol', () => {
    expect(stage({ protocol: 'none' }).read('README.md', 'utf-8')).toContain('deliberately built open')
  })

  it('instructs manual protocol selection when no protocol was resolved', () => {
    expect(stage({ protocol: undefined }).read('README.md', 'utf-8')).toContain('No security envelope is baked into this shell')
  })

  it('shows a typed send example drawn from the first accepted action', () => {
    expect(stage().read('README.md', 'utf-8')).toContain("shell.send('setTimezone', data)")
  })

  it('shows a typed event example drawn from the first emitted action', () => {
    expect(stage().read('README.md', 'utf-8')).toContain("shell.on('timeUpdated', (data) => console.log(data))")
  })

  it('omits the messaging examples when the contract has no actions', () => {
    const tree = createTree(import.meta.dirname)
    generateShell(config, { emitted: [], accepted: [] }, tree)
    expect(tree.read('README.md', 'utf-8')).not.toContain('shell.send(')
  })

  it('delegates metadata staging so the shell includes metadata.json', () => {
    expect(stage().exists('metadata.json')).toBe(true)
  })

  it('stamps the baked protocol into the delegated metadata', () => {
    expect(parse(stage().read('metadata.json', 'utf-8') ?? '')).toEqual(expect.objectContaining({ protocol: 'v2' }))
  })
})
