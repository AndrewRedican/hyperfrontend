import type { Tree } from '@hyperfrontend/project-scope/vfs'
import type { FeatureContract, ResolvedFeatureConfig } from '../../shared/types'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { generateMetadata } from '../metadata/generate-metadata'
import { toSourceLiteral } from './source-literal'

const ENTRY_PATH = 'src/index.ts'
const PACKAGE_PATH = 'package.json'
const README_PATH = 'README.md'

/**
 * Builds the baked-in default shell options from the resolved config.
 *
 * @param config - The resolved feature config supplying the URL and display defaults.
 * @returns A record of options the connector merges under host-supplied overrides.
 */
function buildDefaults(config: ResolvedFeatureConfig): Record<string, unknown> {
  return { url: config.url, ...(config.display ?? {}) }
}

/**
 * Builds the connector's TypeScript entry source with the contract inlined.
 *
 * @param config - The resolved feature config naming the feature and its URL.
 * @param contract - The validated contract inlined into the connector.
 * @returns The entry module source as a string.
 */
function buildConnectorEntry(config: ResolvedFeatureConfig, contract: FeatureContract): string {
  return `import type { ShellHandle, ShellOptions } from '@hyperfrontend/features/host'
import { createShell } from '@hyperfrontend/features/host'

/** Inlined contract describing the ${config.name} feature's actions. */
const contract = ${toSourceLiteral(contract)}

/** Default shell options baked in from the feature config. */
const defaults = ${toSourceLiteral(buildDefaults(config))}

/**
 * Creates a host-side shell for the ${config.name} feature.
 *
 * @param options - Host-supplied options (at minimum a \`container\`); these override the baked defaults.
 * @returns A shell handle exposing \`open\`, \`close\`, \`destroy\`, \`send\`, \`on\`, and \`isOpen\`.
 */
export function createFeatureShell(options: ShellOptions): ShellHandle {
  return createShell({ ...defaults, ...options, contract })
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
 * Builds the connector's `README.md` documenting the generated install + usage.
 *
 * @param config - The resolved feature config naming the feature.
 * @returns The README contents as a string.
 */
function buildConnectorReadme(config: ResolvedFeatureConfig): string {
  return `# ${config.name}-shell

Generated host connector for the **${config.name}** feature. Self-contained — install it and embed the feature with one call.

\`\`\`typescript
import { createFeatureShell } from '${config.name}-shell'

const shell = createFeatureShell({
  container: '#${config.name}',
  // Security envelope: 'none' (default) | 'v1' | 'v2'.
  // 'v2' authenticates the channel with a pre-shared key.
  protocol: 'v2',
  sharedKey: 'your-pre-shared-key',
})

// Lifecycle events ('open', 'close', 'error'); on() returns an unsubscribe fn.
const unsubscribe = shell.on('open', () => console.log('connected'))

shell.open()                              // mount the feature in its display mode
shell.send('setTimezone', { tz: 'UTC' })  // send an action the feature accepts
console.log(shell.isOpen)                 // current connection state

unsubscribe()
shell.close()                             // disconnect gracefully
shell.destroy()                           // disconnect and release all resources
\`\`\`

> Regenerated from scratch on every build; do not edit by hand.
`
}

/**
 * Stages the complete host connector package into the supplied VFS tree.
 *
 * Emits the entry source, source-level `package.json`, `README.md`, and (via
 * {@link generateMetadata}) `metadata.json`. Pure: stages only into `tree` — the
 * CLI owns temp-dir creation, bundling, and commit.
 *
 * @param config - The resolved feature config.
 * @param contract - The validated feature contract, inlined into the connector.
 * @param tree - The VFS tree the connector files are staged into.
 *
 * @example Staging a connector for the clock feature
 * ```typescript
 * generateShell({ name: 'clock', version: '1.0.0', contract: './clock.contract.json', url: '/clock' }, contract, tree)
 * ```
 */
export function generateShell(config: ResolvedFeatureConfig, contract: FeatureContract, tree: Tree): void {
  tree.write(ENTRY_PATH, buildConnectorEntry(config, contract))
  tree.write(PACKAGE_PATH, buildConnectorPackageJson(config))
  tree.write(README_PATH, buildConnectorReadme(config))
  generateMetadata(config, contract, tree)
}
