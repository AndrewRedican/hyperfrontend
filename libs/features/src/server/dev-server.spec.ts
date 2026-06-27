import type { ResolvedDevConfig } from './config'
import type { DevServerHandle } from './dev-server'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, get } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { startDevServer } from './dev-server'

const fetchUrl = (url: string): Promise<{ status: number; body: string }> =>
  new Promise((resolve, reject) => {
    get(url, (res) => {
      let body = ''
      res.on('data', (chunk) => (body += chunk))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }))
    }).on('error', reject)
  })

describe('startDevServer', () => {
  let assetRoot: string
  let appDir: string
  let handle: DevServerHandle | undefined

  const config = (over: Partial<ResolvedDevConfig> = {}): ResolvedDevConfig => ({
    apps: [{ name: 'clock', outputDir: appDir, port: 0 }],
    debug: { enabled: true, messageLog: true, securityView: true },
    debugPort: 0,
    sourcePath: '/p/hf-dev.config.json',
    ...over,
  })

  beforeEach(() => {
    assetRoot = mkdtempSync(join(tmpdir(), 'hf-assets-'))
    appDir = mkdtempSync(join(tmpdir(), 'hf-app-'))
    writeFileSync(join(assetRoot, 'index.html'), '<debug>HF_MANIFEST_PLACEHOLDER</debug>')
    writeFileSync(join(assetRoot, 'bootstrap.js'), 'export const boot = true')
    writeFileSync(join(appDir, 'index.html'), 'APP_INDEX')
  })

  afterEach(async () => {
    await handle?.close()
    handle = undefined
    rmSync(assetRoot, { recursive: true, force: true })
    rmSync(appDir, { recursive: true, force: true })
  })

  it('serves each app static output', async () => {
    handle = await startDevServer(config(), { assetRoot })
    await expect(fetchUrl(handle.apps[0]?.url ?? '')).resolves.toEqual({ status: 200, body: 'APP_INDEX' })
  })

  it('serves the debug UI with the manifest injected', async () => {
    handle = await startDevServer(config(), { assetRoot })
    await expect(fetchUrl(handle.debugUrl ?? '')).resolves.toEqual(
      expect.objectContaining({ status: 200, body: expect.stringContaining('"clock"') })
    )
  })

  it('serves the manifest at /__apps', async () => {
    handle = await startDevServer(config(), { assetRoot })
    const response = await fetchUrl(`${handle.debugUrl}__apps`)
    expect(response).toEqual(expect.objectContaining({ status: 200, body: expect.stringContaining('"name":"clock"') }))
  })

  it('serves the compiled debug-UI assets under /__debug/', async () => {
    handle = await startDevServer(config(), { assetRoot })
    await expect(fetchUrl(`${handle.debugUrl}__debug/bootstrap.js`)).resolves.toEqual(
      expect.objectContaining({ status: 200, body: 'export const boot = true' })
    )
  })

  it('returns 404 for an unknown control path', async () => {
    handle = await startDevServer(config(), { assetRoot })
    await expect(fetchUrl(`${handle.debugUrl}nope`)).resolves.toEqual(expect.objectContaining({ status: 404 }))
  })

  it('reports a 404 when the debug-UI assets are missing', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'hf-empty-'))
    handle = await startDevServer(config(), { assetRoot: empty })
    const response = await fetchUrl(handle.debugUrl ?? '')
    rmSync(empty, { recursive: true, force: true })
    expect(response).toEqual({ status: 404, body: 'Debug UI assets not found.' })
  })

  it('omits the debug server when the debug UI is disabled', async () => {
    handle = await startDevServer(config({ debug: { enabled: false, messageLog: false, securityView: false } }), { assetRoot })
    expect(handle.debugUrl).toBeUndefined()
  })

  it('exposes the running apps in the manifest', async () => {
    handle = await startDevServer(config(), { assetRoot })
    expect(handle.manifest.apps).toEqual([expect.objectContaining({ name: 'clock' })])
  })

  it('locates the bundled debug-UI assets when no assetRoot is given', async () => {
    handle = await startDevServer(config())
    await expect(fetchUrl(handle.debugUrl ?? '')).resolves.toEqual(expect.objectContaining({ status: 200 }))
  })

  it('uses injected server-creation and file-system overrides', async () => {
    handle = await startDevServer(config(), {
      createServer: (handler) => createServer(handler),
      readFile: () => Buffer.from('<debug>HF_MANIFEST_PLACEHOLDER</debug>'),
      isFile: () => true,
    })
    await expect(fetchUrl(handle.debugUrl ?? '')).resolves.toEqual(
      expect.objectContaining({ status: 200, body: expect.stringContaining('"clock"') })
    )
  })

  it('stops serving after close', async () => {
    handle = await startDevServer(config(), { assetRoot })
    const url = handle.apps[0]?.url ?? ''
    await handle.close()
    handle = undefined
    await expect(fetchUrl(url)).rejects.toThrow()
  })
})
