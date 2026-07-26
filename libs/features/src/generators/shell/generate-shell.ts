import type { Tree } from '@hyperfrontend/project-scope/vfs'
import type { FeatureContract, ResolvedFeatureConfig } from '../../shared/types'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { generateMetadata } from '../metadata/generate-metadata'
import { buildConnectorTypes } from './connector-types'
import { toSourceLiteral } from './source-literal'

const ENTRY_PATH = 'src/index.ts'
const PACKAGE_PATH = 'package.json'
const README_PATH = 'README.md'

/**
 * Builds the baked-in default shell options from the resolved config.
 *
 * @param config - The resolved feature config supplying the URL, protocol, and display defaults.
 * @returns A record of options the connector merges under host-supplied overrides.
 */
function buildDefaults(config: ResolvedFeatureConfig): Record<string, unknown> {
  return {
    url: config.url,
    ...(config.protocol !== undefined && { protocol: config.protocol }),
    ...(config.display ?? {}),
  }
}

/**
 * Builds the connector's TypeScript entry source with the contract inlined and
 * the contract-projected types exported.
 *
 * @param config - The resolved feature config naming the feature and its URL.
 * @param contract - The validated contract inlined into the connector.
 * @returns The entry module source as a string.
 */
function buildConnectorEntry(config: ResolvedFeatureConfig, contract: FeatureContract): string {
  return `import { createShell } from '@hyperfrontend/features/host'

${buildConnectorTypes(contract)}
/** Inlined contract describing the ${config.name} feature's actions, exactly as the feature authored it. */
const contract = ${toSourceLiteral(contract)}

/** Default shell options baked in from the feature's build. */
const defaults = <const>${toSourceLiteral(buildDefaults(config))}

/**
 * Creates a host-side shell for the ${config.name} feature.
 *
 * The feature's contract and build-time defaults are baked in, and \`send\`/\`on\`
 * are typed from the contract's actions.
 *
 * @param options - Host-supplied options (at minimum a \`container\`); these override the baked defaults.
 * @returns A typed shell handle exposing \`open\`, \`close\`, \`destroy\`, \`send\`, \`on\`, and \`isOpen\`.
 */
export function createFeatureShell(options: FeatureShellOptions): FeatureShellHandle {
  return <FeatureShellHandle>createShell({ ...defaults, ...options, contract })
}
`
}

/**
 * Builds the connector's source-level `package.json` (zero deps; the builder finalizes it).
 *
 * @param config - The resolved feature config supplying name and version.
 * @returns The package manifest as a JSON string.
 */
function buildConnectorPackageJson(config: ResolvedFeatureConfig): string {
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
 * Builds the open-connector warning block for a protocol-`none` build.
 *
 * @param config - The resolved feature config carrying the baked protocol.
 * @returns The warning block, or an empty string for secured builds.
 */
function buildReadmeWarning(config: ResolvedFeatureConfig): string {
  if (config.protocol !== 'none') {
    return ''
  }
  return `> **Warning: open connector.** This build uses protocol \`none\`: messages between host and feature travel with no security envelope, so any page that can reach the feature URL can embed and drive it. For production, rebuild the feature with \`--protocol v1\` or \`--protocol v2\`.

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
    return 'This connector was deliberately built open (see the warning above); harden it by rebuilding the feature with a security protocol.'
  }
  return "No security envelope is baked into this connector; pass `protocol: 'v1'` or `protocol: 'v2'` (with your own `sharedKey` for `v2`) when creating the shell."
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
 * Builds the connector's `README.md` documenting the generated install + usage.
 *
 * @param config - The resolved feature config naming the feature.
 * @param contract - The validated feature contract driving the typed examples.
 * @returns The README contents as a string.
 */
function buildConnectorReadme(config: ResolvedFeatureConfig, contract: FeatureContract): string {
  return `# ${config.name}-shell

Generated host connector for the **${config.name}** feature. Self-contained — install it and embed the feature with one call. \`send\` and \`on\` are typed from the feature's contract.

${buildReadmeWarning(config)}\`\`\`typescript
import { createFeatureShell } from '${config.name}-shell'

const shell = createFeatureShell({
  container: '#${config.name}',${buildReadmeOptions(config)}
})

// Lifecycle events ('open', 'close', 'error'); on() returns an unsubscribe fn.
// Opening is asynchronous — isOpen stays false until 'open' fires.
const unsubscribe = shell.on('open', () => console.log('connected', shell.isOpen))

shell.open()               // mount the feature in its display mode
${buildReadmeMessaging(contract)}
unsubscribe()
shell.close()              // disconnect gracefully
shell.destroy()            // disconnect and release all resources
\`\`\`

${buildReadmeSecurity(config)}

> Regenerated from scratch on every build; do not edit by hand.
`
}

/**
 * Stages the complete host connector package into the supplied VFS tree.
 *
 * Emits the entry source (with contract-projected types), source-level
 * `package.json`, `README.md`, and (via {@link generateMetadata})
 * `metadata.json`. Pure: stages only into `tree` — the CLI owns temp-dir
 * creation, bundling, and commit.
 *
 * @param config - The resolved feature config.
 * @param contract - The validated feature contract, inlined into the connector.
 * @param tree - The VFS tree the connector files are staged into.
 *
 * @example Staging a connector for the clock feature
 * ```typescript
 * generateShell({ name: 'clock', version: '1.0.0', contract: './clock.contract.json', url: '/clock', protocol: 'v2' }, contract, tree)
 * ```
 */
export function generateShell(config: ResolvedFeatureConfig, contract: FeatureContract, tree: Tree): void {
  tree.write(ENTRY_PATH, buildConnectorEntry(config, contract))
  tree.write(PACKAGE_PATH, buildConnectorPackageJson(config))
  tree.write(README_PATH, buildConnectorReadme(config, contract))
  generateMetadata(config, contract, tree)
}
