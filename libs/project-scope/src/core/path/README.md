# path

Cross-platform path manipulation utilities that normalize between POSIX and native (Windows) separators.

Grouped into four concerns: joining (`join`, `joinPosix`, `joinPath`), normalization (`normalizePath`, `normalizeToForwardSlashes`, `normalizeToNative`, trailing-slash helpers), resolution (`resolvePath`, `resolveRealPath`, `resolveFromWorkspace`, `relativePath`, `offsetFromRoot`, `isAbsolute`), and segment extraction (`getDirname`, `getBasename`, `getExtension`, `getFileNameWithoutExtension`, `parsePath`, `pathSegments`).

All functions emit forward-slash paths by default to keep downstream string comparisons portable across operating systems.
