/**
 * Packed-tarball Nx plugin E2E tests for the generator callback and tree-staging
 * behavior of @hyperfrontend/features: the `init` generator's post-flush package
 * manager install, dependency self-healing in the `feature` generator, honest
 * `--dry-run` staging, idempotent re-runs, and partial-apply recovery.
 */

import { execFileSync, spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, sep } from 'node:path'

// note: Pinned to this repo's own Nx version so the generators are exercised against the exact runtime consumers of this workspace's tooling get.
const NX_VERSION = '22.7.8'

// note: 10 minutes: create-nx-workspace runs a real npm install over the network, then the packed SDK tarball installs on top of it.
const SETUP_TIMEOUT = 600000

// note: 4 minutes covers up to two cold nx invocations (daemon disabled) plus the workspace file copy on slow CI hosts.
const SCENARIO_TIMEOUT = 240000

// note: 90s bounds one cold nx process so a hung child fails the suite instead of blocking the jest worker forever.
const NX_COMMAND_TIMEOUT = 90000

// note: 3 minutes bounds an nx run whose generator callback additionally spawns a package-manager reconcile of the workspace tree.
const NX_INSTALL_COMMAND_TIMEOUT = 180000

const PLUGIN_NAME = '@hyperfrontend/features'
const REPO_ROOT = join(__dirname, '..', '..', '..', '..')
const TARBALL_PATTERN = /^hyperfrontend-features-(.+)\.tgz$/

// why: npm >= 7 always closes an install with an "audited N packages" summary (plus added/removed counts when the tree changed); installPackagesTask inherits stdio, so this chatter lands in the captured nx output exactly when a package-manager child ran.
const INSTALL_OUTPUT_PATTERN = /audited \d+ packages|added \d+ packages?|removed \d+ packages?/

// note: Top-level entries never copied into scenario workspaces — the install is shared via symlink and the caches are per-workspace state.
const SHARED_OR_CACHE_ENTRIES: ReadonlySet<string> = new Set(['node_modules', '.git', '.nx'])

// note: Mirrors the contract nx-plugin.spec.ts feeds the feature generator, as JSON because the generator accepts .json contracts without any TypeScript loader.
const CONTRACT = {
  emitted: [{ type: 'tick', description: 'Time snapshot the feature streams to its host.' }],
  accepted: [{ type: 'ping', description: 'Liveness probe the host sends to the feature.' }],
}

const ENTRY_SOURCE = "console.log('demo app entry')\n"

// note: Mirrors the flag set nx-plugin.spec.ts drives, so re-run and partial-apply behavior is pinned against the same scaffold shape.
const FEATURE_ARGS: readonly string[] = [
  'g',
  `${PLUGIN_NAME}:feature`,
  '--name=clock',
  '--contract=./clock.contract.json',
  '--entry=src/main.ts',
  '--directory=demo',
]

/** Exit status and combined output of one nx child process. */
interface NxRunResult {
  /** The child's exit code, or `null` when it was killed. */
  status: number | null
  /** stdout and stderr concatenated, since nx splits its logging across both. */
  output: string
}

/**
 * Builds the child-process environment for commands run inside scratch workspaces.
 *
 * @returns The parent environment with the Nx daemon disabled and agent markers removed.
 */
function scratchEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env, NX_DAEMON: 'false' }
  // why: create-nx-workspace and nx switch to an AI-agent output mode when these are set; removing them keeps output identical under human and agent runs.
  delete env['CLAUDECODE']
  delete env['OPENCODE']
  // why: An inherited NX_DRY_RUN would force every generate into dry-run and NX_GENERATE_QUIET hides the install child's stdio; both would corrupt the flush-and-callback observables these scenarios assert on.
  delete env['NX_DRY_RUN']
  delete env['NX_GENERATE_QUIET']
  return env
}

/**
 * Locates the packed plugin tarball under `tmp/e2e-packs`, packing the built
 * dist on demand when the e2e executor has not already staged one.
 *
 * @returns The absolute tarball path and the version parsed from its filename.
 */
function resolveTarball(): { tarballPath: string; version: string } {
  const packsDir = join(REPO_ROOT, 'tmp', 'e2e-packs')
  const staged = existsSync(packsDir) ? readdirSync(packsDir).filter((name) => TARBALL_PATTERN.test(name)) : []
  // note: Sorting makes the pick deterministic in the abnormal case of several staged versions.
  const newest = staged.sort()[staged.length - 1]
  if (newest !== undefined) {
    return { tarballPath: join(packsDir, newest), version: (<RegExpMatchArray>newest.match(TARBALL_PATTERN))[1] }
  }
  const distDir = join(REPO_ROOT, 'dist', 'libs', 'features')
  if (!existsSync(join(distDir, 'package.json'))) {
    throw new Error(`No staged tarball in ${packsDir} and no built dist at ${distDir}; build lib-features first.`)
  }
  // how: Mirrors the @hyperfrontend/package:e2e executor — npm pack inside dist, then stage the tarball under tmp/e2e-packs.
  const packed = execFileSync('npm', ['pack', '--json'], { cwd: distDir, encoding: 'utf8', timeout: 120000 })
  const filename = <string>(<{ filename: string }[]>JSON.parse(packed))[0].filename
  const match = filename.match(TARBALL_PATTERN)
  if (match === null) {
    throw new Error(`npm pack produced an unexpected tarball name: ${filename}`)
  }
  mkdirSync(packsDir, { recursive: true })
  renameSync(join(distDir, filename), join(packsDir, filename))
  return { tarballPath: join(packsDir, filename), version: match[1] }
}

/**
 * Runs the workspace-local `nx` CLI inside a scratch workspace.
 *
 * @param workspaceDir - The scratch workspace to run in.
 * @param args - Arguments passed to `nx`.
 * @param timeout - Kill timeout for the child, defaulting to the plain-command bound.
 * @returns The exit status and combined stdout/stderr.
 */
function runNx(workspaceDir: string, args: readonly string[], timeout: number = NX_COMMAND_TIMEOUT): NxRunResult {
  const spawned = spawnSync('npx', ['nx', ...args], {
    cwd: workspaceDir,
    env: scratchEnv(),
    encoding: 'utf8',
    timeout,
  })
  const failure = spawned.error === undefined ? '' : `\nspawn error: ${String(spawned.error)}`
  return { status: spawned.status, output: `${spawned.stdout ?? ''}${spawned.stderr ?? ''}${failure}` }
}

/**
 * Copies a pristine workspace's files into a fresh scenario directory and
 * shares the pristine install by symlinking its node_modules.
 *
 * @param pristineWorkspace - The workspace whose files are copied.
 * @param scenarioDir - The scenario directory to create.
 */
function copyWorkspace(pristineWorkspace: string, scenarioDir: string): void {
  cpSync(pristineWorkspace, scenarioDir, {
    recursive: true,
    filter: (source) => {
      const rel = relative(pristineWorkspace, source)
      return rel === '' || !SHARED_OR_CACHE_ENTRIES.has(<string>rel.split(sep)[0])
    },
  })
  // why: The plugin resolves from the workspace root's node_modules; linking the pristine install makes each copy a real consumer of the packed tarball, per the nx-plugin.spec.ts symlink precedent.
  symlinkSync(join(pristineWorkspace, 'node_modules'), join(scenarioDir, 'node_modules'), 'dir')
}

/**
 * Seeds the demo app fixture the feature generator scaffolds against.
 *
 * @param scenarioDir - The scenario workspace root.
 */
function seedDemo(scenarioDir: string): void {
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
function readManifestText(workspaceDir: string): string {
  return readFileSync(join(workspaceDir, 'package.json'), 'utf8')
}

/**
 * Reads a workspace's root package.json as a parsed object.
 *
 * @param workspaceDir - The workspace root.
 * @returns The parsed manifest.
 */
function readManifest(workspaceDir: string): Record<string, unknown> {
  return <Record<string, unknown>>JSON.parse(readManifestText(workspaceDir))
}

/**
 * Writes a workspace's root package.json with the formatting npm and the
 * generator both use: 2-space indentation and a trailing newline.
 *
 * @param workspaceDir - The workspace root.
 * @param manifest - The manifest object to serialize.
 */
function writeManifest(workspaceDir: string, manifest: Record<string, unknown>): void {
  writeFileSync(join(workspaceDir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
}

/**
 * Returns a manifest's dependency section as a mutable string map.
 *
 * @param manifest - The parsed manifest.
 * @param section - The section name, e.g. `devDependencies`.
 * @returns The section object, or an empty map when absent.
 */
function sectionOf(manifest: Record<string, unknown>, section: string): Record<string, string> {
  return <Record<string, string>>(manifest[section] ?? {})
}

/**
 * Reads a workspace's root package-lock.json as raw text.
 *
 * @param workspaceDir - The workspace root.
 * @returns The lockfile content.
 */
function readLockText(workspaceDir: string): string {
  return readFileSync(join(workspaceDir, 'package-lock.json'), 'utf8')
}

/**
 * Reads the `dependencies` map of a lockfile's root package entry.
 *
 * @param workspaceDir - Absolute path of the scenario workspace whose lockfile is parsed.
 * @returns The root entry's dependencies, or an empty map when absent.
 */
function lockRootDependencies(workspaceDir: string): Record<string, string> {
  const lock = <Record<string, unknown>>JSON.parse(readLockText(workspaceDir))
  const packages = <Record<string, Record<string, unknown>>>(lock['packages'] ?? {})
  return <Record<string, string>>(packages['']?.['dependencies'] ?? {})
}

describe('@hyperfrontend/features Nx plugin callbacks and tree staging', () => {
  let workRoot: string
  let pristineDir: string
  let packedVersion: string

  beforeAll(() => {
    const tarball = resolveTarball()
    packedVersion = tarball.version
    workRoot = mkdtempSync(join(tmpdir(), 'hf-nx-cb-e2e-'))
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
      { cwd: workRoot, env: scratchEnv(), encoding: 'utf8', timeout: 480000 }
    )
    pristineDir = join(workRoot, 'consumer')
    // how: `nx add <pkg>` installs the plugin as a devDependency before invoking its init generator; installing the tarball the same way reproduces that starting state.
    execFileSync('npm', ['install', '--save-dev', tarball.tarballPath], {
      cwd: pristineDir,
      env: scratchEnv(),
      encoding: 'utf8',
      timeout: 300000,
    })
  }, SETUP_TIMEOUT)

  afterAll(() => {
    rmSync(workRoot, { recursive: true, force: true })
  })

  describe('init on a workspace whose manifest lacks the declaration', () => {
    let result: NxRunResult
    let afterManifest: Record<string, unknown>
    let lockBefore: string
    let lockAfter: string
    let lockDepsAfter: Record<string, string>

    beforeAll(() => {
      const scenarioDir = join(workRoot, 'scenario-init-installs')
      copyWorkspace(pristineDir, scenarioDir)
      const manifest = readManifest(scenarioDir)
      delete sectionOf(manifest, 'devDependencies')[PLUGIN_NAME]
      writeManifest(scenarioDir, manifest)
      lockBefore = readLockText(scenarioDir)
      // note: The pristine lock already resolves the plugin at the packed version from the local tarball, so the ^-range the generator writes re-validates offline against the existing node instead of hitting the registry.
      result = runNx(scenarioDir, ['g', `${PLUGIN_NAME}:init`], NX_INSTALL_COMMAND_TIMEOUT)
      afterManifest = readManifest(scenarioDir)
      lockAfter = readLockText(scenarioDir)
      lockDepsAfter = lockRootDependencies(scenarioDir)
    }, SCENARIO_TIMEOUT)

    it('exits 0 and stages the manifest update', () => {
      expect(result.status).toBe(0)
      expect(result.output).toContain('UPDATE package.json')
    })

    it('adds the declaration to dependencies pinned to the packed version', () => {
      expect(sectionOf(afterManifest, 'dependencies')[PLUGIN_NAME]).toBe(`^${packedVersion}`)
    })

    it('runs the package manager install after the flush', () => {
      // why: nx flushes only tree-staged files and the generator never stages package-lock.json, so a rewritten lock whose root entry lists the plugin proves a real package-manager child reconciled the flushed manifest (npm's human-readable output and file mtimes both vary across versions and filesystems).
      expect(lockAfter).not.toBe(lockBefore)
      expect(lockDepsAfter[PLUGIN_NAME]).toBe(`^${packedVersion}`)
      // note: The install child reconciles an unchanged package tree, so the only write through the shared node_modules symlink is npm's hidden lockfile, which no other scenario reads.
    })
  })

  describe('init on a workspace already declaring the dependency', () => {
    let before: string
    let lockBefore: string
    let result: NxRunResult
    let after: string
    let lockAfter: string

    beforeAll(() => {
      const scenarioDir = join(workRoot, 'scenario-init-satisfied')
      copyWorkspace(pristineDir, scenarioDir)
      before = readManifestText(scenarioDir)
      lockBefore = readLockText(scenarioDir)
      result = runNx(scenarioDir, ['g', `${PLUGIN_NAME}:init`])
      after = readManifestText(scenarioDir)
      lockAfter = readLockText(scenarioDir)
    }, SCENARIO_TIMEOUT)

    it('exits 0 without staging a manifest change', () => {
      expect(result.status).toBe(0)
      expect(result.output).not.toContain('UPDATE package.json')
    })

    it('leaves package.json byte-identical', () => {
      expect(after).toBe(before)
    })

    it('runs no install', () => {
      // why: A spurious npm run here would rewrite the lock to identical bytes, so byte-equality alone cannot detect it; the absence of npm's install summary in the inherited stdio is the direct no-install evidence, with lock equality guarding content-level drift.
      expect(result.output).not.toMatch(INSTALL_OUTPUT_PATTERN)
      expect(lockAfter).toBe(lockBefore)
    })
  })

  describe('init --dry-run on a workspace whose manifest lacks the declaration', () => {
    let before: string
    let lockBefore: string
    let result: NxRunResult
    let after: string
    let lockAfter: string

    beforeAll(() => {
      const scenarioDir = join(workRoot, 'scenario-init-dry-run')
      copyWorkspace(pristineDir, scenarioDir)
      const manifest = readManifest(scenarioDir)
      delete sectionOf(manifest, 'devDependencies')[PLUGIN_NAME]
      writeManifest(scenarioDir, manifest)
      before = readManifestText(scenarioDir)
      lockBefore = readLockText(scenarioDir)
      result = runNx(scenarioDir, ['g', `${PLUGIN_NAME}:init`, '--dry-run'])
      after = readManifestText(scenarioDir)
      lockAfter = readLockText(scenarioDir)
    }, SCENARIO_TIMEOUT)

    it('exits 0 and previews the staged update', () => {
      expect(result.status).toBe(0)
      expect(result.output).toContain('UPDATE package.json')
    })

    it('leaves the manifest on disk untouched', () => {
      expect(after).toBe(before)
    })

    it('skips the install callback', () => {
      // why: nx awaits generator callbacks only after flushChanges and skips both under --dry-run; an install here would have reconciled the on-disk manifest (which still lacks the declaration) and rewritten the lock, so lock equality plus chatter absence pins the skip.
      expect(result.output).not.toMatch(INSTALL_OUTPUT_PATTERN)
      expect(lockAfter).toBe(lockBefore)
    })
  })

  describe('feature generator on a workspace with no SDK declaration', () => {
    let scenarioDir: string
    let result: NxRunResult
    let afterManifest: Record<string, unknown>

    beforeAll(() => {
      scenarioDir = join(workRoot, 'scenario-feature-heals-dep')
      copyWorkspace(pristineDir, scenarioDir)
      const manifest = readManifest(scenarioDir)
      delete sectionOf(manifest, 'devDependencies')[PLUGIN_NAME]
      writeManifest(scenarioDir, manifest)
      seedDemo(scenarioDir)
      result = runNx(scenarioDir, [...FEATURE_ARGS], NX_INSTALL_COMMAND_TIMEOUT)
      afterManifest = readManifest(scenarioDir)
    }, SCENARIO_TIMEOUT)

    it('exits 0', () => {
      expect(result.status).toBe(0)
    })

    it('adds the missing declaration to the dependencies section', () => {
      expect(sectionOf(afterManifest, 'dependencies')[PLUGIN_NAME]).toBe(`^${packedVersion}`)
    })

    it('still scaffolds the feature files', () => {
      expect(existsSync(join(scenarioDir, 'demo', 'feature.config.json'))).toBe(true)
      expect(existsSync(join(scenarioDir, 'demo', 'src', 'hyperfrontend.feature.ts'))).toBe(true)
    })
  })

  describe('feature generator --dry-run', () => {
    let scenarioDir: string
    let manifestBefore: string
    let entryBefore: string
    let result: NxRunResult

    beforeAll(() => {
      scenarioDir = join(workRoot, 'scenario-feature-dry-run')
      copyWorkspace(pristineDir, scenarioDir)
      seedDemo(scenarioDir)
      manifestBefore = readManifestText(scenarioDir)
      entryBefore = readFileSync(join(scenarioDir, 'demo', 'src', 'main.ts'), 'utf8')
      result = runNx(scenarioDir, [...FEATURE_ARGS, '--dry-run'])
    }, SCENARIO_TIMEOUT)

    it('exits 0 and previews the staged scaffold', () => {
      expect(result.status).toBe(0)
      // note: nx prints the staged change list on dry runs, which is the observable that the scaffold now stages through the Nx tree instead of writing straight to disk.
      expect(result.output).toMatch(/CREATE\s+demo\/feature\.config\.json/)
    })

    it('creates no files on disk', () => {
      expect(existsSync(join(scenarioDir, 'demo', 'feature.config.json'))).toBe(false)
      expect(existsSync(join(scenarioDir, 'demo', 'src', 'hyperfrontend.feature.ts'))).toBe(false)
    })

    it('leaves the entry file and manifest untouched', () => {
      expect(readFileSync(join(scenarioDir, 'demo', 'src', 'main.ts'), 'utf8')).toBe(entryBefore)
      expect(readManifestText(scenarioDir)).toBe(manifestBefore)
    })
  })

  describe('feature generator re-run with the same flags', () => {
    let scenarioDir: string
    let firstRun: NxRunResult
    let configAfterFirst: string
    let glueAfterFirst: string
    let entryAfterFirst: string
    let secondRun: NxRunResult
    let configAfterSecond: string
    let glueAfterSecond: string
    let entryAfterSecond: string

    beforeAll(() => {
      scenarioDir = join(workRoot, 'scenario-feature-rerun')
      copyWorkspace(pristineDir, scenarioDir)
      seedDemo(scenarioDir)
      firstRun = runNx(scenarioDir, [...FEATURE_ARGS])
      configAfterFirst = readFileSync(join(scenarioDir, 'demo', 'feature.config.json'), 'utf8')
      glueAfterFirst = readFileSync(join(scenarioDir, 'demo', 'src', 'hyperfrontend.feature.ts'), 'utf8')
      entryAfterFirst = readFileSync(join(scenarioDir, 'demo', 'src', 'main.ts'), 'utf8')
      secondRun = runNx(scenarioDir, [...FEATURE_ARGS])
      configAfterSecond = readFileSync(join(scenarioDir, 'demo', 'feature.config.json'), 'utf8')
      glueAfterSecond = readFileSync(join(scenarioDir, 'demo', 'src', 'hyperfrontend.feature.ts'), 'utf8')
      entryAfterSecond = readFileSync(join(scenarioDir, 'demo', 'src', 'main.ts'), 'utf8')
    }, SCENARIO_TIMEOUT)

    it('exits 0 on both runs', () => {
      expect(firstRun.status).toBe(0)
      expect(secondRun.status).toBe(0)
    })

    it('does not duplicate the marker block in the entry file', () => {
      // note: The closing marker is `</hf:feature>`, which never matches the opening token, so one match means exactly one managed block.
      expect((entryAfterSecond.match(/<hf:feature>/g) ?? []).length).toBe(1)
      expect(entryAfterSecond).toBe(entryAfterFirst)
    })

    it('keeps the config and glue module byte-identical across runs', () => {
      expect(configAfterSecond).toBe(configAfterFirst)
      expect(glueAfterSecond).toBe(glueAfterFirst)
    })

    it('reports the skips truthfully in the summary', () => {
      // note: The exact summary wording is not pinned; the contract is that a re-run stops claiming fresh creations and names what it preserved.
      expect(secondRun.output).not.toContain('created 2')
      expect(secondRun.output).toMatch(/kept|skipped|up to date/i)
    })
  })

  describe('feature generator after a partial delete of the config file', () => {
    let scenarioDir: string
    let glueBefore: string
    let entryBefore: string
    let secondRun: NxRunResult
    let configJson: Record<string, unknown>

    beforeAll(() => {
      scenarioDir = join(workRoot, 'scenario-feature-partial')
      copyWorkspace(pristineDir, scenarioDir)
      seedDemo(scenarioDir)
      const firstRun = runNx(scenarioDir, [...FEATURE_ARGS])
      if (firstRun.status !== 0) {
        throw new Error(`initial scaffold failed:\n${firstRun.output}`)
      }
      glueBefore = readFileSync(join(scenarioDir, 'demo', 'src', 'hyperfrontend.feature.ts'), 'utf8')
      entryBefore = readFileSync(join(scenarioDir, 'demo', 'src', 'main.ts'), 'utf8')
      rmSync(join(scenarioDir, 'demo', 'feature.config.json'))
      secondRun = runNx(scenarioDir, [...FEATURE_ARGS])
      configJson = <Record<string, unknown>>JSON.parse(readFileSync(join(scenarioDir, 'demo', 'feature.config.json'), 'utf8'))
    }, SCENARIO_TIMEOUT)

    it('exits 0 and recreates the deleted config file', () => {
      expect(secondRun.status).toBe(0)
      // note: toMatchObject keeps the pin additive-safe in case the config gains persisted keys later; these four are the scaffold's contract.
      expect(configJson).toMatchObject({
        $schema: 'https://hyperfrontend.dev/schemas/feature.config.json',
        name: 'clock',
        version: '0.1.0',
        contract: './clock.contract.json',
      })
    })

    it('leaves the glue module and entry wiring untouched', () => {
      expect(readFileSync(join(scenarioDir, 'demo', 'src', 'hyperfrontend.feature.ts'), 'utf8')).toBe(glueBefore)
      expect(readFileSync(join(scenarioDir, 'demo', 'src', 'main.ts'), 'utf8')).toBe(entryBefore)
    })
  })
})
