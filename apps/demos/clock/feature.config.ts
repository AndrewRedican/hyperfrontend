import type { DisplayConfig, FeatureConfig, FeaturePermission, SecurityProtocol } from '@hyperfrontend/features'

/**
 * The extended config keys `hf build` resolves beyond the core `FeatureConfig`.
 *
 * Authored inline because `defineConfig` types only name/version/contract and
 * rejects these keys, while the CLI reads all four from the config file.
 */
interface ExtendedFeatureConfig extends FeatureConfig {
  /** URL of the feature app the generated shell loads by default. */
  url?: string
  /** Security envelope baked into the generated shell. */
  protocol?: SecurityProtocol
  /** Display modes and per-mode defaults baked into the generated shell. */
  display?: DisplayConfig
  /** Permissions-Policy features the shell delegates to the frame. */
  permissions?: FeaturePermission[]
}

const config = {
  name: '@hyperfrontend/demo-clock',
  version: '0.2.0',
  contract: './clock.contract.ts',
  url: 'https://demo-clock-production.up.railway.app/',
  protocol: 'v1',
  display: {
    // note: embedded first — an open() without an explicit displayMode embeds; no fixed embedded dimensions, so the iframe fills the host's container.
    modes: ['embedded', 'dialog', 'popup', 'standalone'],
    dialog: { width: 420, height: 420 },
    popup: { width: 480, height: 480 },
  },
} satisfies ExtendedFeatureConfig

export default config
