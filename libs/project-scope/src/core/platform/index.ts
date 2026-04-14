/**
 * Platform detection for OS type, filesystem case sensitivity, and line ending handling.
 *
 * @module @hyperfrontend/project-scope/core/platform
 */
export type { PlatformInfo } from './detect'
export type { DetectedLineEnding, LineEndingStyle } from './line-endings'
export { detectCaseSensitivity, detectPlatform, getPlatformInfo, isCaseSensitiveFs, isWindows } from './detect'
export { CRLF, detectLineEnding, getLineEnding, getPathSeparator, LF, normalizeLineEndings, pathsEqual } from './line-endings'
