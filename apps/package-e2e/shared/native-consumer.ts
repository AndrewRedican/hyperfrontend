import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { createTempDir } from '@hyperfrontend/testing/fs'

/**
 * The result of running a script inside the consumer with plain Node.
 */
export interface ConsumerRun {
  /** The child's exit code, or null when a signal ended it. */
  status: number | null
  /** Everything the child wrote to stdout. */
  stdout: string
  /** Everything the child wrote to stderr. */
  stderr: string
}

/**
 * One export entry loaded through plain Node.
 */
export interface EntryLoad {
  /** The specifier a consumer writes, such as `@scope/pkg/sub`. */
  specifier: string
  /** Whether the entry was loaded with `import` or `require`. */
  kind: 'import' | 'require'
  /** Whether the load succeeded. */
  ok: boolean
  /** The first error lines when it did not, empty otherwise. */
  message: string
}

/**
 * A directory outside the workspace with the packed package installed into it.
 */
export interface NativeConsumer {
  /** Absolute path of the consumer directory. */
  readonly path: string
  /** The installed package's name. */
  readonly packageName: string
  /** Writes a file under the consumer directory, creating parent directories, and returns its absolute path. */
  write(relativePath: string, content: string): string
  /** Runs a file with the Node binary running the suite, from the consumer directory, with no loader hooks. */
  node(args: readonly string[], env?: NodeJS.ProcessEnv): ConsumerRun
  /** Loads every `exports` entry of the installed package, one child process each; `kind` restricts to `import` or `require`, default both. */
  loadEntries(kind?: 'import' | 'require'): EntryLoad[]
  /** Lists every file under a directory of the consumer, as paths relative to it with forward slashes. */
  listFiles(relativeDir: string): string[]
  /** Removes the consumer directory. */
  remove(): void
}

/** The slice of an e2e project's manifest the tarball lookup reads. */
interface E2eManifest {
  /** The dependencies, one of which is the `file:` tarball of the package under test. */
  dependencies?: Record<string, string>
}

/** The slice of the installed package's manifest the entry probe reads. */
interface InstalledManifest {
  /** The `exports` map, whose subpaths and conditions name what a consumer can load. */
  exports?: Record<string, unknown>
}

/** One export subpath paired with the module system it is loaded under. */
interface EntryPair {
  /** The specifier a consumer writes. */
  specifier: string
  /** Whether the entry is loaded with `import` or `require`. */
  kind: 'import' | 'require'
}

/** Options for {@link createNativeConsumer}. */
export interface NativeConsumerOptions {
  /** Absolute path of the packed tarball to install. */
  tarball: string
  /** The package name the tarball carries. */
  packageName: string
}

/**
 * Resolves the packed tarball an e2e project depends on, from its `package.json` `file:` dependency.
 *
 * @param e2eProjectDir - The e2e project's directory.
 * @param packageName - The package under test.
 * @returns The absolute tarball path.
 * @throws {Error} When the dependency is not a `file:` entry or the tarball is missing.
 */
export function tarballFor(e2eProjectDir: string, packageName: string): string {
  const manifest = JSON.parse(readFileSync(join(e2eProjectDir, 'package.json'), 'utf8')) as E2eManifest
  const declared = manifest.dependencies?.[packageName] ?? ''
  if (!declared.startsWith('file:')) {
    throw new Error(
      `${packageName} is not a file: dependency of ${e2eProjectDir}; the e2e executor installs the packed tarball there first`
    )
  }
  const tarball = resolve(e2eProjectDir, declared.slice('file:'.length))
  if (!existsSync(tarball)) {
    throw new Error(`packed tarball ${tarball} is missing; run the e2e executor, which packs the built package before the suites run`)
  }
  return tarball
}

/**
 * Builds the shell-free arguments `execFileSync` hands npm.
 *
 * @param args - The arguments as the child should receive them.
 * @returns The arguments, quoted only where a Windows shell is in the way.
 */
function shellSafe(args: readonly string[]): string[] {
  // why: npm is a .cmd shim on Windows, which only a shell can launch, and the shell splits an unquoted argument at every space.
  return process.platform === 'win32' ? args.map((arg) => (arg.includes(' ') ? `"${arg}"` : arg)) : [...args]
}

const IMPORT_RUNNER = 'const m = await import(process.env.HF_CONSUMER_TARGET); process.stdout.write(String(Object.keys(m).length))\n'
const REQUIRE_RUNNER = 'const m = require(process.env.HF_CONSUMER_TARGET); process.stdout.write(String(Object.keys(m).length))\n'

/**
 * The specifiers and module kinds a package's `exports` map offers.
 *
 * @param packageName - The scoped or bare name every specifier starts with.
 * @param exportsMap - The manifest's `exports` object.
 * @returns One pair per subpath per supported condition.
 */
function entriesOf(packageName: string, exportsMap: Record<string, unknown>): EntryPair[] {
  const pairs: EntryPair[] = []
  for (const [subpath, target] of Object.entries(exportsMap)) {
    if (subpath === './package.json') continue
    const specifier = subpath === '.' ? packageName : `${packageName}/${subpath.slice(2)}`
    const kinds: Array<'import' | 'require'> =
      typeof target === 'string'
        ? ['import', 'require']
        : (['import', 'require'] as const).filter((kind) => typeof (target as Record<string, unknown>)[kind] === 'string')
    for (const kind of kinds) pairs.push({ specifier, kind })
  }
  return pairs
}

/**
 * Installs a packed tarball into a fresh directory under the OS temp dir and returns a handle that drives the
 * package through plain Node child processes.
 *
 * Nothing of the workspace reaches the consumer: no path aliases, no loader hooks, no hoisted `node_modules`, so a
 * package that only works through those is caught here. The install uses the npm cache the e2e executor's own
 * install just filled, so it stays fast and works offline.
 *
 * @param options - The tarball and its package name.
 * @returns The consumer handle.
 */
export function createNativeConsumer(options: NativeConsumerOptions): NativeConsumer {
  const dir = createTempDir({ prefix: 'hf-native-consumer-' })
  const root = dir.path
  writeFileSync(join(root, 'package.json'), `${JSON.stringify({ name: 'native-consumer', version: '0.0.0', private: true }, null, 2)}\n`)
  execFileSync('npm', shellSafe(['install', '--prefer-offline', '--no-audit', '--no-fund', '--loglevel=error', options.tarball]), {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  })

  const write = (relativePath: string, content: string): string => {
    const target = isAbsolute(relativePath) ? relativePath : join(root, relativePath)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, content)
    return target
  }

  const node = (args: readonly string[], env: NodeJS.ProcessEnv = {}): ConsumerRun => {
    const result = spawnSync(process.execPath, [...args], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, ...env },
      timeout: 300_000,
    })
    return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
  }

  const loadEntries = (kind?: 'import' | 'require'): EntryLoad[] => {
    const manifestPath = join(root, 'node_modules', ...options.packageName.split('/'), 'package.json')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as InstalledManifest
    const importRunner = write('.runners/import.mjs', IMPORT_RUNNER)
    const requireRunner = write('.runners/require.cjs', REQUIRE_RUNNER)
    return entriesOf(options.packageName, manifest.exports ?? {})
      .filter((pair) => kind === undefined || pair.kind === kind)
      .map(({ specifier, kind: pairKind }) => {
        const run = node([pairKind === 'import' ? importRunner : requireRunner], { HF_CONSUMER_TARGET: specifier })
        const message =
          run.status === 0
            ? ''
            : run.stderr
                .split(/\r?\n/)
                .filter((line) => line.trim().length > 0)
                .slice(0, 3)
                .join(' | ')
        return { specifier, kind: pairKind, ok: run.status === 0, message }
      })
  }

  const listFiles = (relativeDir: string): string[] => {
    const base = join(root, relativeDir)
    const files: string[] = []
    const visit = (current: string): void => {
      for (const entry of readdirSync(current, { withFileTypes: true })) {
        const full = join(current, entry.name)
        if (entry.isDirectory()) visit(full)
        else files.push(relative(base, full).split('\\').join('/'))
      }
    }
    if (existsSync(base)) visit(base)
    return files.sort()
  }

  return { path: root, packageName: options.packageName, write, node, loadEntries, listFiles, remove: () => dir.remove() }
}
