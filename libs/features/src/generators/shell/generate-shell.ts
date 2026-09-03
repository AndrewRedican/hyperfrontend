import type { Tree } from '@hyperfrontend/project-scope/vfs'
import type { DisplayMode, FeatureContract, ResolvedFeatureConfig } from '../../shared/types'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { generateMetadata } from '../metadata/generate-metadata'
import { canonicalVersion } from '../shared/canonical-version'
import { resolveDeclaredModes } from '../shared/declared-modes'
import { buildShellTypes } from './shell-types'
import { toSourceLiteral } from './source-literal'

const ENTRY_PATH = 'src/index.ts'
const PACKAGE_PATH = 'package.json'
const README_PATH = 'README.md'

// note: One mount function per display mode; the entry imports only the declared ones so a rollup pass over the side-effect-free host SDK drops the rest from the bundle.
const MODE_MOUNTS = freeze({
  embedded: 'mountEmbedded',
  dialog: 'mountDialog',
  popup: 'mountPopup',
  standalone: 'mountStandalone',
} as Record<DisplayMode, string>)

/**
 * Builds the baked-in default shell options from the resolved config.
 *
 * The declared display config flattens into the shell's option names, and the
 * first declared mode is baked as the default `displayMode`.
 *
 * @param config - The resolved feature config supplying the URL, protocol, permissions, and display declaration.
 * @param modes - The declared display modes, in declaration order.
 * @returns A record of options the shell merges under host-supplied overrides.
 */
function buildDefaults(config: ResolvedFeatureConfig, modes: DisplayMode[]): Record<string, unknown> {
  const display = config.display
  return {
    url: config.url,
    displayMode: modes[0],
    ...(config.protocol !== undefined && { protocol: config.protocol }),
    ...(config.permissions !== undefined && { permissions: config.permissions }),
    ...(display?.embedded !== undefined && { embedWidth: display.embedded.width, embedHeight: display.embedded.height }),
    ...(display?.dialog?.width !== undefined && { dialogWidth: display.dialog.width }),
    ...(display?.dialog?.height !== undefined && { dialogHeight: display.dialog.height }),
    ...(display?.dialog?.position !== undefined && { dialogPosition: display.dialog.position }),
    ...(display?.dialog?.backdrop !== undefined && { dialogBackdrop: display.dialog.backdrop }),
    ...(display?.popup?.width !== undefined && { popupWidth: display.popup.width }),
    ...(display?.popup?.height !== undefined && { popupHeight: display.popup.height }),
    ...(display?.popup?.position !== undefined && { popupPosition: display.popup.position }),
    ...(display?.closeOnEscape !== undefined && { closeOnEscape: display.closeOnEscape }),
  }
}

/**
 * Builds the shell's TypeScript entry source with the contract inlined,
 * the contract-projected types exported, and only the declared display modes
 * composed.
 *
 * @param config - The resolved feature config naming the feature and its URL.
 * @param contract - The validated contract inlined into the shell.
 * @param modes - The declared display modes, in declaration order.
 * @returns The entry module source as a string.
 */
function buildShellEntry(config: ResolvedFeatureConfig, contract: FeatureContract, modes: DisplayMode[]): string {
  const mounts = modes.map((mode) => MODE_MOUNTS[mode])
  const imports = ['createShell', ...mounts].sort().join(', ')
  const modeMap = modes.map((mode) => `${mode}: ${MODE_MOUNTS[mode]}`).join(', ')
  return `import type { UnresponsivePolicy } from '@hyperfrontend/features/host'
import { ${imports} } from '@hyperfrontend/features/host'

${buildShellTypes(contract, modes)}
/** Inlined contract describing the ${config.name} feature's actions as authored, stamped with the contract version this shell was built from. */
const contract = ${toSourceLiteral({ ...contract, version: canonicalVersion(config.version) })}

/** Default shell options baked in from the feature's build. */
const defaults = <const>${toSourceLiteral(buildDefaults(config, modes))}

/** The display modes this feature declares; the shell is built from exactly these. */
const modes = { ${modeMap} }

/**
 * Creates a host-side shell for the ${config.name} feature.
 *
 * The feature's contract, declared display modes, and build-time defaults are
 * baked in; \`send\`/\`on\` are typed from the contract's actions and only the
 * declared modes are built in (or typed).
 *
 * @param options - Host-supplied options; these override the baked defaults.
 * @returns A typed shell handle exposing the session lifecycle (\`open\`, \`close\`, \`destroy\`, \`isOpen\`), contract-typed messaging (\`send\`, \`on\`, \`request\`, \`handle\`), and the feature's \`isDirty\` state.
 */
export function createFeatureShell(options: FeatureShellOptions): FeatureShellHandle {
  // why: This shell narrows \`displayMode\` to the modes the feature declares, while the SDK types its unresponsive callback for every mode. A mount rejects an undeclared mode before the callback can ever fire, so the policy is widened here rather than widening what the shell hands its consumers.
  const { onUnresponsive, ...rest } = options
  return <FeatureShellHandle>createShell({ ...defaults, ...rest, onUnresponsive: <UnresponsivePolicy | undefined>onUnresponsive, contract, modes })
}
`
}

/**
 * Builds the shell's source-level `package.json` (zero deps; the builder finalizes it).
 *
 * @param config - The resolved feature config supplying name and version.
 * @returns The package manifest as a JSON string.
 */
function buildShellPackageJson(config: ResolvedFeatureConfig): string {
  const manifest = {
    name: `${config.name}-shell`,
    version: config.version,
    type: 'module',
    sideEffects: false,
    exports: {
      '.': { types: './dist/index.d.ts', import: './dist/index.js' },
      './package.json': './package.json',
    },
  }
  return `${stringify(manifest, null, 2)}\n`
}

/**
 * Builds the open-shell warning block for a protocol-`none` build.
 *
 * @param config - The resolved feature config carrying the baked protocol.
 * @returns The warning block, or an empty string for secured builds.
 */
function buildReadmeWarning(config: ResolvedFeatureConfig): string {
  if (config.protocol !== 'none') {
    return ''
  }
  return `> **Warning: open shell.** This build uses protocol \`none\`: messages between host and feature travel with no security envelope, so any page that can reach the feature URL can embed and drive it. For production, rebuild the feature with \`--protocol v1\` or \`--protocol v2\`.

`
}

/**
 * Builds the security paragraph matching the baked protocol.
 *
 * @param config - The resolved feature config carrying the baked protocol.
 * @returns The security guidance paragraph.
 */
function buildReadmeSecurity(config: ResolvedFeatureConfig): string {
  if (config.protocol === 'v2') {
    return "The `v2` security envelope is baked in from the feature's build — do not pass `protocol` yourself. Supply your own pre-shared key via `sharedKey`; a key is never baked into the artifact."
  }
  if (config.protocol === 'v1') {
    return "The `v1` security envelope is baked in from the feature's build — do not pass `protocol` yourself."
  }
  if (config.protocol === 'none') {
    return 'This shell was deliberately built open (see the warning above); harden it by rebuilding the feature with a security protocol.'
  }
  return "No security envelope is baked into this shell; pass `protocol: 'v1'` or `protocol: 'v2'` (with your own `sharedKey` for `v2`) when creating the shell."
}

/**
 * Builds the option lines shown inside the quick-start `createFeatureShell` call.
 *
 * @param config - The resolved feature config carrying the baked protocol.
 * @returns Extra option lines, each newline-prefixed, or an empty string.
 */
function buildReadmeOptions(config: ResolvedFeatureConfig): string {
  if (config.protocol === 'v2') {
    return "\n  sharedKey: 'your-pre-shared-key',"
  }
  if (config.protocol === undefined) {
    return "\n  protocol: 'v2',\n  sharedKey: 'your-pre-shared-key',"
  }
  return ''
}

/**
 * Builds the README paragraph disclosing the feature's baked permission grants.
 *
 * @param config - The resolved feature config carrying any declared permissions.
 * @returns The permissions paragraph, or an empty string when none are declared.
 */
function buildReadmePermissions(config: ResolvedFeatureConfig): string {
  if (config.permissions === undefined || config.permissions.length === 0) {
    return ''
  }
  const list = config.permissions.map((permission) => `\`${permission}\``).join(', ')
  return `This feature declares it needs the following browser permissions, delegated to its frame automatically: ${list}. Pass your own \`permissions\` array to replace the grant list entirely, or review the declaration in \`metadata.json\`.

`
}

/**
 * Builds the typed messaging example lines from the contract's first actions.
 *
 * @param contract - The validated feature contract.
 * @returns Messaging example lines ending in a newline, or an empty string.
 */
function buildReadmeMessaging(contract: FeatureContract): string {
  const sent = contract.accepted[0]
  const received = contract.emitted[0]
  const sendLine =
    sent === undefined ? '' : `shell.send('${sent.type}', data)  // typed: the payload shape comes from the feature contract\n`
  const onLine =
    received === undefined ? '' : `shell.on('${received.type}', (data) => console.log(data))  // typed: data follows the contract\n`
  return `${sendLine}${onLine}`
}

/**
 * Builds the README section documenting the feature's declared display modes.
 *
 * @param modes - The declared display modes, in declaration order.
 * @returns The display-modes section.
 */
function buildReadmeModes(modes: DisplayMode[]): string {
  const list = modes.map((mode) => `\`${mode}\``).join(', ')
  const openExample =
    modes.length > 1
      ? `Open a supported mode explicitly:

\`\`\`typescript
shell.open({ displayMode: '${modes[modes.length - 1]}' })
\`\`\`

`
      : ''
  return `## Display modes

This feature supports ${list}; \`open()\` defaults to \`${modes[0]}\`. Undeclared modes are excluded from both the generated types and the bundled code, so requesting one is a compile-time error before it is a runtime one.

${openExample}`
}

/**
 * Builds the quick-start `container` option line, present only when the
 * feature declares the embedded mode.
 *
 * @param config - The resolved feature config naming the feature.
 * @param modes - The declared display modes.
 * @returns The container option line, newline-prefixed, or an empty string.
 */
function buildReadmeContainer(config: ResolvedFeatureConfig, modes: DisplayMode[]): string {
  return modes.includes('embedded') ? `\n  container: '#${config.name}',` : ''
}

/**
 * Builds the shell's `README.md` documenting the generated install + usage.
 *
 * @param config - The resolved feature config naming the feature.
 * @param contract - The validated feature contract driving the typed examples.
 * @param modes - The declared display modes, in declaration order.
 * @returns The README contents as a string.
 */
function buildShellReadme(config: ResolvedFeatureConfig, contract: FeatureContract, modes: DisplayMode[]): string {
  return `# ${config.name}-shell

Generated shell for the **${config.name}** feature. Self-contained — install it and embed the feature with one call. \`send\` and \`on\` are typed from the feature's contract.

${buildReadmeWarning(config)}\`\`\`typescript
import { createFeatureShell } from '${config.name}-shell'

const shell = createFeatureShell({${buildReadmeContainer(config, modes)}${buildReadmeOptions(config)}
})

// Lifecycle events ('open', 'close', 'error'); on() returns an unsubscribe fn.
// Opening is asynchronous — isOpen stays false until 'open' fires.
const unsubscribe = shell.on('open', () => console.log('connected', shell.isOpen))

shell.open()               // mount the feature in its default display mode
${buildReadmeMessaging(contract)}
unsubscribe()
shell.close()              // disconnect gracefully
shell.destroy()            // disconnect and release all resources
\`\`\`

${buildReadmeModes(modes)}${buildReadmePermissions(config)}${buildReadmeSecurity(config)}

> Regenerated from scratch on every build; do not edit by hand.
`
}

/**
 * Stages the complete shell package into the supplied VFS tree.
 *
 * Emits the entry source (with contract-projected types), source-level
 * `package.json`, `README.md`, and (via {@link generateMetadata})
 * `metadata.json`. Pure: stages only into `tree`; the CLI owns temp-dir
 * creation, bundling, and commit.
 *
 * @param config - The resolved feature config.
 * @param contract - The validated feature contract, inlined into the shell.
 * @param tree - The VFS tree the shell files are staged into.
 *
 * @example Staging a shell for the clock feature
 * ```typescript
 * generateShell({ name: 'clock', version: '1.0.0', contract: './clock.contract.json', url: '/clock', protocol: 'v2' }, contract, tree)
 * ```
 */
export function generateShell(config: ResolvedFeatureConfig, contract: FeatureContract, tree: Tree): void {
  const modes = resolveDeclaredModes(config)
  tree.write(ENTRY_PATH, buildShellEntry(config, contract, modes))
  tree.write(PACKAGE_PATH, buildShellPackageJson(config))
  tree.write(README_PATH, buildShellReadme(config, contract, modes))
  generateMetadata(config, contract, tree)
}
