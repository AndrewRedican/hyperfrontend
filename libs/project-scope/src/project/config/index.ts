/**
 * Configuration file detection and parsing for various config types with pattern matching.
 *
 * @module @hyperfrontend/project-scope/project/config
 */
export type { ConfigPatternInfo, ConfigType } from './patterns'
export { CONFIG_PATTERNS, getConfigPatternsByType } from './patterns'
export type { DetectedConfig, DetectConfigOptions } from './detect'
export { clearConfigDetectionCache, detectConfigs, findConfigFile } from './detect'
export type { ParsedConfig } from './parse'
export { parseConfig, parseJsonConfig, parseYamlConfig } from './parse'
