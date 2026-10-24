import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { createCapturedOutput } from '@hyperfrontend/testing/process'
import { runFeaturesCli } from './bin'

const run = (argv: string[], cwd: string): Promise<{ code: number; out: string; err: string }> => {
  const stdout = createCapturedOutput()
  const stderr = createCapturedOutput()
  return runFeaturesCli({ argv, cwd, stdout, stderr }).then((code) => ({
    code,
    out: stdout.text(),
    err: stderr.text(),
  }))
}

describe('runFeaturesCli', () => {
  const tmp = useTempDir({ prefix: 'hf-bin-' })

  it('prints usage for --help', async () => {
    await expect(run(['--help'], tmp.path)).resolves.toEqual(
      expect.objectContaining({ code: 0, out: expect.stringContaining('Usage: hf') })
    )
  })

  it('fails when no command is given', async () => {
    await expect(run([], tmp.path)).resolves.toEqual(expect.objectContaining({ code: 1 }))
  })

  it('short-circuits to usage when --help follows a command', async () => {
    await expect(run(['init', '--help'], tmp.path)).resolves.toEqual(expect.objectContaining({ code: 0 }))
  })

  it('reports an unknown command', async () => {
    await expect(run(['frobnicate'], tmp.path)).resolves.toEqual(
      expect.objectContaining({ code: 1, err: expect.stringContaining('Unknown command') })
    )
  })

  it('reports a parse error and prints usage', async () => {
    await expect(run(['--bogus'], tmp.path)).resolves.toEqual(
      expect.objectContaining({ code: 1, err: expect.stringContaining('Unknown flag') })
    )
  })

  it('routes to the init command', async () => {
    await expect(run(['init', '--ci'], tmp.path)).resolves.toEqual(expect.objectContaining({ err: expect.stringContaining('--name') }))
  })

  it('routes to the build command', async () => {
    await expect(run(['build'], tmp.path)).resolves.toEqual(expect.objectContaining({ err: expect.stringContaining('Invalid config') }))
  })

  it('routes to the dev command', async () => {
    await expect(run(['dev'], tmp.path)).resolves.toEqual(expect.objectContaining({ err: expect.stringContaining('No hf-dev.config') }))
  })

  it('routes to the serve command', async () => {
    // why: A nonexistent --root fails serve's config resolution immediately, proving dispatch without leaving a server running.
    await expect(run(['serve', '--root', 'missing-root'], tmp.path)).resolves.toEqual(
      expect.objectContaining({ code: 1, err: expect.stringContaining('Serve root does not exist') })
    )
  })

  it('documents the serve command in usage', async () => {
    // why: The word "serve" also appears inside other command descriptions, so only the command's own usage line proves it is documented.
    await expect(run(['--help'], tmp.path)).resolves.toEqual(
      expect.objectContaining({ out: expect.stringContaining('serve    Serve a built site for production') })
    )
  })
})
