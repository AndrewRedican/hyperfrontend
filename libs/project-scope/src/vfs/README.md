# VFS Module

The `vfs` (Virtual File System) module provides a transactional file system abstraction for safely creating, updating, and deleting files. Changes are buffered in memory and can be committed atomically or rolled back, following the same patterns as NX devkit's Tree interface.

## Capabilities

### Creating a Tree

Create a virtual file system tree backed by a real directory.

```typescript
import { createTree, createTreeFromDisk } from '@hyperfrontend/project-scope'

// Create tree from directory
const tree = createTree('./my-project')

// With options
const tree2 = createTree('./my-project', {
  verbose: true, // Enable detailed logging
  followSymlinks: true, // Follow symlinks (default: true)
})

// Alias for createTree
const tree3 = createTreeFromDisk('./my-project')
```

### Reading Files

Read files from the tree (considers buffered changes).

```typescript
// Read as Buffer
const buffer = tree.read('src/index.ts')

// Read as string with encoding
const content = tree.read('src/index.ts', 'utf-8')

// Returns null if file doesn't exist
const maybeContent = tree.read('missing.ts', 'utf-8')
if (maybeContent === null) {
  console.log('File not found')
}
```

### Writing Files

Write files to the tree (buffered in memory).

```typescript
import { Mode } from '@hyperfrontend/project-scope'

// Write/overwrite file
tree.write('src/new-file.ts', 'export const hello = "world"')

// Write with options
tree.write('scripts/build.sh', '#!/bin/bash\necho "Building..."', {
  mode: Mode.ExclusiveCreate, // Fail if file exists
  permissions: 0o755, // Set executable permission
})

// Write modes
tree.write('file.ts', content, { mode: Mode.Overwrite }) // Default: overwrite
tree.write('file.ts', content, { mode: Mode.ExclusiveCreate }) // Fail if exists
tree.write('file.ts', content, { mode: Mode.SkipIfExists }) // Skip if exists
```

### Checking File Existence

```typescript
// Check if file exists (considers pending changes)
if (tree.exists('src/index.ts')) {
  // File exists
}

// Works with directories too
if (tree.exists('src/utils')) {
  // Directory exists
}
```

### Deleting Files

```typescript
// Delete a file
tree.delete('src/old-file.ts')

// Delete a directory (and contents)
tree.delete('src/deprecated')
```

### Renaming/Moving Files

```typescript
// Rename file
tree.rename('src/old-name.ts', 'src/new-name.ts')

// Move file to different directory
tree.rename('src/utils/helper.ts', 'src/lib/helper.ts')
```

### Listing Changes

```typescript
// Get all pending changes
const changes = tree.listChanges()

for (const change of changes) {
  console.log(`${change.type}: ${change.path}`)
  // 'CREATE: src/new-file.ts'
  // 'UPDATE: src/index.ts'
  // 'DELETE: src/old-file.ts'
}
```

### Committing Changes

Write all buffered changes to disk.

```typescript
import { commitChanges } from '@hyperfrontend/project-scope'

// Preview changes (dry run)
const preview = commitChanges(tree, { dryRun: true })
console.log('Would create:', preview.created, 'files')
console.log('Would update:', preview.updated, 'files')
console.log('Would delete:', preview.deleted, 'files')

// Actually commit changes
const result = commitChanges(tree)
console.log('Created:', result.created)
console.log('Updated:', result.updated)
console.log('Deleted:', result.deleted)

// Verbose commit
commitChanges(tree, { verbose: true })
// Output:
// + src/new-file.ts
// ~ src/index.ts
// - src/old-file.ts
```

### Rolling Back Changes

Discard all pending changes.

```typescript
import { rollbackChanges } from '@hyperfrontend/project-scope'

// Make some changes
tree.write('src/temp.ts', 'content')
tree.delete('src/important.ts')

// Oops, discard all changes
rollbackChanges(tree)
// Or equivalently:
tree.clearChanges()
```

### Generating Diffs

Generate unified diffs for file changes.

```typescript
import { generateDiff, generateAllDiffs } from '@hyperfrontend/project-scope'

// Generate diff for a single change
const change = tree.listChanges()[0]
const diff = generateDiff(change)
console.log(`${diff.path}: +${diff.additions} -${diff.deletions}`)
for (const line of diff.lines) {
  const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '
  console.log(`${prefix} ${line.content}`)
}

// Generate diffs for all changes
const allDiffs = generateAllDiffs(tree)
for (const diff of allDiffs) {
  console.log(`\n--- ${diff.path}`)
  // ... print diff lines
}
```

## Tree Interface

The Tree interface mirrors NX devkit's Tree for compatibility:

```typescript
interface Tree {
  /** Workspace root path */
  readonly root: string

  /** Read file contents */
  read(filePath: string): Buffer | null
  read(filePath: string, encoding: BufferEncoding): string | null

  /** Write file contents */
  write(filePath: string, content: Buffer | string, options?: WriteOptions): void

  /** Check if file/directory exists */
  exists(filePath: string): boolean

  /** Delete file or directory */
  delete(filePath: string): void

  /** Rename/move file or directory */
  rename(from: string, to: string): void

  /** Check if path is a file */
  isFile(filePath: string): boolean

  /** List directory children */
  children(dirPath: string): string[]

  /** List all pending changes */
  listChanges(): FileChange[]

  /** Clear all pending changes */
  clearChanges(): void
}
```

## File Change Types

```typescript
interface FileChange {
  /** Relative path from tree root */
  path: string
  /** Type of change */
  type: 'CREATE' | 'UPDATE' | 'DELETE'
  /** New content (undefined for DELETE) */
  content?: Buffer
  /** Original content (for UPDATE, enables diff) */
  originalContent?: Buffer
  /** File permissions */
  mode?: number
}
```

## Write Modes

```typescript
const Mode = {
  /** Overwrite existing files (default) */
  Overwrite: 'overwrite',
  /** Fail if file already exists */
  ExclusiveCreate: 'exclusive',
  /** Skip writing if file exists */
  SkipIfExists: 'skip',
}
```

## Security Features

### Path Traversal Protection

The VFS prevents path traversal attacks:

```typescript
// This will throw an error
tree.read('../../../etc/passwd')
// Error: Path escapes tree root: ../../../etc/passwd
```

### Symlink Handling

Control symlink behavior:

```typescript
// Symlinks followed by default
const tree1 = createTree('./', { followSymlinks: true })

// Disable symlink following (operations on symlinks will throw)
const tree2 = createTree('./', { followSymlinks: false })
```

Symlinks pointing outside the tree root are always rejected.

## Design Principles

1. **Transactional**: All changes are buffered until commit
2. **Safe**: Path traversal and symlink escapes are prevented
3. **Compatible**: Mirrors NX devkit Tree interface
4. **Atomic**: Commit applies all changes or fails completely
5. **Reversible**: Changes can be rolled back before commit
