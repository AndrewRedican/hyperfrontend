import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { describe, expect, it } from '@hyperfrontend/testing'
import { analyzeChunkNamespaces, stripDeadProperties } from './property-strip'

const analyze = (
  source: string
): { namespaces: Array<{ exported: string; properties: string[] }>; selfDemand: Record<string, 'all' | string[]> } => {
  const { namespaces, selfDemand } = analyzeChunkNamespaces(source, 'esm')
  const demand: Record<string, 'all' | string[]> = {}
  for (const [name, value] of selfDemand) demand[name] = value === 'all' ? 'all' : [...value].sort()
  return { namespaces, selfDemand: demand }
}

describe('analyzeChunkNamespaces recognition', () => {
  it('finds an exported frozen namespace and its property names', () => {
    expect(analyze('const a = 1;\nconst NS = Object.freeze({ a });\nexport { a, NS };').namespaces).toEqual([
      { exported: 'NS', properties: ['a'] },
    ])
  })

  it('recognizes an aliased-global freeze', () => {
    expect(analyze('const _O = globalThis.Object;\nconst a = 1;\nconst NS = _O.freeze({ a });\nexport { NS };').namespaces).toEqual([
      { exported: 'NS', properties: ['a'] },
    ])
  })

  it('reads a string-literal property key', () => {
    expect(analyze("const a = 1;\nconst NS = Object.freeze({ 'a': a });\nexport { NS };").namespaces).toEqual([
      { exported: 'NS', properties: ['a'] },
    ])
  })

  it('records the namespace under its exported alias', () => {
    expect(analyze('const a = 1;\nconst NS = Object.freeze({ a });\nexport { NS as Safe };').namespaces).toEqual([
      { exported: 'Safe', properties: ['a'] },
    ])
  })

  it('skips a namespace that is not exported', () => {
    expect(analyze('const a = 1;\nconst NS = Object.freeze({ a });').namespaces).toEqual([])
  })

  it('skips a frozen array literal', () => {
    expect(analyze('const a = 1;\nconst NS = Object.freeze([a]);\nexport { NS };').namespaces).toEqual([])
  })

  it('skips a literal carrying a spread', () => {
    expect(analyze('const NS = Object.freeze({ ...x });\nexport { NS };').namespaces).toEqual([])
  })

  it('skips a literal with a computed key', () => {
    expect(analyze('const NS = Object.freeze({ [k]: 1 });\nexport { NS };').namespaces).toEqual([])
  })

  it('skips a literal with a method', () => {
    expect(analyze('const NS = Object.freeze({ m() {} });\nexport { NS };').namespaces).toEqual([])
  })

  it('skips a non-freeze initializer', () => {
    expect(analyze('const a = 1;\nconst NS = register({ a });\nexport { NS };').namespaces).toEqual([])
  })

  it('skips a multi-declarator statement', () => {
    expect(analyze('const a = 1;\nconst NS = Object.freeze({ a }), b = 1;\nexport { NS };').namespaces).toEqual([])
  })

  it('skips a local exported under two names', () => {
    expect(analyze('const a = 1;\nconst NS = Object.freeze({ a });\nexport { NS, NS as Alias };').namespaces).toEqual([])
  })
})

describe('analyzeChunkNamespaces self-demand', () => {
  it('reports no self-demand when the namespace is only declared and exported', () => {
    expect(analyze('const a = 1;\nconst NS = Object.freeze({ a });\nexport { NS };').selfDemand).toEqual({})
  })

  it('folds an internal property read into self-demand', () => {
    expect(analyze('const a = 1;\nconst b = 2;\nconst NS = Object.freeze({ a, b });\nconst u = NS.a;\nexport { NS };').selfDemand).toEqual({
      NS: ['a'],
    })
  })

  it('marks the namespace wholesale on an internal escape', () => {
    expect(analyze('const a = 1;\nconst NS = Object.freeze({ a });\nconst u = NS;\nexport { NS };').selfDemand).toEqual({ NS: 'all' })
  })
})

const strip = (source: string, keep: Record<string, string[]>): ReturnType<typeof stripDeadProperties> => {
  const keepByExport = createMap<string, Set<string>>()
  for (const [name, props] of Object.entries(keep)) keepByExport.set(name, createSet(props))
  return stripDeadProperties(source, 'esm', keepByExport)
}

const BASE = 'const a = 1;\nconst b = 2;\nconst NS = Object.freeze({ a, b });\nexport { a, b, NS };'

describe('stripDeadProperties', () => {
  it('drops the slots outside the kept set', () => {
    const result = strip(BASE, { NS: ['a'] })
    expect(result?.removedProperties).toBe(1)
    expect(result?.code).toContain('Object.freeze({ a })')
  })

  it('preserves the original text of a kept key:value slot', () => {
    const result = strip('const a = 1;\nconst NS = Object.freeze({ x: a, y: 2 });\nexport { NS };', { NS: ['x'] })
    expect(result?.code).toContain('Object.freeze({ x: a })')
  })

  it('returns null when the kept set covers every slot', () => {
    expect(strip(BASE, { NS: ['a', 'b'] })).toBeNull()
  })

  it('returns null when nothing in the kept set matches a real slot', () => {
    expect(strip(BASE, { NS: ['zzz'] })).toBeNull()
  })

  it('returns null when the namespace is absent from the keep map', () => {
    expect(strip(BASE, {})).toBeNull()
  })

  it('strips one namespace and leaves another untouched', () => {
    const source =
      'const a = 1;\nconst b = 2;\nconst c = 3;\nconst NS = Object.freeze({ a, b });\nconst MS = Object.freeze({ c });\nexport { NS, MS };'
    const result = strip(source, { NS: ['a'] })
    expect(result?.removedProperties).toBe(1)
    expect(result?.code).toContain('Object.freeze({ a })')
    expect(result?.code).toContain('Object.freeze({ c })')
  })

  it('strips two namespaces in one pass, ordering the edits back-to-front', () => {
    const source =
      'const a = 1;\nconst b = 2;\nconst c = 3;\nconst d = 4;\nconst NS = Object.freeze({ a, b });\nconst MS = Object.freeze({ c, d });\nexport { NS, MS };'
    const result = strip(source, { NS: ['a'], MS: ['c'] })
    expect(result?.removedProperties).toBe(2)
    expect(result?.code).toContain('Object.freeze({ a })')
    expect(result?.code).toContain('Object.freeze({ c })')
  })
})
