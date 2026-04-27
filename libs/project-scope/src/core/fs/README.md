# fs

Safe, typed wrappers around Node.js synchronous filesystem APIs with structured error handling.

Covers four areas: reading (`readFileContent`, `readFileBuffer`, `readJsonFile`, plus `*IfExists` variants), writing (`writeFileContent`, `writeJsonFile`, `ensureDir` — automatically creates parent directories), directory operations (`readDirectory`, `readDirectoryRecursive`, `createDirectory`, `removeDirectory`), and stat/traversal helpers (`exists`, `isFile`, `isDirectory`, `isSymlink`, `findUpwardWhere`, `locateByMarkers`, `traverseUpward`).

All operations surface failures via `createFileSystemError` with codes (`FS_NOT_FOUND`, `FS_READ_ERROR`, `FS_WRITE_ERROR`, `FS_PARSE_ERROR`) carrying contextual paths.
