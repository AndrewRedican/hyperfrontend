import type { TypesExtractConfig } from './config'
import { describe, expect, it } from '@hyperfrontend/testing'
import { validateConfig } from './config'

const VALID: TypesExtractConfig = {
  lockFile: 'lock.json',
  sources: { nx: { repo: 'nrwl/nx', ref: '23.3.0', include: ['packages/nx/src/'] } },
  requests: [{ source: 'nx', root: 'packages/nx/src/a.ts', symbols: ['A'], depth: 1, output: 'out/a.ts' }],
  boundary: { default: 'unknown', overrides: {} },
  header: { tool: 't', regenerate: 'r', check: 'c' },
  index: 'out/index.ts',
  indexModule: 'pkg/compat',
  report: 'out/REPORT.md',
  notice: 'out/NOTICE.md',
}

describe('validateConfig', () => {
  it('accepts a complete configuration', () => {
    expect(validateConfig(VALID)).toEqual([])
  })

  it('reports an empty source and request list', () => {
    expect(validateConfig({ ...VALID, sources: {}, requests: [] })).toEqual(['no sources are configured', 'no requests are configured'])
  })

  it('reports a malformed source', () => {
    expect(validateConfig({ ...VALID, sources: { nx: { repo: 'nrwl', ref: '', include: [] } }, requests: [] })).toEqual([
      'source nx: repo must be owner/name, not nrwl',
      'source nx: ref is empty',
      'source nx: include lists no directory',
      'no requests are configured',
    ])
  })

  it('reports an include prefix without a trailing slash', () => {
    expect(
      validateConfig({ ...VALID, sources: { nx: { ...VALID.sources['nx'], include: ['packages/nx/src'] } } } as TypesExtractConfig)
    ).toEqual(['source nx: include prefix packages/nx/src must end with a slash'])
  })

  it('reports a request naming an unknown source, no symbols and a fractional depth', () => {
    const request = { source: 'other', root: 'x.ts', symbols: [], depth: 1.5, output: 'out/b.ts' }
    expect(validateConfig({ ...VALID, requests: [request] })).toEqual([
      'request for out/b.ts: unknown source other',
      'request for out/b.ts: no symbols',
      'request for out/b.ts: depth must be a whole number, not 1.5',
    ])
  })

  it('reports two requests writing one output', () => {
    const request = VALID.requests[0] as TypesExtractConfig['requests'][number]
    expect(validateConfig({ ...VALID, requests: [request, { ...request, symbols: ['B'] }] })).toEqual([
      'request for out/a.ts: output is written by an earlier request',
    ])
  })
})
