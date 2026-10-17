import type { LoadedScene, MediaScene } from '../models/scene'
import type { SceneWorkspace } from './__test-utils__/scene-dir'
import { after as afterAll, before as beforeAll } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { defineStage } from '../stage/define-stage'
import { createSceneWorkspace, scriptedSceneSource } from './__test-utils__/scene-dir'
import { defineScriptedScene } from './define-scene'
import { digestFile, digestScene } from './digest'

/** What the line stage is configured with. */
interface LineConfig {
  /** Text the stage draws. */
  line?: string
  /** Values the stage carries without drawing, for checking how a list is read. */
  list?: readonly unknown[]
}

/** A stage that draws its configured line, so a scene's configuration is all that tells two rows apart. */
const stage = defineStage<LineConfig>({
  id: 'line',
  styles: () => '',
  durationMs: () => 1_000,
  frame: ({ config }) => `<p>${config.line ?? ''}</p>`,
})

/**
 * One row of a table file, as discovery hands it over.
 *
 * @param scene - The scene the row defines.
 * @returns The scene, marked as one of several its file exports.
 */
function row(scene: MediaScene): LoadedScene {
  return { filePath: '/scenes/table.scene.ts', scene, sharesFile: true }
}

/**
 * A scripted scene drawn by the line stage.
 *
 * @param config - What the stage draws.
 * @returns A scene named `row`.
 */
function lineScene(config: LineConfig): MediaScene {
  return defineScriptedScene({ slug: 'row', outputs: ['gif'], profile: 'compact', stage, config })
}

describe('digestScene', () => {
  let workspace: SceneWorkspace

  beforeAll(() => {
    workspace = createSceneWorkspace()
  })

  afterAll(() => {
    workspace.remove()
  })

  it('digests a scene that has its file to itself from the whole file', () => {
    const filePath = workspace.writeScene('alone.scene.ts', scriptedSceneSource("slug: 'alone', outputs: ['gif'], profile: 'compact',"))
    expect(digestScene({ filePath, scene: lineScene({}), sharesFile: false })).toBe(digestFile(filePath))
  })

  it('digests a listed scene from its own definition, so the same row reads the same wherever its file changed', () => {
    expect(digestScene(row(lineScene({ line: 'one' })))).toBe(
      digestScene({ ...row(lineScene({ line: 'one' })), filePath: '/elsewhere.scene.ts' })
    )
  })

  it("changes a listed scene's digest when its own configuration changes", () => {
    expect(digestScene(row(lineScene({ line: 'one' })))).not.toBe(digestScene(row(lineScene({ line: 'two' }))))
  })

  it('reads fields in any order the same', () => {
    const scene = lineScene({ line: 'one' })
    const reordered = { ...scene, config: { line: 'one' }, slug: scene.slug } as MediaScene
    expect(digestScene(row(scene))).toBe(digestScene(row(reordered)))
  })

  it('reads a field set to undefined the same as one left out', () => {
    expect(digestScene(row(lineScene({ line: undefined })))).toBe(digestScene(row(lineScene({}))))
  })

  it('reads a hole in a list as null, the way JSON does', () => {
    expect(digestScene(row(lineScene({ list: [undefined] })))).toBe(digestScene(row(lineScene({ list: [null] }))))
  })

  it('writes a function a scene declares as its source', () => {
    const scene = lineScene({})
    const hooked = (body: string): MediaScene => ({ ...scene, frame: new Function('profile', 'theme', 'atMs', body) }) as MediaScene
    expect(digestScene(row(hooked('return "a"')))).not.toBe(digestScene(row(hooked('return "b"'))))
  })
})
