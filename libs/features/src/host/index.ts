/**
 * Host-side SDK for embedding hyperfrontend features (shell factory, display modes, lifecycle).
 *
 * @module @hyperfrontend/features/host
 */
export type { EmbedSizing, ShellOptions, UnresponsiveInfo, UnresponsivePolicy } from '../shared/types'
export type { ExperiencePlugin, ExperiencePluginContext } from './plugins'
export type { ShellHandle } from './types'
export { DisplayMode } from '../shared/types'
export { createShell } from './create-shell'
