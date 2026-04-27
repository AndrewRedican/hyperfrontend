# platform

Operating system detection and platform-specific normalization for filesystem case sensitivity and line endings.

`detectPlatform`, `getPlatformInfo`, and `isWindows` classify the host OS; `isCaseSensitiveFs` and `detectCaseSensitivity` decide whether path comparisons must be case-aware (POSIX) or case-insensitive (Windows/macOS HFS+). Line-ending helpers (`detectLineEnding`, `getLineEnding`, `normalizeLineEndings`, plus `LF`/`CRLF` constants) let writers convert content to a consistent style before commit. `pathsEqual` performs platform-aware path equality, and `getPathSeparator` returns the active separator.
