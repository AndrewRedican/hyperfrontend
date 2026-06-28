/**
 * The subset of Nx's virtual file-system tree the adapter consumes.
 *
 * Nx passes the concrete implementation to every generator factory; only the
 * members read here are mirrored.
 */
export interface Tree {
  /** Absolute workspace root all paths resolve against. */
  readonly root: string
  /**
   * Read a file's contents as a string.
   *
   * @param filePath - Workspace-relative path to the file.
   * @param encoding - Text encoding to decode the contents with.
   * @returns The decoded contents, or `null` when the file does not exist.
   */
  read(filePath: string, encoding: BufferEncoding): string | null
  /**
   * Check whether a path exists, accounting for pending tree changes.
   *
   * @param filePath - Workspace-relative path to test.
   * @returns `true` when the path exists.
   */
  exists(filePath: string): boolean
  /**
   * Stage a file write, creating parent directories as needed.
   *
   * @param filePath - Workspace-relative path to write.
   * @param content - The contents to stage.
   */
  write(filePath: string, content: string): void
}

/**
 * The single project entry the adapter reads from an executor context.
 */
export interface ProjectConfiguration {
  /** Workspace-relative root directory of the project. */
  readonly root: string
}

/**
 * Resolved project configurations, keyed by project name.
 */
export interface ProjectsConfigurations {
  /** Map of project name to its configuration. */
  readonly projects: Record<string, ProjectConfiguration>
}

/**
 * The subset of Nx's executor context the adapter consumes.
 */
export interface ExecutorContext {
  /** Absolute workspace root. */
  readonly root: string
  /** Name of the project the target runs against. */
  readonly projectName?: string
  /** Resolved project configurations, keyed by project name. */
  readonly projectsConfigurations?: ProjectsConfigurations
}

/**
 * Result an executor resolves with; `success` drives Nx's exit code.
 */
export interface ExecutorResult {
  /** Whether the target completed successfully. */
  readonly success: boolean
}

/**
 * Async executor signature mirroring `@nx/devkit`'s `PromiseExecutor`.
 *
 * @template TOptions - Schema-validated option shape for the executor.
 */
export type PromiseExecutor<TOptions> = (options: TOptions, context: ExecutorContext) => Promise<ExecutorResult>

/**
 * Long-running executor signature mirroring Nx's async-iterator executors.
 *
 * @template TOptions - Schema-validated option shape for the executor.
 */
export type AsyncIteratorExecutor<TOptions> = (options: TOptions, context: ExecutorContext) => AsyncIterableIterator<ExecutorResult>

/**
 * Optional post-write side effect a generator may return to Nx.
 */
export type GeneratorCallback = () => void | Promise<void>
