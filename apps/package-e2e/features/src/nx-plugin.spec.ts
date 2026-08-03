/**
 * Packed-tarball Nx plugin E2E tests for @hyperfrontend/features.
 * Drives the `init` and `feature` generators the way a consumer does: inside a
 * real Nx workspace created by the official create-nx-workspace generator, with
 * the packed tarball installed the way `nx add` installs a plugin.
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

const PLUGIN_NAME = '@hyperfrontend/features'
const REPO_ROOT = join(__dirname, '..', '..', '..', '..')
const TARBALL_PATTERN = /^hyperfrontend-features-(.+)\.tgz$/

// note: Top-level entries never copied into scenario workspaces — the install is shared via symlink and the caches are per-workspace state.
const SHARED_OR_CACHE_ENTRIES: ReadonlySet<string> = new Set(['node_modules', '.git', '.nx'])

// note: Mirrors the contract cli.spec.ts feeds `hf build`, as JSON because the generator accepts .json contracts without any TypeScript loader.
const CONTRACT = {
  emitted: [{ type: 'tick', description: 'Time snapshot the feature streams to its host.' }],
  accepted: [{ type: 'ping', description: 'Liveness probe the host sends to the feature.' }],
}

const ENTRY_SOURCE = "console.log('demo app entry')\n"

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
 * @returns The exit status and combined stdout/stderr.
 */
function runNx(workspaceDir: string, args: readonly string[]): NxRunResult {
  const spawned = spawnSync('npx', ['nx', ...args], {
    cwd: workspaceDir,
    env: scratchEnv(),
    encoding: 'utf8',
    timeout: NX_COMMAND_TIMEOUT,
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
  // why: The plugin resolves from the workspace root's node_modules; linking the pristine install makes each copy a real consumer of the packed tarball, per the cli.spec.ts symlink precedent.
  symlinkSync(join(pristineWorkspace, 'node_modules'), join(scenarioDir, 'node_modules'), 'dir')
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

describe('@hyperfrontend/features Nx plugin', () => {
  let workRoot: string
  let pristineDir: string
  let packedVersion: string

  beforeAll(() => {
    const tarball = resolveTarball()
    packedVersion = tarball.version
    workRoot = mkdtempSync(join(tmpdir(), 'hf-nx-e2e-'))
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

  describe('nx list @hyperfrontend/features', () => {
    let result: NxRunResult

    beforeAll(() => {
      result = runNx(pristineDir, ['list', PLUGIN_NAME])
    }, SCENARIO_TIMEOUT)

    it('exits 0', () => {
      expect(result.status).toBe(0)
    })

    it('names the init and feature generators', () => {
      expect(result.output).toContain('init : Ensure @hyperfrontend/features is declared in the workspace')
      expect(result.output).toContain('feature : Scaffold a hyperfrontend feature via the SDK.')
    })

    it('names the build and serve executors', () => {
      expect(result.output).toContain("build : Build a hyperfrontend feature's shell package via the SDK.")
      expect(result.output).toContain('serve : Serve a hyperfrontend feature dev server via the SDK.')
    })
  })

  describe('init on a fresh workspace as nx add leaves it', () => {
    let scenarioDir: string
    let installedDeclaration: string | undefined
    let before: string
    let result: NxRunResult
    let after: string

    beforeAll(() => {
      scenarioDir = join(workRoot, 'scenario-fresh')
      copyWorkspace(pristineDir, scenarioDir)
      installedDeclaration = sectionOf(readManifest(scenarioDir), 'devDependencies')[PLUGIN_NAME]
      before = readManifestText(scenarioDir)
      result = runNx(scenarioDir, ['g', `${PLUGIN_NAME}:init`])
      after = readManifestText(scenarioDir)
    }, SCENARIO_TIMEOUT)

    it('starts from the tarball install declared in devDependencies', () => {
      expect(installedDeclaration).toMatch(/hyperfrontend-features-.+\.tgz$/)
    })

    it('exits 0 without staging a manifest change', () => {
      expect(result.status).toBe(0)
      expect(result.output).toContain(`Generating ${PLUGIN_NAME}:init`)
      expect(result.output).not.toContain('UPDATE package.json')
    })

    it('leaves package.json byte-identical', () => {
      expect(after).toBe(before)
    })
  })

  describe('init when the declaration already lives in dependencies', () => {
    let before: string
    let result: NxRunResult
    let after: string

    beforeAll(() => {
      const scenarioDir = join(workRoot, 'scenario-declared-in-deps')
      copyWorkspace(pristineDir, scenarioDir)
      const manifest = readManifest(scenarioDir)
      const devDeps = sectionOf(manifest, 'devDependencies')
      const installedDeclaration = <string>devDeps[PLUGIN_NAME]
      delete devDeps[PLUGIN_NAME]
      manifest['dependencies'] = { [PLUGIN_NAME]: installedDeclaration }
      writeManifest(scenarioDir, manifest)
      before = readManifestText(scenarioDir)
      result = runNx(scenarioDir, ['g', `${PLUGIN_NAME}:init`])
      after = readManifestText(scenarioDir)
    }, SCENARIO_TIMEOUT)

    it('exits 0 without staging a manifest change', () => {
      expect(result.status).toBe(0)
      expect(result.output).not.toContain('UPDATE package.json')
    })

    it('leaves package.json byte-identical', () => {
      expect(after).toBe(before)
    })
  })

  describe('init when the declaration is missing', () => {
    let seededKeys: string[]
    let result: NxRunResult
    let afterFirstRun: string
    let afterManifest: Record<string, unknown>
    let secondRun: NxRunResult
    let afterSecondRun: string

    beforeAll(() => {
      const scenarioDir = join(workRoot, 'scenario-missing-declaration')
      copyWorkspace(pristineDir, scenarioDir)
      const manifest = readManifest(scenarioDir)
      const devDeps = sectionOf(manifest, 'devDependencies')
      delete devDeps[PLUGIN_NAME]
      // how: prettier moves from devDependencies into a seeded dependencies section so the run exercises insertion into an existing, non-empty section.
      const prettierRange = <string>devDeps['prettier']
      delete devDeps['prettier']
      manifest['dependencies'] = { prettier: prettierRange }
      writeManifest(scenarioDir, manifest)
      seededKeys = Object.keys(readManifest(scenarioDir))
      result = runNx(scenarioDir, ['g', `${PLUGIN_NAME}:init`])
      afterFirstRun = readManifestText(scenarioDir)
      afterManifest = readManifest(scenarioDir)
      secondRun = runNx(scenarioDir, ['g', `${PLUGIN_NAME}:init`])
      afterSecondRun = readManifestText(scenarioDir)
    }, SCENARIO_TIMEOUT)

    it('exits 0 and stages the manifest update', () => {
      expect(result.status).toBe(0)
      expect(result.output).toContain('UPDATE package.json')
    })

    it('adds the declaration to dependencies pinned to the packed version', () => {
      expect(sectionOf(afterManifest, 'dependencies')[PLUGIN_NAME]).toBe(`^${packedVersion}`)
    })

    it('preserves the existing dependency entries and key order', () => {
      expect(Object.keys(sectionOf(afterManifest, 'dependencies'))).toEqual(['prettier', PLUGIN_NAME])
      expect(Object.keys(afterManifest)).toEqual(seededKeys)
    })

    it('writes 2-space indentation and a single trailing newline', () => {
      // how: Re-serializing the parsed manifest with the expected formatting and comparing bytes proves indentation, key order, and the exact trailing newline at once.
      expect(afterFirstRun).toBe(`${JSON.stringify(afterManifest, null, 2)}\n`)
      expect(afterFirstRun.endsWith('\n')).toBe(true)
      expect(afterFirstRun.endsWith('\n\n')).toBe(false)
    })

    it('is idempotent across a second run', () => {
      expect(secondRun.status).toBe(0)
      expect(afterSecondRun).toBe(afterFirstRun)
    })
  })

  describe('init when no section declares the plugin and dependencies is absent', () => {
    let result: NxRunResult
    let afterManifest: Record<string, unknown>

    beforeAll(() => {
      const scenarioDir = join(workRoot, 'scenario-no-sections')
      copyWorkspace(pristineDir, scenarioDir)
      const manifest = readManifest(scenarioDir)
      delete manifest['dependencies']
      delete manifest['devDependencies']
      writeManifest(scenarioDir, manifest)
      result = runNx(scenarioDir, ['g', `${PLUGIN_NAME}:init`])
      afterManifest = readManifest(scenarioDir)
    }, SCENARIO_TIMEOUT)

    it('exits 0 and stages the manifest update', () => {
      expect(result.status).toBe(0)
      expect(result.output).toContain('UPDATE package.json')
    })

    it('creates a dependencies section holding only the declaration', () => {
      expect(afterManifest['dependencies']).toEqual({ [PLUGIN_NAME]: `^${packedVersion}` })
    })

    it('appends the new dependencies section after the existing keys', () => {
      const keys = Object.keys(afterManifest)
      expect(keys[keys.length - 1]).toBe('dependencies')
    })
  })

  describe('init with conflicting declarations in two sections', () => {
    let scenarioDir: string
    let before: string
    let defaultRun: NxRunResult
    let afterDefaultRun: string
    let repinRun: NxRunResult
    let repinnedManifest: Record<string, unknown>

    beforeAll(() => {
      scenarioDir = join(workRoot, 'scenario-conflicting')
      copyWorkspace(pristineDir, scenarioDir)
      const manifest = readManifest(scenarioDir)
      // how: The devDependencies entry keeps its position with a plain semver range while a second, different range is seeded into dependencies.
      sectionOf(manifest, 'devDependencies')[PLUGIN_NAME] = '0.2.5'
      manifest['dependencies'] = { [PLUGIN_NAME]: '~0.3.0' }
      writeManifest(scenarioDir, manifest)
      before = readManifestText(scenarioDir)
      defaultRun = runNx(scenarioDir, ['g', `${PLUGIN_NAME}:init`])
      afterDefaultRun = readManifestText(scenarioDir)
      repinRun = runNx(scenarioDir, ['g', `${PLUGIN_NAME}:init`, '--keepExistingVersions=false'])
      repinnedManifest = readManifest(scenarioDir)
    }, SCENARIO_TIMEOUT)

    it('treats either declaration as satisfying by default', () => {
      expect(defaultRun.status).toBe(0)
      expect(afterDefaultRun).toBe(before)
    })

    it('re-pins both sections when keepExistingVersions is false', () => {
      expect(repinRun.status).toBe(0)
      expect(sectionOf(repinnedManifest, 'dependencies')[PLUGIN_NAME]).toBe(`^${packedVersion}`)
      expect(sectionOf(repinnedManifest, 'devDependencies')[PLUGIN_NAME]).toBe(`^${packedVersion}`)
    })
  })

  describe('init --dry-run', () => {
    let before: string
    let result: NxRunResult
    let after: string

    beforeAll(() => {
      const scenarioDir = join(workRoot, 'scenario-dry-run')
      copyWorkspace(pristineDir, scenarioDir)
      const manifest = readManifest(scenarioDir)
      delete sectionOf(manifest, 'devDependencies')[PLUGIN_NAME]
      writeManifest(scenarioDir, manifest)
      before = readManifestText(scenarioDir)
      result = runNx(scenarioDir, ['g', `${PLUGIN_NAME}:init`, '--dry-run'])
      after = readManifestText(scenarioDir)
    }, SCENARIO_TIMEOUT)

    it('exits 0 and previews the staged update', () => {
      expect(result.status).toBe(0)
      expect(result.output).toContain('UPDATE package.json')
    })

    it('leaves package.json on disk untouched', () => {
      // why: The generator reads and writes only through the Nx tree, so the previewed update must never reach the disk.
      expect(after).toBe(before)
    })
  })

  describe('feature generator', () => {
    let scenarioDir: string
    let result: NxRunResult
    let configJson: Record<string, unknown>
    let glueModule: string
    let entryFile: string
    let showProjects: NxRunResult

    beforeAll(() => {
      scenarioDir = join(workRoot, 'scenario-feature')
      copyWorkspace(pristineDir, scenarioDir)
      mkdirSync(join(scenarioDir, 'demo', 'src'), { recursive: true })
      writeFileSync(join(scenarioDir, 'demo', 'clock.contract.json'), `${JSON.stringify(CONTRACT, null, 2)}\n`)
      writeFileSync(join(scenarioDir, 'demo', 'src', 'main.ts'), ENTRY_SOURCE)
      result = runNx(scenarioDir, [
        'g',
        `${PLUGIN_NAME}:feature`,
        '--name=clock',
        '--contract=./clock.contract.json',
        '--entry=src/main.ts',
        '--directory=demo',
      ])
      configJson = <Record<string, unknown>>JSON.parse(readFileSync(join(scenarioDir, 'demo', 'feature.config.json'), 'utf8'))
      glueModule = readFileSync(join(scenarioDir, 'demo', 'src', 'hyperfrontend.feature.ts'), 'utf8')
      entryFile = readFileSync(join(scenarioDir, 'demo', 'src', 'main.ts'), 'utf8')
      showProjects = runNx(scenarioDir, ['show', 'projects'])
    }, SCENARIO_TIMEOUT)

    it('exits 0 and reports the scaffold summary', () => {
      expect(result.status).toBe(0)
      expect(result.output).toContain('Scaffolded feature "clock" (created 3, updated 1, kept 0)')
    })

    it('writes feature.config.json into the target directory', () => {
      // note: toMatchObject keeps the assertion stable as the SDK persists further machine-owned keys.
      expect(configJson).toMatchObject({
        $schema: 'https://hyperfrontend.dev/schemas/feature.config.json',
        name: 'clock',
        version: '0.1.0',
        contract: './clock.contract.json',
        url: '/',
      })
    })

    it('scaffolds the hostee glue module beside the entry file', () => {
      expect(glueModule).toContain("import { createFeature } from '@hyperfrontend/features/hostee'")
      expect(glueModule).toContain("import contract from '../clock.contract'")
      expect(glueModule).toContain("export const feature = createFeature({ name: 'clock', version: '0.1.0', contract })")
    })

    it('stubs a handler per accepted action and an example send per emitted action', () => {
      expect(glueModule).toContain("feature.on('ping', (_data: unknown) => {")
      expect(glueModule).toContain("// feature.send('tick', undefined)")
    })

    it('wires the marker-guarded glue import into the entry file', () => {
      const markerBlock = `// <hf:feature> — managed by @hyperfrontend/features; safe to keep\nimport './hyperfrontend.feature'\n// </hf:feature>\n`
      expect(entryFile).toBe(`${markerBlock}\n${ENTRY_SOURCE}`)
    })

    it('keeps the workspace project graph loadable after scaffolding', () => {
      expect(showProjects.status).toBe(0)
    })
  })
})
