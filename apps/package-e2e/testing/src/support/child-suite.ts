/**
 * What a child `node --test` run may vary beyond its preloads and spec files.
 */
export type ChildSuiteOptions = {
  /** The reporter Node prints to stdout; TAP, Node's own, unless a check is about a reporter. */
  reporter?: string
  /** Further Node arguments placed before `--test`, such as the coverage flags. */
  nodeArgs?: readonly string[]
}

/**
 * Builds the arguments of a `node --test` run judged by Node's own reporter rather than by anything the package
 * under test prints.
 *
 * @param preloadUrls - `file:` URLs handed to `--import`, in order.
 * @param specs - Spec files, relative to the directory the child runs from.
 * @param options - The reporter and any further Node arguments.
 * @returns The arguments to hand the Node binary.
 */
export function childSuiteArgv(preloadUrls: readonly string[], specs: readonly string[], options: ChildSuiteOptions = {}): string[] {
  return [
    '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
    ...preloadUrls.flatMap((url) => ['--import', url]),
    ...(options.nodeArgs ?? []),
    '--test',
    `--test-reporter=${options.reporter ?? 'tap'}`,
    '--test-reporter-destination=stdout',
    ...specs,
  ]
}

/**
 * Reads one of the counts Node's TAP reporter prints at the end of a run.
 *
 * @param output - The child's stdout.
 * @param label - Which summary line to read.
 * @returns The count, or -1 when the summary line is absent.
 */
export function tapCount(output: string, label: 'tests' | 'pass' | 'fail' | 'skipped' | 'todo'): number {
  const prefix = `# ${label} `
  const line = output.split(/\r?\n/).find((candidate) => candidate.startsWith(prefix))
  return line === undefined ? -1 : Number(line.slice(prefix.length))
}
