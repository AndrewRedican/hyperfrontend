/**
 * Packed-tarball Nx plugin E2E tests for the generator callback and tree-staging
 * behavior of `@hyperfrontend/features`: the `init` generator's post-flush package
 * manager install, dependency self-healing in the `feature` generator, honest
 * `--dry-run` staging, idempotent re-runs, and partial-apply recovery.
 */

import type { ConsumerWorkspace, NxRunResult } from './support/nx-workspace'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import {
  FEATURE_ARGS,
  INSTALL_OUTPUT_PATTERN,
  NX_INSTALL_COMMAND_TIMEOUT,
  PLUGIN_NAME,
  SCENARIO_TIMEOUT,
  SETUP_TIMEOUT,
  copyWorkspace,
  createConsumerWorkspace,
  lockRootDependencies,
  readLockText,
  readManifest,
  readManifestText,
  runNx,
  sectionOf,
  seedDemo,
  writeManifest,
} from './support/nx-workspace'

describe('@hyperfrontend/features Nx plugin callbacks and tree staging', () => {
  let workspace: ConsumerWorkspace

  beforeAll(() => {
    workspace = createConsumerWorkspace('hf-nx-cb-e2e-')
  }, SETUP_TIMEOUT)

  afterAll(() => {
    rmSync(workspace.workRoot, { recursive: true, force: true })
  })

  describe('init on a workspace whose manifest lacks the declaration', () => {
    let result: NxRunResult
    let afterManifest: Record<string, unknown>
    let lockBefore: string
    let lockAfter: string
    let lockDepsAfter: Record<string, string>

    beforeAll(() => {
      const scenarioDir = join(workspace.workRoot, 'scenario-init-installs')
      copyWorkspace(workspace.pristineDir, scenarioDir)
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
      expect(sectionOf(afterManifest, 'dependencies')[PLUGIN_NAME]).toBe(`^${workspace.packedVersion}`)
    })

    it('runs the package manager install after the flush', () => {
      // why: nx flushes only tree-staged files and the generator never stages package-lock.json, so a rewritten lock whose root entry lists the plugin proves a real package-manager child reconciled the flushed manifest (npm's human-readable output and file mtimes both vary across versions and filesystems).
      expect(lockAfter).not.toBe(lockBefore)
      expect(lockDepsAfter[PLUGIN_NAME]).toBe(`^${workspace.packedVersion}`)
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
      const scenarioDir = join(workspace.workRoot, 'scenario-init-satisfied')
      copyWorkspace(workspace.pristineDir, scenarioDir)
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
      const scenarioDir = join(workspace.workRoot, 'scenario-init-dry-run')
      copyWorkspace(workspace.pristineDir, scenarioDir)
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
      scenarioDir = join(workspace.workRoot, 'scenario-feature-heals-dep')
      copyWorkspace(workspace.pristineDir, scenarioDir)
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
      expect(sectionOf(afterManifest, 'dependencies')[PLUGIN_NAME]).toBe(`^${workspace.packedVersion}`)
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
      scenarioDir = join(workspace.workRoot, 'scenario-feature-dry-run')
      copyWorkspace(workspace.pristineDir, scenarioDir)
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
      scenarioDir = join(workspace.workRoot, 'scenario-feature-rerun')
      copyWorkspace(workspace.pristineDir, scenarioDir)
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
      scenarioDir = join(workspace.workRoot, 'scenario-feature-partial')
      copyWorkspace(workspace.pristineDir, scenarioDir)
      seedDemo(scenarioDir)
      const firstRun = runNx(scenarioDir, [...FEATURE_ARGS])
      if (firstRun.status !== 0) {
        throw new Error(`initial scaffold failed:\n${firstRun.output}`)
      }
      glueBefore = readFileSync(join(scenarioDir, 'demo', 'src', 'hyperfrontend.feature.ts'), 'utf8')
      entryBefore = readFileSync(join(scenarioDir, 'demo', 'src', 'main.ts'), 'utf8')
      rmSync(join(scenarioDir, 'demo', 'feature.config.json'))
      secondRun = runNx(scenarioDir, [...FEATURE_ARGS])
      configJson = JSON.parse(readFileSync(join(scenarioDir, 'demo', 'feature.config.json'), 'utf8')) as Record<string, unknown>
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
