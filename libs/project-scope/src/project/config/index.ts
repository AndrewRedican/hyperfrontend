/**
 * Configuration file detection and parsing for various config types with pattern matching.
 *
 * @module @hyperfrontend/project-scope/project/config
 */
export type { DetectedConfig, DetectConfigOptions } from './detect'
export type { ParsedConfig } from './parse'
export type { ConfigPatternInfo, ConfigType } from './patterns'
export { clearConfigDetectionCache, detectConfigs, findConfigFile } from './detect'
export { parseConfig, parseJsonConfig, parseYamlConfig } from './parse'
export { CONFIG_PATTERNS, getConfigPatternsByType } from './patterns'
