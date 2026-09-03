/**
 * Shared harness for the packed-tarball Nx plugin E2E suites.
 *
 * Creates real consumer workspaces with the official create-nx-workspace
 * generator, installs the packed SDK tarball the way `nx add` installs a
 * plugin, and runs the workspace-local `nx` CLI with color-free output so
 * suites can assert on plain text.
 *
 * @module nx-workspace
 */

import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, sep } from 'node:path'

// note: Pinned to this repo's own Nx version so the generators are exercised against the exact runtime consumers of this workspace's tooling get.
const NX_VERSION = '22.7.8'

/** 10 minutes: create-nx-workspace runs a real npm install over the network, then the packed SDK tarball installs on top of it. */
export const SETUP_TIMEOUT = 600000

/** 4 minutes covers up to two cold nx invocations (daemon disabled) plus the workspace file copy on slow CI hosts. */
export const SCENARIO_TIMEOUT = 240000

/** 90s bounds one cold nx process so a hung child fails the suite instead of blocking the test runner forever. */
export const NX_COMMAND_TIMEOUT = 90000

/** 3 minutes bounds an nx run whose generator callback additionally spawns a package-manager reconcile of the workspace tree. */
export const NX_INSTALL_COMMAND_TIMEOUT = 180000

// note: 8 minutes bounds the create-nx-workspace child itself; the enclosing suite hook uses SETUP_TIMEOUT.
const WORKSPACE_CREATE_TIMEOUT = 480000

// note: 5 minutes bounds the tarball install into the freshly created workspace.
const TARBALL_INSTALL_TIMEOUT = 300000

/** The published package name of the Nx plugin under test. */
export const PLUGIN_NAME = '@hyperfrontend/features'

/**
 * Matches npm's install-closing chatter ("audited N packages" plus added/removed counts when the tree changed).
 * installPackagesTask inherits stdio, so this lands in the captured nx output exactly when a package-manager child ran.
 */
export const INSTALL_OUTPUT_PATTERN = /audited \d+ packages|added \d+ packages?|removed \d+ packages?/

/**
 * The contract every suite feeds the feature generator, mirroring the one cli.spec.ts feeds `hf build`.
 * Kept as JSON because the generator accepts .json contracts without any TypeScript loader.
 */
export const CONTRACT = {
  emitted: [{ type: 'tick', description: 'Time snapshot the feature streams to its host.' }],
  accepted: [{ type: 'ping', description: 'Liveness probe the host sends to the feature.' }],
}

/** Source of the seeded entry file the generator wires the glue import into. */
export const ENTRY_SOURCE = "console.log('demo app entry')\n"

/** The canonical feature-generator invocation, shared so every suite pins the same scaffold shape. */
export const FEATURE_ARGS: readonly string[] = [
  'g',
  `${PLUGIN_NAME}:feature`,
  '--name=clock',
  '--contract=./clock.contract.json',
  '--entry=src/main.ts',
  '--directory=demo',
]

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..', '..')
const TARBALL_PATTERN = /^hyperfrontend-features-(.+)\.tgz$/

// note: Top-level entries never copied into scenario workspaces — the install is shared via symlink and the caches are per-workspace state.
const SHARED_OR_CACHE_ENTRIES: ReadonlySet<string> = new Set(['node_modules', '.git', '.nx'])

/** Escape character introducing ANSI control sequences. */
const ESC = '\x1B'

/** A packed SDK tarball staged for install into scratch workspaces. */
interface PackedTarball {
  /** Absolute path of the staged tarball file. */
  tarballPath: string
  /** SDK version parsed from the tarball filename. */
  version: string
}

/** One entry of the JSON report `npm pack --json` prints. */
interface NpmPackReport {
  /** Filename of the tarball npm produced. */
  filename: string
}

/** Exit status and combined output of one nx child process. */
export interface NxRunResult {
  /** The child's exit code, or `null` when it was killed. */
  status: number | null
  /** stdout and stderr concatenated, since nx splits its logging across both. */
  output: string
}

/** A consumer workspace created for one suite, plus the tarball version installed into it. */
export interface ConsumerWorkspace {
  /** Scratch root holding the pristine workspace and its scenario copies. */
  workRoot: string
  /** The pristine consumer workspace with the packed tarball installed as a devDependency. */
  pristineDir: string
  /** SDK version parsed from the packed tarball's filename. */
  packedVersion: string
}

/**
 * Builds the child-process environment for commands run inside scratch workspaces.
 *
 * @returns The parent environment with the Nx daemon disabled, colors off, and agent or dry-run markers removed.
 */
function scratchEnv(): NodeJS.ProcessEnv {
  // why: The nx task runner exports FORCE_COLOR=true into the test process (task-env.js), so without this override chalk colorizes the piped child output and ANSI codes land inside asserted substrings like "UPDATE package.json".
  const env = { ...process.env, NX_DAEMON: 'false', FORCE_COLOR: 'false', NO_COLOR: '1' }
  // why: create-nx-workspace and nx switch to an AI-agent output mode when these are set; removing them keeps output identical under human and agent runs.
  delete env['CLAUDECODE']
  delete env['OPENCODE']
  // why: An inherited NX_DRY_RUN would force every generate into dry-run and NX_GENERATE_QUIET hides the install child's stdio; both would corrupt the flush-and-callback observables the suites assert on.
  delete env['NX_DRY_RUN']
  delete env['NX_GENERATE_QUIET']
  return env
}

/**
 * Removes ANSI control sequences from captured child output.
 *
 * @param text - Raw combined stdout/stderr of a child process.
 * @returns The text with every `ESC[...x` control sequence removed.
 */
function stripAnsiSequences(text: string): string {
  const segments = text.split(ESC)
  // how: Everything before the first escape character is untouched; each later segment starts where a sequence began, so its CSI body up to the final letter is dropped.
  return (
    (segments[0] ?? '') +
    segments
      .slice(1)
      .map((segment) => segment.replace(/^\[[0-9;?]*[A-Za-z]/, ''))
      .join('')
  )
}

/**
 * Locates the packed plugin tarball under `tmp/e2e-packs`, packing the built
 * dist on demand when the e2e executor has not already staged one.
 *
 * @returns The absolute tarball path and the version parsed from its filename.
 */
function resolveTarball(): PackedTarball {
  const packsDir = join(REPO_ROOT, 'tmp', 'e2e-packs')
  const staged = existsSync(packsDir) ? readdirSync(packsDir).filter((name) => TARBALL_PATTERN.test(name)) : []
  // note: Sorting makes the pick deterministic in the abnormal case of several staged versions.
  const newest = staged.sort()[staged.length - 1]
  if (newest !== undefined) {
    return { tarballPath: join(packsDir, newest), version: (newest.match(TARBALL_PATTERN) as RegExpMatchArray)[1] }
  }
  const distDir = join(REPO_ROOT, 'dist', 'libs', 'features')
  if (!existsSync(join(distDir, 'package.json'))) {
    throw new Error(`No staged tarball in ${packsDir} and no built dist at ${distDir}; build lib-features first.`)
  }
  // how: Mirrors the @hyperfrontend/package:e2e executor — npm pack inside dist, then stage the tarball under tmp/e2e-packs.
  const packed = execFileSync('npm', ['pack', '--json'], { cwd: distDir, encoding: 'utf8', timeout: 120000 })
  const filename = (JSON.parse(packed) as NpmPackReport[])[0].filename as string
  const match = filename.match(TARBALL_PATTERN)
  if (match === null) {
    throw new Error(`npm pack produced an unexpected tarball name: ${filename}`)
  }
  mkdirSync(packsDir, { recursive: true })
  try {
    renameSync(join(distDir, filename), join(packsDir, filename))
  } catch (error) {
    // why: Parallel suites can both pack when the executor staged nothing; the loser of the rename race reuses the winner's staged tarball.
    if (!existsSync(join(packsDir, filename))) {
      throw error
    }
  }
  return { tarballPath: join(packsDir, filename), version: match[1] }
}

/**
 * Creates a pristine consumer workspace and installs the packed tarball into it.
 *
 * @param prefix - Unique mkdtemp prefix so parallel suites never share a scratch root.
 * @returns The scratch root, pristine workspace path, and installed tarball version.
 */
export function createConsumerWorkspace(prefix: string): ConsumerWorkspace {
  const tarball = resolveTarball()
  const workRoot = mkdtempSync(join(tmpdir(), prefix))
  execFileSync(
    'npx',
    [
      '--yes',
      `create-nx-workspace@${NX_VERSION}`,
      'consumer',
      '--preset=ts',
      '--no-interactive',
      '--pm',
      'npm',
      '--nxCloud=skip',
      '--skipGit',
    ],
    { cwd: workRoot, env: scratchEnv(), encoding: 'utf8', timeout: WORKSPACE_CREATE_TIMEOUT }
  )
  const pristineDir = join(workRoot, 'consumer')
  // how: `nx add <pkg>` installs the plugin as a devDependency before invoking its init generator; installing the tarball the same way reproduces that starting state.
  execFileSync('npm', ['install', '--save-dev', tarball.tarballPath], {
    cwd: pristineDir,
    env: scratchEnv(),
    encoding: 'utf8',
    timeout: TARBALL_INSTALL_TIMEOUT,
  })
  return { workRoot, pristineDir, packedVersion: tarball.version }
}

/**
 * Runs the workspace-local `nx` CLI inside a scratch workspace.
 *
 * @param workspaceDir - The scratch workspace to run in.
 * @param args - Arguments passed to `nx`.
 * @param timeout - Kill timeout for the child, defaulting to the plain-command bound.
 * @returns The exit status and combined stdout/stderr, stripped of ANSI sequences.
 */
export function runNx(workspaceDir: string, args: readonly string[], timeout: number = NX_COMMAND_TIMEOUT): NxRunResult {
  const spawned = spawnSync('npx', ['nx', ...args], {
    cwd: workspaceDir,
    env: scratchEnv(),
    encoding: 'utf8',
    timeout,
  })
  const failure = spawned.error === undefined ? '' : `\nspawn error: ${String(spawned.error)}`
  // why: Colors are disabled via the environment, and stripping guards against any child that styles its output regardless.
  return { status: spawned.status, output: stripAnsiSequences(`${spawned.stdout ?? ''}${spawned.stderr ?? ''}${failure}`) }
}

/**
 * Copies a pristine workspace's files into a fresh scenario directory and
 * shares the pristine install by symlinking its node_modules.
 *
 * @param pristineWorkspace - The workspace whose files are copied.
 * @param scenarioDir - The scenario directory to create.
 */
export function copyWorkspace(pristineWorkspace: string, scenarioDir: string): void {
  cpSync(pristineWorkspace, scenarioDir, {
    recursive: true,
    filter: (source) => {
      const rel = relative(pristineWorkspace, source)
      return rel === '' || !SHARED_OR_CACHE_ENTRIES.has(rel.split(sep)[0] as string)
    },
  })
  // why: The plugin resolves from the workspace root's node_modules; linking the pristine install makes each copy a real consumer of the packed tarball, per the cli.spec.ts symlink precedent.
  symlinkSync(join(pristineWorkspace, 'node_modules'), join(scenarioDir, 'node_modules'), 'dir')
}

/**
 * Seeds the demo app fixture the feature generator scaffolds against.
 *
 * @param scenarioDir - The scenario workspace root.
 */
export function seedDemo(scenarioDir: string): void {
  mkdirSync(join(scenarioDir, 'demo', 'src'), { recursive: true })
  writeFileSync(join(scenarioDir, 'demo', 'clock.contract.json'), `${JSON.stringify(CONTRACT, null, 2)}\n`)
  writeFileSync(join(scenarioDir, 'demo', 'src', 'main.ts'), ENTRY_SOURCE)
}

/**
 * Reads a workspace's root package.json as raw text.
 *
 * @param workspaceDir - The workspace root.
 * @returns The manifest file content.
 */
export function readManifestText(workspaceDir: string): string {
  return readFileSync(join(workspaceDir, 'package.json'), 'utf8')
}

/**
 * Reads a workspace's root package.json as a parsed object.
 *
 * @param workspaceDir - The workspace root.
 * @returns The parsed manifest.
 */
export function readManifest(workspaceDir: string): Record<string, unknown> {
  return JSON.parse(readManifestText(workspaceDir)) as Record<string, unknown>
}

/**
 * Writes a workspace's root package.json with the formatting npm and the
 * generator both use: 2-space indentation and a trailing newline.
 *
 * @param workspaceDir - The workspace root.
 * @param manifest - The manifest object to serialize.
 */
export function writeManifest(workspaceDir: string, manifest: Record<string, unknown>): void {
  writeFileSync(join(workspaceDir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
}

/**
 * Returns a manifest's dependency section as a mutable string map.
 *
 * @param manifest - The parsed manifest.
 * @param section - The section name, e.g. `devDependencies`.
 * @returns The section object, or an empty map when absent.
 */
export function sectionOf(manifest: Record<string, unknown>, section: string): Record<string, string> {
  return (manifest[section] ?? {}) as Record<string, string>
}

/**
 * Reads a workspace's root package-lock.json as raw text.
 *
 * @param workspaceDir - The workspace root.
 * @returns The lockfile content.
 */
export function readLockText(workspaceDir: string): string {
  return readFileSync(join(workspaceDir, 'package-lock.json'), 'utf8')
}

/**
 * Reads the `dependencies` map of a lockfile's root package entry.
 *
 * @param workspaceDir - Absolute path of the scenario workspace whose lockfile is parsed.
 * @returns The root entry's dependencies, or an empty map when absent.
 */
export function lockRootDependencies(workspaceDir: string): Record<string, string> {
  const lock = JSON.parse(readLockText(workspaceDir)) as Record<string, unknown>
  const packages = (lock['packages'] ?? {}) as Record<string, Record<string, unknown>>
  return (packages['']?.['dependencies'] ?? {}) as Record<string, string>
}
