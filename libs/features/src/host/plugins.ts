// note: The plugin contract lives in shared/types so ShellOptions.plugins can reference it without a shared-to-host import edge; this module re-exports it for host-side code and consumers.
export type { ExperiencePlugin, ExperiencePluginContext } from '../shared/types'
