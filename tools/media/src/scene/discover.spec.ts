import type { SceneWorkspace } from './__test-utils__/scene-dir'
import { join } from 'node:path'
import { after as afterAll, before as beforeAll } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createSceneWorkspace, scriptedSceneListSource, scriptedSceneSource } from './__test-utils__/scene-dir'
import { discoverScenes } from './discover'

describe('discoverScenes', () => {
  let workspace: SceneWorkspace

  beforeAll(() => {
    workspace = createSceneWorkspace()
  })

  afterAll(() => {
    workspace.remove()
  })

  it('loads a file that default-exports one scene', async () => {
    const filePath = workspace.writeScene('one.scene.ts', scriptedSceneSource("slug: 'one', outputs: ['gif'], profile: 'compact',"))
    expect(await discoverScenes(workspace.config.roots.sceneDir, 'one')).toEqual([
      { filePath, scene: expect.objectContaining({ slug: 'one', kind: 'scripted' }) },
    ])
  })

  it('loads every scene a file default-exports as a list', async () => {
    const filePath = workspace.writeScene(
      'two.scene.ts',
      scriptedSceneListSource(['two-a', 'two-b'], "outputs: ['gif'], profile: 'compact',")
    )
    expect(await discoverScenes(workspace.config.roots.sceneDir, '')).toEqual(
      expect.arrayContaining([
        { filePath, scene: expect.objectContaining({ slug: 'two-a' }) },
        { filePath, scene: expect.objectContaining({ slug: 'two-b' }) },
      ])
    )
  })

  it('reads scene files in name order', async () => {
    const found = await discoverScenes(workspace.config.roots.sceneDir, '')
    expect(found.map((entry) => entry.scene.slug)).toEqual(['one', 'two-a', 'two-b'])
  })

  it('ignores a file that is not a scene file', async () => {
    workspace.writeScene('notes.ts', 'export const note = 1\n')
    expect((await discoverScenes(workspace.config.roots.sceneDir, '')).map((entry) => entry.scene.slug)).toEqual(['one', 'two-a', 'two-b'])
  })

  it('rejects a slug no scene carries', async () => {
    await expect(discoverScenes(workspace.config.roots.sceneDir, 'missing')).rejects.toThrow('No scene with slug "missing"')
  })

  it('rejects an empty scene directory', async () => {
    const empty = createSceneWorkspace()
    try {
      await expect(discoverScenes(empty.config.roots.sceneDir, '')).rejects.toThrow(`No *.scene.ts files in ${empty.config.roots.sceneDir}`)
    } finally {
      empty.remove()
    }
  })

  it('rejects a scene directory that does not exist', async () => {
    await expect(discoverScenes(join(workspace.root, 'nowhere'), '')).rejects.toThrow(
      `No scene directory at ${join(workspace.root, 'nowhere')}`
    )
  })

  it('rejects a file that exports no scene', async () => {
    const broken = createSceneWorkspace()
    const filePath = broken.writeScene('junk.scene.ts', 'export const nothing = 1\n')
    try {
      await expect(discoverScenes(broken.config.roots.sceneDir, '')).rejects.toThrow(
        `${filePath} must default-export defineBrowserScene({ ... }), defineScriptedScene({ ... }) or a list of them`
      )
    } finally {
      broken.remove()
    }
  })

  it('rejects a scene built by hand rather than by a define function', async () => {
    const broken = createSceneWorkspace()
    broken.writeScene('hand.scene.ts', "export default { kind: 'handmade', slug: 'hand' }\n")
    try {
      await expect(discoverScenes(broken.config.roots.sceneDir, '')).rejects.toThrow('must default-export')
    } finally {
      broken.remove()
    }
  })

  it('rejects two scenes sharing a slug, naming the second file', async () => {
    const twice = createSceneWorkspace()
    twice.writeScene('a.scene.ts', scriptedSceneSource("slug: 'same', outputs: ['gif'], profile: 'compact',"))
    const second = twice.writeScene('b.scene.ts', scriptedSceneSource("slug: 'same', outputs: ['gif'], profile: 'compact',"))
    try {
      await expect(discoverScenes(twice.config.roots.sceneDir, '')).rejects.toThrow(
        `Two scenes are named "same"; the second is in ${second}`
      )
    } finally {
      twice.remove()
    }
  })
})
