import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runFeaturesCli } from './bin'

const sink = (): { stream: NodeJS.WritableStream; text: () => string } => {
  const chunks: string[] = []
  const stream = <NodeJS.WritableStream>(<unknown>{
    write: (chunk: string): boolean => {
      chunks.push(chunk)
      return true
    },
  })
  return { stream, text: () => chunks.join('') }
}

const run = (argv: string[], cwd: string): Promise<{ code: number; out: string; err: string }> => {
  const stdout = sink()
  const stderr = sink()
  return runFeaturesCli({ argv, cwd, stdout: stdout.stream, stderr: stderr.stream }).then((code) => ({
    code,
    out: stdout.text(),
    err: stderr.text(),
  }))
}

describe('runFeaturesCli', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'hf-bin-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('prints usage for --help', async () => {
    await expect(run(['--help'], dir)).resolves.toEqual(expect.objectContaining({ code: 0, out: expect.stringContaining('Usage: hf') }))
  })

  it('fails when no command is given', async () => {
    await expect(run([], dir)).resolves.toEqual(expect.objectContaining({ code: 1 }))
  })

  it('short-circuits to usage when --help follows a command', async () => {
    await expect(run(['init', '--help'], dir)).resolves.toEqual(expect.objectContaining({ code: 0 }))
  })

  it('reports an unknown command', async () => {
    await expect(run(['frobnicate'], dir)).resolves.toEqual(
      expect.objectContaining({ code: 1, err: expect.stringContaining('Unknown command') })
    )
  })

  it('reports a parse error and prints usage', async () => {
    await expect(run(['--bogus'], dir)).resolves.toEqual(expect.objectContaining({ code: 1, err: expect.stringContaining('Unknown flag') }))
  })

  it('routes to the init command', async () => {
    await expect(run(['init', '--ci'], dir)).resolves.toEqual(expect.objectContaining({ err: expect.stringContaining('--name') }))
  })

  it('routes to the build command', async () => {
    await expect(run(['build'], dir)).resolves.toEqual(expect.objectContaining({ err: expect.stringContaining('Invalid config') }))
  })

  it('routes to the dev command', async () => {
    await expect(run(['dev'], dir)).resolves.toEqual(expect.objectContaining({ err: expect.stringContaining('No hf-dev.config') }))
  })

  it('routes to the serve command', async () => {
    // why: A nonexistent --root fails serve's config resolution immediately, proving dispatch without leaving a server running.
    await expect(run(['serve', '--root', 'missing-root'], dir)).resolves.toEqual(
      expect.objectContaining({ code: 1, err: expect.stringContaining('Serve root does not exist') })
    )
  })

  it('documents the serve command in usage', async () => {
    // why: The word "serve" also appears inside other command descriptions, so only the command's own usage line proves it is documented.
    await expect(run(['--help'], dir)).resolves.toEqual(
      expect.objectContaining({ out: expect.stringContaining('serve    Serve a built site for production') })
    )
  })
})
