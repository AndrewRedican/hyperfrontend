/**
 * Packed-tarball Nx plugin E2E tests for `@hyperfrontend/features`.
 * Drives the `init` and `feature` generators the way a consumer does: inside a
 * real Nx workspace created by the official create-nx-workspace generator, with
 * the packed tarball installed the way `nx add` installs a plugin.
 */

import type { ConsumerWorkspace, NxRunResult } from './support/nx-workspace'
import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import {
  FEATURE_ARGS,
  PLUGIN_NAME,
  SCENARIO_TIMEOUT,
  SETUP_TIMEOUT,
  copyWorkspace,
  createConsumerWorkspace,
  readManifest,
  readManifestText,
  runNx,
  sectionOf,
  seedDemo,
  writeManifest,
} from './support/nx-workspace'

describe('@hyperfrontend/features Nx plugin', () => {
  let workspace: ConsumerWorkspace

  beforeAll(() => {
    workspace = createConsumerWorkspace('hf-nx-e2e-')
  }, SETUP_TIMEOUT)

  afterAll(() => {
    rmSync(workspace.workRoot, { recursive: true, force: true })
  })

  describe('nx list @hyperfrontend/features', () => {
    let result: NxRunResult

    beforeAll(() => {
      result = runNx(workspace.pristineDir, ['list', PLUGIN_NAME])
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
      scenarioDir = join(workspace.workRoot, 'scenario-fresh')
      copyWorkspace(workspace.pristineDir, scenarioDir)
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
      const scenarioDir = join(workspace.workRoot, 'scenario-declared-in-deps')
      copyWorkspace(workspace.pristineDir, scenarioDir)
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
      const scenarioDir = join(workspace.workRoot, 'scenario-missing-declaration')
      copyWorkspace(workspace.pristineDir, scenarioDir)
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
      expect(sectionOf(afterManifest, 'dependencies')[PLUGIN_NAME]).toBe(`^${workspace.packedVersion}`)
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
      const scenarioDir = join(workspace.workRoot, 'scenario-no-sections')
      copyWorkspace(workspace.pristineDir, scenarioDir)
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
      expect(afterManifest['dependencies']).toEqual({ [PLUGIN_NAME]: `^${workspace.packedVersion}` })
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
      scenarioDir = join(workspace.workRoot, 'scenario-conflicting')
      copyWorkspace(workspace.pristineDir, scenarioDir)
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
      expect(sectionOf(repinnedManifest, 'dependencies')[PLUGIN_NAME]).toBe(`^${workspace.packedVersion}`)
      expect(sectionOf(repinnedManifest, 'devDependencies')[PLUGIN_NAME]).toBe(`^${workspace.packedVersion}`)
    })
  })

  describe('init --dry-run', () => {
    let before: string
    let result: NxRunResult
    let after: string

    beforeAll(() => {
      const scenarioDir = join(workspace.workRoot, 'scenario-dry-run')
      copyWorkspace(workspace.pristineDir, scenarioDir)
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
      scenarioDir = join(workspace.workRoot, 'scenario-feature')
      copyWorkspace(workspace.pristineDir, scenarioDir)
      seedDemo(scenarioDir)
      result = runNx(scenarioDir, [...FEATURE_ARGS])
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
      // note: The consumer's prettier config governs the final shape (devkit formatFiles runs in the generator body), so the pin tolerates line breaks and a trailing comma.
      expect(glueModule).toMatch(/export const feature = createFeature\(\{\s*name: 'clock',\s*version: '0\.1\.0',\s*contract,?\s*\}\)/)
    })

    it('stubs a handler per accepted action and an example send per emitted action', () => {
      expect(glueModule).toContain("feature.on('ping', (_data: unknown) => {")
      expect(glueModule).toContain("// feature.send('tick', undefined)")
    })

    it('wires the marker-guarded glue import into the entry file', () => {
      // note: The consumer's prettier config formats the updated entry file too, so the pin tolerates the semicolons it appends.
      expect(entryFile).toMatch(
        /^\/\/ <hf:feature> — managed by @hyperfrontend\/features; safe to keep\nimport '\.\/hyperfrontend\.feature';?\n\/\/ <\/hf:feature>\n\nconsole\.log\('demo app entry'\);?\n$/
      )
    })

    it('keeps the workspace project graph loadable after scaffolding', () => {
      expect(showProjects.status).toBe(0)
    })
  })
})
