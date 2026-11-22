/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/server`.
 *
 * The packed tarball is installed into a consumer outside the workspace and every test runs under plain Node
 * with no loader hooks: every entry loads the way a consumer's `require` sees it, and the installed package
 * starts its static server on a port the operating system picks and serves a file from the consumer's directory.
 */

'use strict'

const { createHash } = require('node:crypto')
const { join } = require('node:path')
const { before } = require('node:test')
const { describe, it, expect } = require('@hyperfrontend/testing')
const { usePackedConsumer } = require('@hyperfrontend/testing/consumer')

/** A script long enough to cross the compression threshold. */
const SCRIPT = `module.exports = [\n${"  'a row the compressor folds into the one before it',\n".repeat(40)}]\n`

/** The site the installed server serves. */
const SITE = { 'site/app.js': SCRIPT }

/**
 * Hashes a text the way a release manifest records a file, independently of the package under test.
 *
 * @param content - The text of a file.
 * @returns The SHA-256 of its UTF-8 bytes, in lowercase hexadecimal.
 */
const sha256 = (content) => createHash('sha256').update(content).digest('hex')

/** A release directory the installed manifest entry indexes, and a second copy for the case that changes a file after indexing it. */
const RELEASES = {
  'release/index.mjs': 'abc',
  'release/assets/app.css': 'body{}',
  'tampered/index.mjs': 'abc',
  'tampered/assets/app.css': 'body{}',
}

/** The manifest of either copy as it was written. */
const MANIFEST = {
  schema: 1,
  name: '@acme/clock-shell',
  version: '1.4.0',
  files: [
    { path: 'assets/app.css', size: 6, sha256: sha256('body{}') },
    { path: 'index.mjs', size: 3, sha256: sha256('abc') },
  ],
}

const consumer = usePackedConsumer({ tarball: process.env.HF_E2E_TARBALL })

before(() => consumer.writeTree(SITE))

before(() => consumer.writeTree(RELEASES))

describe('@hyperfrontend/server CJS', () => {
  it('requires every export entry', () => {
    expect(consumer.entries('require').filter((entry) => !entry.ok)).toEqual([])
  })

  it('exports the kernel functions from the main entry', () => {
    const names = consumer.run(
      () => {
        const entry = require('@hyperfrontend/server')
        return Object.keys(entry)
          .filter((name) => typeof entry[name] === 'function')
          .sort()
      },
      { kind: 'require' }
    )
    expect(names).toEqual([
      'addressPort',
      'buildCompressionStep',
      'buildServeSteps',
      'chain',
      'closeServer',
      'confineDecodedPath',
      'contentTypeFor',
      'cors',
      'createServeListener',
      'createStaticHandler',
      'decodeRequestPath',
      'defineService',
      'directoryLocation',
      'formatEvent',
      'guard',
      'headerRules',
      'headerValue',
      'health',
      'httpError',
      'isHttpError',
      'jsonResponse',
      'listen',
      'negotiateEncoding',
      'plainResponse',
      'readiness',
      'requestPath',
      'route',
      'router',
      'runService',
      'runSteps',
      'sealServiceBuild',
      'serveFile',
      'startService',
      'startStaticServer',
      'staticFiles',
      'waitForShutdown',
    ])
  })

  it('exports the environment functions from the environment entry', () => {
    const names = consumer.run(
      () => {
        const entry = require('@hyperfrontend/server/environment')
        return Object.keys(entry)
          .filter((name) => typeof entry[name] === 'function')
          .sort()
      },
      { kind: 'require' }
    )
    expect(names).toEqual(['asDuration', 'asOrigin', 'asPort', 'asSecret', 'asText', 'asUrl', 'defineEnvironment', 'optional', 'required'])
  })

  it('exports the policy functions from the policy entry', () => {
    const names = consumer.run(
      () => {
        const entry = require('@hyperfrontend/server/policy')
        return Object.keys(entry)
          .filter((name) => typeof entry[name] === 'function')
          .sort()
      },
      { kind: 'require' }
    )
    expect(names).toEqual([
      'applyHeaderRules',
      'checkEmbedders',
      'checkPermissionsPolicy',
      'checkServeConfig',
      'contentSecurityPolicy',
      'crossOriginIsolation',
      'defineServeConfig',
      'embedders',
      'expandHeaderPolicy',
      'frameAncestors',
      'frameAncestorsOf',
      'immutableAssets',
      'isolationRules',
      'matchesEveryPath',
      'nosniff',
      'permissionsPolicy',
      'permitsEveryOrigin',
      'referrerPolicy',
      'strictTransportSecurity',
      'validateHeaderRule',
      'validateServeConfig',
    ])
  })

  it('expands a header policy into ordered rules and folds them for a path', () => {
    const lines = consumer.run(
      () => {
        const { applyHeaderRules, expandHeaderPolicy, immutableAssets } = require('@hyperfrontend/server/policy')
        const rules = expandHeaderPolicy({
          embedders: ["'self'", 'https://host.example'],
          permissionsPolicy: { camera: [], geolocation: ['self'] },
          isolation: 'require-corp',
          headers: [immutableAssets('/assets/')],
        })
        return Object.entries(applyHeaderRules(rules, '/assets/app.js')).map(([name, value]) => `${name}: ${value}`)
      },
      { kind: 'require' }
    )
    expect(lines).toEqual([
      "Content-Security-Policy: frame-ancestors 'self' https://host.example",
      'Permissions-Policy: camera=(), geolocation=(self)',
      'Cross-Origin-Opener-Policy: same-origin',
      'Cross-Origin-Embedder-Policy: require-corp',
      'Cross-Origin-Resource-Policy: cross-origin',
      'Cache-Control: public, max-age=31536000, immutable',
    ])
  })

  it('refuses a header policy with every problem on a line of its own', () => {
    const message = consumer.run(
      () => {
        const { expandHeaderPolicy } = require('@hyperfrontend/server/policy')
        try {
          expandHeaderPolicy({ embedders: ['*'], permissionsPolicy: { camera: ["'self'"] } })
          return null
        } catch (error) {
          return error.message
        }
      },
      { kind: 'require' }
    )
    expect(message).toBe(
      [
        'embedders[0] permits every origin: name each host instead of a bare "*", a scheme on its own or a "*" host.',
        'permissionsPolicy["camera"][0] is quoted: write self without quotes, and an empty array in place of \'none\'.',
      ].join('\n')
    )
  })

  it('serves a file with its expanded header policy and gzip encoding on a port the system picks', () => {
    const served = consumer.run(
      async (root) => {
        const { get } = require('node:http')
        const { gunzipSync } = require('node:zlib')
        const { startStaticServer } = require('@hyperfrontend/server')
        const { expandHeaderPolicy } = require('@hyperfrontend/server/policy')
        const server = await startStaticServer({
          root,
          port: 0,
          host: '127.0.0.1',
          log: false,
          headers: expandHeaderPolicy({
            embedders: [],
            isolation: 'credentialless',
            headers: [{ suffix: '.js', headers: { 'Cache-Control': 'no-cache' } }],
          }),
        })
        try {
          return await new Promise((resolve, reject) => {
            const options = { host: '127.0.0.1', port: server.port, path: '/app.js', agent: false, headers: { 'accept-encoding': 'gzip' } }
            get(options, (response) => {
              const chunks = []
              response.on('data', (chunk) => chunks.push(chunk))
              response.on('end', () =>
                resolve({
                  status: response.statusCode,
                  cacheControl: response.headers['cache-control'],
                  embedderPolicy: response.headers['cross-origin-embedder-policy'],
                  framing: response.headers['content-security-policy'],
                  frameOptions: response.headers['x-frame-options'],
                  contentEncoding: response.headers['content-encoding'],
                  text: gunzipSync(Buffer.concat(chunks)).toString('utf8'),
                })
              )
            }).on('error', reject)
          })
        } finally {
          await server.close()
        }
      },
      { kind: 'require', args: join(consumer.path, 'site') }
    )
    expect(served).toEqual({
      status: 200,
      cacheControl: 'no-cache',
      embedderPolicy: 'credentialless',
      framing: "frame-ancestors 'none'",
      frameOptions: 'DENY',
      contentEncoding: 'gzip',
      text: SCRIPT,
    })
  })

  it('creates, serializes, parses and verifies a release from the packed entry', () => {
    const release = consumer.run(
      (root) => {
        const { writeFileSync } = require('node:fs')
        const { join } = require('node:path')
        const {
          RELEASE_MANIFEST_FILENAME,
          createReleaseManifest,
          parseReleaseManifest,
          releaseManifestDigest,
          serializeReleaseManifest,
          verifyRelease,
        } = require('@hyperfrontend/server/manifest')
        const source = join(root, RELEASE_MANIFEST_FILENAME)
        const text = serializeReleaseManifest(createReleaseManifest({ root, name: '@acme/clock-shell', version: '1.4.0' }))
        writeFileSync(source, text)
        const manifest = parseReleaseManifest(text, source)
        return { manifest, digest: releaseManifestDigest(text), issues: verifyRelease(root, manifest) }
      },
      { kind: 'require', args: join(consumer.path, 'release') }
    )
    expect(release).toEqual({ manifest: MANIFEST, digest: sha256(`${JSON.stringify(MANIFEST, null, 2)}\n`), issues: [] })
  })

  it('reports a tampered file', () => {
    const issues = consumer.run(
      (root) => {
        const { writeFileSync } = require('node:fs')
        const { join } = require('node:path')
        const { createReleaseManifest, verifyRelease } = require('@hyperfrontend/server/manifest')
        const manifest = createReleaseManifest({ root, name: '@acme/clock-shell', version: '1.4.0' })
        writeFileSync(join(root, 'index.mjs'), 'abd')
        return verifyRelease(root, manifest)
      },
      { kind: 'require', args: join(consumer.path, 'tampered') }
    )
    expect(issues).toEqual([{ code: 'file-sha256-mismatch', path: 'index.mjs', message: 'index.mjs does not have the listed SHA-256.' }])
  })
})
