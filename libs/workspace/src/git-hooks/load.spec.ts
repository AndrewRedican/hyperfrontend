import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { loadHooks } from './load'

/** A configuration with one step, as a file exports it. */
const CONFIG = "export default { 'pre-push': [{ name: 'lint', run: ['hf', 'affected', '-t', 'lint'] }] }\n"

describe('loadHooks', () => {
  const dir = useTempDir()

  it('refuses a workspace without a configuration, saying what writes one', async () => {
    await expect(loadHooks(dir.path)).rejects.toThrow('no hooks.config.ts at the workspace root: npx hf generate hooks writes one')
  })

  it('loads the configuration, with no preferences where the clone keeps none', async () => {
    dir.write('hooks.config.ts', CONFIG)
    expect(await loadHooks(dir.path)).toEqual({
      config: { 'pre-push': [{ name: 'lint', run: ['hf', 'affected', '-t', 'lint'] }] },
      local: {},
    })
  })

  it('loads the preferences of a clone that keeps a local file', async () => {
    dir.write('hooks.config.ts', CONFIG)
    dir.write('hooks.local.config.ts', "export default { skip: ['lint'] }\n")
    expect((await loadHooks(dir.path)).local).toEqual({ skip: ['lint'] })
  })

  it('names the file whose content is not a configuration', async () => {
    dir.write('hooks.config.ts', "export default { 'post-merge': [] }\n")
    await expect(loadHooks(dir.path)).rejects.toThrow('hooks.config.ts: post-merge is not a hook this configures')
  })

  it('names the local file that cannot be loaded', async () => {
    dir.write('hooks.config.ts', CONFIG)
    dir.write('hooks.local.config.ts', "throw new Error('broken on purpose')\n")
    await expect(loadHooks(dir.path)).rejects.toThrow('hooks.local.config.ts: Error: broken on purpose')
  })
})
