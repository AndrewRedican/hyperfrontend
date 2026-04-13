export type { PlatformInfo } from './detect'
export { detectCaseSensitivity, detectPlatform, getPlatformInfo, isCaseSensitiveFs, isWindows } from './detect'
export type { DetectedLineEnding, LineEndingStyle } from './line-endings'
export { CRLF, detectLineEnding, getLineEnding, getPathSeparator, LF, normalizeLineEndings, pathsEqual } from './line-endings'
