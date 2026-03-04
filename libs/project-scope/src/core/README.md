# Core Module

The `core` module provides foundational utilities for file system operations, path manipulation, logging, caching, error handling, and pattern matching. These utilities are used throughout the library and are also available for consumers.

## Capabilities

### File System (`fs/`)

Safe, typed file system operations with comprehensive error handling.

```typescript
import {
  readFileContent,
  readJsonFile,
  writeFileContent,
  writeJsonFile,
  readDirectory,
  readDirectoryRecursive,
  exists,
  isFile,
  isDirectory,
  ensureDir,
} from '@hyperfrontend/project-scope'

// Read files
const content = readFileContent('./package.json')
const config = readJsonFile<Config>('./config.json', { default: {} })

// Write files (creates directories automatically)
writeFileContent('./output/data.txt', 'Hello, World!')
writeJsonFile('./output/config.json', { port: 3000 })

// Directory operations
const entries = readDirectory('./src')
const allFiles = readDirectoryRecursive('./src', { maxDepth: 5 })

// Stat operations
if (exists('./config.json') && isFile('./config.json')) {
  // Process file
}
```

#### Key Functions

| Function                 | Description                               |
| ------------------------ | ----------------------------------------- |
| `readFileContent`        | Read file as string with encoding support |
| `readFileBuffer`         | Read file as Buffer                       |
| `readFileIfExists`       | Read file or return null                  |
| `readJsonFile`           | Parse JSON file with type inference       |
| `readJsonFileIfExists`   | Parse JSON file or return null            |
| `writeFileContent`       | Write string to file                      |
| `writeFileBuffer`        | Write Buffer to file                      |
| `writeJsonFile`          | Serialize and write JSON                  |
| `ensureDir`              | Create directory recursively              |
| `readDirectory`          | List directory contents                   |
| `readDirectoryRecursive` | List contents recursively                 |
| `exists`                 | Check if path exists                      |
| `isFile`                 | Check if path is a file                   |
| `isDirectory`            | Check if path is a directory              |
| `isSymlink`              | Check if path is a symlink                |
| `getFileStat`            | Get detailed file statistics              |

### Path Utilities (`path/`)

Cross-platform path manipulation utilities.

```typescript
import {
  normalizePath,
  joinPath,
  resolvePath,
  relativePath,
  isAbsolute,
  getDirname,
  getBasename,
  getExtension,
} from '@hyperfrontend/project-scope'

const normalized = normalizePath('./src/../lib/index.ts') // 'lib/index.ts'
const joined = joinPath('src', 'utils', 'helper.ts') // 'src/utils/helper.ts'
```

### Encoding (`encoding/`)

Utilities for detecting and converting file encodings.

```typescript
import { detectEncoding, convertEncoding } from '@hyperfrontend/project-scope'

const encoding = detectEncoding(buffer)
const utf8Content = convertEncoding(buffer, 'utf-8')
```

### Platform Detection (`platform/`)

Detect operating system and normalize platform-specific behaviors.

```typescript
import { detectPlatform, isWindows, isMacOS, isLinux, normalizeLineEndings } from '@hyperfrontend/project-scope'

const platform = detectPlatform() // 'windows' | 'macos' | 'linux'
const normalizedContent = normalizeLineEndings(content, 'lf')
```

### Logger (`logger.ts`)

Scoped logging with automatic secret sanitization.

```typescript
import { createScopedLogger, setGlobalLogLevel } from '@hyperfrontend/project-scope'

// Create a scoped logger
const logger = createScopedLogger('my-module')

// Log messages with optional metadata
logger.info('Starting process', { path: './project' })
logger.debug('Config loaded', { apiKey: 'secret123' }) // apiKey is auto-redacted

// Set global log level
setGlobalLogLevel('debug') // 'error' | 'warn' | 'log' | 'info' | 'debug'
```

### Cache (`cache.ts`)

In-memory cache with TTL and size limits.

```typescript
import { createCache, clearAllCaches } from '@hyperfrontend/project-scope'

// Create cache with TTL
const cache = createCache<string, Object>({ ttl: 60000 }) // 60 second TTL

// Create cache with size limit
const lruCache = createCache<string, Object>({ maxSize: 100 })

// Combined options
const configCache = createCache<string, Config>({ ttl: 30000, maxSize: 50 })

cache.set('key', { data: 'value' })
const value = cache.get('key')

// Clear all registered caches
clearAllCaches()
```

### Structured Errors (`errors/`)

Create errors with machine-readable codes and context.

```typescript
import {
  createStructuredError,
  createConfigError,
  createFsError,
  createParseError,
  createValidationError,
} from '@hyperfrontend/project-scope'

throw createStructuredError('Config not found', 'CONFIG_NOT_FOUND', {
  path: './config.json',
  searched: ['./config.json', './settings.json'],
})

// Specialized error factories
throw createFsError('File not found', 'ENOENT', { path: './missing.txt' })
throw createParseError('Invalid JSON', 'PARSE_ERROR', { line: 10, column: 5 })
```

### Glob Pattern Matching (`patterns/`)

Safe glob matching without regex (ReDoS-protected).

```typescript
import { matchGlobPattern } from '@hyperfrontend/project-scope'

matchGlobPattern('src/utils/helper.ts', '**/*.ts') // true
matchGlobPattern('test.spec.ts', '*.spec.ts') // true
matchGlobPattern('config.json', '*.{json,yaml}') // true
matchGlobPattern('src/index.ts', 'src/*.ts') // true
```

#### Supported Patterns

| Pattern   | Description                        |
| --------- | ---------------------------------- |
| `*`       | Match any characters except `/`    |
| `**`      | Match any characters including `/` |
| `?`       | Match exactly one character        |
| `{a,b,c}` | Match any alternative              |

## Architecture

```
core/
├── fs/                    # File system operations
│   ├── read.ts           # Reading files and JSON
│   ├── write.ts          # Writing files and JSON
│   ├── stat.ts           # File statistics
│   ├── directory.ts      # Directory operations
│   └── traversal.ts      # File search utilities
├── path/                  # Path manipulation
│   ├── join.ts           # Path joining
│   ├── normalize.ts      # Path normalization
│   ├── resolve.ts        # Path resolution
│   └── segments.ts       # Path segment utilities
├── encoding/             # Encoding detection/conversion
├── platform/             # OS detection
├── errors/               # Structured error creation
├── patterns/             # Glob pattern matching
├── logger.ts             # Scoped logging
├── cache.ts              # In-memory caching
└── index.ts              # Public exports
```

## Design Principles

1. **Safe by default**: All operations handle errors gracefully with typed error objects
2. **No side effects**: Functions are pure where possible
3. **ReDoS protection**: Glob matching uses character iteration instead of regex
4. **Secret sanitization**: Logging automatically redacts sensitive values
5. **Cross-platform**: Path operations normalize across Windows/Unix
