/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/server`.
 *
 * The packed tarball is installed into a consumer outside the workspace and every test runs under plain Node
 * with no loader hooks: both entries load the way a consumer's `require` sees them, and the installed package
 * starts its static server on a port the operating system picks and serves a file from the consumer's directory.
 */

'use strict'

const { join } = require('node:path')
const { before } = require('node:test')
const { describe, it, expect } = require('@hyperfrontend/testing')
const { usePackedConsumer } = require('@hyperfrontend/testing/consumer')

/** A script long enough to cross the compression threshold. */
const SCRIPT = `module.exports = [\n${"  'a row the compressor folds into the one before it',\n".repeat(40)}]\n`

/** The site the installed server serves. */
const SITE = { 'site/app.js': SCRIPT }

const consumer = usePackedConsumer({ tarball: process.env.HF_E2E_TARBALL })

before(() => consumer.writeTree(SITE))

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
      'closeServer',
      'confineDecodedPath',
      'contentTypeFor',
      'createServeListener',
      'createStaticHandler',
      'decodeRequestPath',
      'directoryLocation',
      'headerValue',
      'listen',
      'negotiateEncoding',
      'plainResponse',
      'requestPath',
      'runSteps',
      'serveFile',
      'startStaticServer',
      'waitForShutdown',
    ])
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
})
