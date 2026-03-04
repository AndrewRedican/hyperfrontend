import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Write mode for file operations.
 */
export const Mode = freeze(<const>{
  /** Overwrite existing files */
  Overwrite: 'overwrite',
  /** Fail if file exists */
  ExclusiveCreate: 'exclusive',
  /** Skip if file exists */
  SkipIfExists: 'skip',
})

/**
 * Write mode type extracted from Mode object.
 */
export type ModeType = (typeof Mode)[keyof typeof Mode]

/**
 * A single file change in the tree.
 */
export interface FileChange {
  /** Relative path from tree root */
  path: string
  /** Type of change */
  type: 'CREATE' | 'UPDATE' | 'DELETE'
  /** File content (undefined for DELETE) */
  content?: Buffer
  /** Original content for UPDATE (enables diff) */
  originalContent?: Buffer
  /** File mode/permissions */
  mode?: number
}

/**
 * Options for write operations.
 */
export interface WriteOptions {
  /** Write mode */
  mode?: ModeType
  /** File permissions (e.g., 0o755) */
  permissions?: number
}

/**
 * Options for creating a tree.
 */
export interface CreateTreeOptions {
  /** Enable verbose logging */
  verbose?: boolean
  /**
   * Whether to follow symlinks when reading/writing files.
   * When false, operations on symlinks will throw an error.
   *
   * @default true
   */
  followSymlinks?: boolean
}

/**
 * Options for committing changes.
 */
export interface CommitOptions {
  /** Dry run - don't actually write to disk */
  dryRun?: boolean
  /** Enable verbose logging */
  verbose?: boolean
}

/**
 * Result of committing changes.
 */
export interface CommitResult {
  /** Number of files created */
  created: number
  /** Number of files updated */
  updated: number
  /** Number of files deleted */
  deleted: number
  /** List of all changes applied */
  changes: FileChange[]
  /** Whether this was a dry run */
  dryRun: boolean
}

/**
 * Virtual file system tree interface.
 * Mirrors NX devkit Tree interface for compatibility.
 */
export interface Tree {
  /** Workspace root path */
  readonly root: string

  /**
   * Read file contents.
   *
   * @returns Buffer if no encoding specified, string otherwise
   */
  read(filePath: string): Buffer | null
  read(filePath: string, encoding: BufferEncoding): string | null

  /**
   * Write file contents.
   * Creates parent directories if they don't exist.
   */
  write(filePath: string, content: Buffer | string, options?: WriteOptions): void

  /**
   * Check if a file exists.
   * Considers pending changes in the tree.
   */
  exists(filePath: string): boolean

  /**
   * Delete a file or directory.
   */
  delete(filePath: string): void

  /**
   * Rename/move a file or directory.
   */
  rename(from: string, to: string): void

  /**
   * Check if path is a file (not directory).
   */
  isFile(filePath: string): boolean

  /**
   * Check if path is a directory.
   */
  isDirectory(filePath: string): boolean

  /**
   * Check if path is a symbolic link.
   *
   * @param filePath - Path to check
   * @returns True if path is a symlink
   */
  isSymlink(filePath: string): boolean

  /**
   * List children of a directory.
   *
   * @returns Array of child names (not full paths)
   */
  children(dirPath: string): string[]

  /**
   * Get list of pending changes.
   */
  listChanges(): FileChange[]

  /**
   * Clear all pending changes without committing.
   * Discards all buffered modifications.
   */
  clearChanges(): void

  /**
   * Change file permissions.
   */
  changePermissions(filePath: string, mode: number): void

  /**
   * Transform file contents using a callback.
   * Reads the file, applies transformation, and writes back.
   *
   * @param filePath - Path to file
   * @param transform - Transformation function
   * @throws {Error} If file doesn't exist
   */
  changeFile(filePath: string, transform: (content: Buffer) => Buffer): void
}

/**
 * A single line in a diff.
 */
export interface DiffLine {
  /** Type of line change */
  type: 'add' | 'remove' | 'context'
  /** Line number (in original for remove/context, in new for add) */
  line: number
  /** Line content */
  content: string
}

/**
 * Diff for a single file.
 */
export interface FileDiff {
  /** File path */
  path: string
  /** Diff lines */
  lines: DiffLine[]
  /** Number of added lines */
  additions: number
  /** Number of deleted lines */
  deletions: number
}
