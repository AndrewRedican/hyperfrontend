import type { ResolvedMediaConfig, VariantSpec } from '../../models/config'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'

/** Absolute path of the recorder's source, which fixture scenes import by path. */
const SRC = resolve(fileURLToPath(import.meta.url), '../../..')

/** The variant under the bare name, held to a budget small enough for a spec to breach. */
export const PORTABLE_VARIANT: VariantSpec = { theme: 'portable', suffix: '', intent: 'anywhere', gif: { maxBytes: 4_096 } }

/** The variant under the `.dark` suffix, with no budget of its own. */
export const DARK_VARIANT: VariantSpec = { theme: 'dark', suffix: '.dark', intent: 'dark pages' }

/**
 * A resolved configuration with the defaults the recorder ships, rooted somewhere.
 *
 * @param root - Absolute directory the scene and output directories sit under.
 * @returns The configuration.
 */
export function resolvedConfigFor(root: string): ResolvedMediaConfig {
  return {
    roots: { configDir: root, rootDir: root, sceneDir: join(root, 'scenes'), outputDir: join(root, 'media'), tmpDir: join(root, 'tmp') },
    publicBaseUrl: '',
    encoder: { prefer: 'auto', binaries: { ffmpeg: 'ffmpeg', gifsicle: 'gifsicle' } },
    browser: { executablePath: '', args: [], readyTimeoutMs: 1_000 },
    defaults: {
      gif: { width: 640, fps: 10, colours: 128, lossy: 60, dither: true, loop: 0, maxBytes: 2_000_000 },
      still: { format: 'png', quality: 100, width: 0 },
    },
    variants: [PORTABLE_VARIANT, DARK_VARIANT],
  }
}

/** A throwaway workspace for one spec: a scene directory and an output directory. */
export interface SceneWorkspace {
  /** Absolute path of the workspace. */
  root: string
  /** The configuration a command is handed for it. */
  config: ResolvedMediaConfig
  /**
   * Write one scene file into the workspace.
   *
   * @param name - Filename under the scene directory.
   * @param body - The file's contents.
   * @returns Absolute path of the file.
   */
  writeScene: (name: string, body: string) => string
  /**
   * Write one file into a scene's output directory.
   *
   * @param slug - The scene's slug, which names the directory.
   * @param name - Filename under it.
   * @param contents - Text to write verbatim, or an object to serialise as JSON.
   */
  writeAsset: (slug: string, name: string, contents: string | object) => void
  /** Delete the workspace. */
  remove: () => void
}

/**
 * The head of a scene module: the recorder imported by absolute path, because
 * a fixture lives outside the package and has no relative route to it, and a
 * one-second stage that draws its moment.
 */
const SCENE_HEAD = `import { defineScriptedScene } from '${SRC}/scene/define-scene.ts'
import { defineStage } from '${SRC}/stage/define-stage.ts'

const stage = defineStage({
  id: 'dot',
  styles: () => '.dot { color: red; }',
  durationMs: () => 1_000,
  frame: ({ atMs }) => \`<span class="dot">\${atMs}</span>\`,
})
`

/**
 * The module body of a scripted scene drawn by a one-frame stage.
 *
 * @param fields - Scene fields, written as source, slug included.
 * @returns TypeScript source for the scene file.
 */
export function scriptedSceneSource(fields: string): string {
  return `${SCENE_HEAD}
export default defineScriptedScene({
  ${fields}
  stage,
  config: {},
})
`
}

/**
 * The module body of a browser scene pointed at nothing in particular.
 *
 * @param fields - Scene fields, written as source, slug included.
 * @returns TypeScript source for the scene file.
 */
export function browserSceneSource(fields: string): string {
  return `import { defineBrowserScene } from '${SRC}/scene/define-scene.ts'

export default defineBrowserScene({
  ${fields}
  viewport: { width: 640, height: 360 },
  ready: { selector: 'body', timeoutMs: 1_000 },
  record: { settleMs: 0, durationMs: 1_000 },
})
`
}

/**
 * The module body of a file that exports one scripted scene per slug.
 *
 * @param slugs - The slugs, in order.
 * @param fields - Scene fields, written as source, shared by every scene.
 * @returns TypeScript source for the scene file.
 */
export function scriptedSceneListSource(slugs: readonly string[], fields: string): string {
  return `${SCENE_HEAD}
export default ${stringify(slugs)}.map((slug) => defineScriptedScene({
  slug,
  ${fields}
  stage,
  config: {},
}))
`
}

/**
 * Create a throwaway workspace with the workspace defaults the recorder ships.
 *
 * @returns The workspace, its configuration, and the means to fill and remove it.
 */
export function createSceneWorkspace(): SceneWorkspace {
  const root = mkdtempSync(join(tmpdir(), 'media-scenes-'))
  const config = resolvedConfigFor(root)
  mkdirSync(config.roots.sceneDir)
  mkdirSync(config.roots.outputDir)
  return {
    root,
    config,
    writeScene: (name, body) => {
      const filePath = join(config.roots.sceneDir, name)
      writeFileSync(filePath, body)
      return filePath
    },
    writeAsset: (slug, name, contents) => {
      mkdirSync(join(config.roots.outputDir, slug), { recursive: true })
      writeFileSync(join(config.roots.outputDir, slug, name), typeof contents === 'string' ? contents : stringify(contents))
    },
    remove: () => rmSync(root, { recursive: true, force: true }),
  }
}
