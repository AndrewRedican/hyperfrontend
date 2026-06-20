import type { PropDemand } from './namespace-usage'
import ts from 'typescript'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { parseChunk } from './ast-utils'
import { classifyNamespaceUse, collectNamespaceUsage, mergeDemand } from './namespace-usage'

const TARGET = '/p/d/index.esm.js'

// context: serialize the usage of the single `./d/index.esm.js` target into a comparable shape.
const usageOf = (source: string): 'absent' | 'bailAll' | Record<string, 'all' | string[]> => {
  const target = collectNamespaceUsage(source, '/p', 'esm').get(TARGET)
  if (!target) return 'absent'
  if (target.bailAll) return 'bailAll'
  const out: Record<string, 'all' | string[]> = {}
  for (const [name, demand] of target.perName) out[name] = demand === 'all' ? 'all' : [...demand].sort()
  return out
}

const importNs = (use: string): string => `import { SafeObject } from './d/index.esm.js';\n${use}`

describe('collectNamespaceUsage', () => {
  it('records a static property read of a named import', () => {
    expect(usageOf(importNs('SafeObject.freeze(x);'))).toEqual({ SafeObject: ['freeze'] })
  })

  it('unions multiple reads of the same import', () => {
    expect(usageOf(importNs('SafeObject.freeze(x);\nSafeObject.keys(y);'))).toEqual({ SafeObject: ['freeze', 'keys'] })
  })

  it('tracks reads through an import alias', () => {
    expect(usageOf("import { SafeObject as S } from './d/index.esm.js';\nS.keys(y);")).toEqual({ SafeObject: ['keys'] })
  })

  it('records a string element-access read', () => {
    expect(usageOf(importNs("SafeObject['freeze'](x);"))).toEqual({ SafeObject: ['freeze'] })
  })

  it('bails the name on a dynamic element-access read', () => {
    expect(usageOf(importNs('SafeObject[k](x);'))).toEqual({ SafeObject: 'all' })
  })

  it('bails the name when the namespace is spread', () => {
    expect(usageOf(importNs('const o = { ...SafeObject };'))).toEqual({ SafeObject: 'all' })
  })

  it('bails the name when the namespace is passed wholesale', () => {
    expect(usageOf(importNs('use(SafeObject);'))).toEqual({ SafeObject: 'all' })
  })

  it('bails the name when the import is re-exported by local name', () => {
    expect(usageOf(importNs('export { SafeObject };'))).toEqual({ SafeObject: 'all' })
  })

  it('ignores the binding occurrence and an unused import yields no demand', () => {
    expect(usageOf("import { SafeObject } from './d/index.esm.js';\nconst x = 1;")).toEqual({})
  })

  it('ignores the namespace name sitting as another object member', () => {
    expect(usageOf(importNs('host.SafeObject;'))).toEqual({})
  })

  it('ignores the namespace name sitting as an object-literal key', () => {
    expect(usageOf(importNs('const o = { SafeObject: 1 };'))).toEqual({})
  })

  it('marks the target wholesale for a namespace import', () => {
    expect(usageOf("import * as ns from './d/index.esm.js';\nns.SafeObject;")).toBe('bailAll')
  })

  it('marks the target wholesale for a default import', () => {
    expect(usageOf("import d from './d/index.esm.js';\nd.SafeObject;")).toBe('bailAll')
  })

  it('marks the re-exported name wholesale for a re-export with a specifier', () => {
    expect(usageOf("export { SafeObject } from './d/index.esm.js';")).toEqual({ SafeObject: 'all' })
  })

  it('marks the source name wholesale for an aliased re-export with a specifier', () => {
    expect(usageOf("export { SafeObject as Alias } from './d/index.esm.js';")).toEqual({ SafeObject: 'all' })
  })

  it('marks the target wholesale for an export-star', () => {
    expect(usageOf("export * from './d/index.esm.js';")).toBe('bailAll')
  })

  it('omits a side-effect-only import that binds nothing', () => {
    expect(usageOf("import './d/index.esm.js';")).toBe('absent')
  })

  it('ignores a non-relative bare import', () => {
    expect(collectNamespaceUsage("import { SafeObject } from 'pkg';\nSafeObject.freeze(x);", '/p', 'esm').size).toBe(0)
  })

  it('ignores a re-export with a non-relative specifier', () => {
    expect(collectNamespaceUsage("export { SafeObject } from 'pkg';", '/p', 'esm').size).toBe(0)
  })

  it('yields no edges when scanning ESM-syntax source as CJS', () => {
    expect(collectNamespaceUsage(importNs('SafeObject.freeze(x);'), '/p', 'cjs').size).toBe(0)
  })
})

const TARGET_CJS = '/p/d/index.cjs.js'

const usageOfCjs = (source: string): 'absent' | 'bailAll' | Record<string, 'all' | string[]> => {
  const target = collectNamespaceUsage(source, '/p', 'cjs').get(TARGET_CJS)
  if (!target) return 'absent'
  if (target.bailAll) return 'bailAll'
  const out: Record<string, 'all' | string[]> = {}
  for (const [name, demand] of target.perName) out[name] = demand === 'all' ? 'all' : [...demand].sort()
  return out
}

const requireNs = (use: string): string => `var dep = require('./d/index.cjs.js');\n${use}`

describe('collectNamespaceUsage (CJS)', () => {
  it('records a side-effect-only require as reached with no property demand', () => {
    expect(usageOfCjs("require('./d/index.cjs.js');")).toEqual({})
  })

  it('records a two-level property read off a whole-module require binding', () => {
    expect(usageOfCjs(requireNs('dep.SafeObject.freeze(x);'))).toEqual({ SafeObject: ['freeze'] })
  })

  it('unions two-level reads of the same export', () => {
    expect(usageOfCjs(requireNs('dep.SafeObject.freeze(x);\ndep.SafeObject.keys(y);'))).toEqual({ SafeObject: ['freeze', 'keys'] })
  })

  it('records a string element-access at each level', () => {
    expect(usageOfCjs(requireNs("dep['SafeObject']['freeze'](x);"))).toEqual({ SafeObject: ['freeze'] })
  })

  it('bails the export when the module binding selects it but consumes it wholesale', () => {
    expect(usageOfCjs(requireNs('use(dep.SafeObject);'))).toEqual({ SafeObject: 'all' })
  })

  it('bails the export on a dynamic property index of a selected export', () => {
    expect(usageOfCjs(requireNs('dep.SafeObject[k](x);'))).toEqual({ SafeObject: 'all' })
  })

  it('bails the whole target on a dynamic export index of the module binding', () => {
    expect(usageOfCjs(requireNs('dep[k].freeze(x);'))).toBe('bailAll')
  })

  it('bails the whole target when the module binding is consumed wholesale', () => {
    expect(usageOfCjs(requireNs('use(dep);'))).toBe('bailAll')
  })

  it('ignores the module binding sitting as another object member', () => {
    expect(usageOfCjs(requireNs('host.dep;'))).toEqual({})
  })

  it('tracks a destructured require binding one-level', () => {
    expect(usageOfCjs("var { SafeObject } = require('./d/index.cjs.js');\nSafeObject.freeze(x);")).toEqual({ SafeObject: ['freeze'] })
  })

  it('tracks an aliased destructured require binding', () => {
    expect(usageOfCjs("var { SafeObject: S } = require('./d/index.cjs.js');\nS.keys(y);")).toEqual({ SafeObject: ['keys'] })
  })

  it('bails the whole target on a rest destructure', () => {
    expect(usageOfCjs("var { ...rest } = require('./d/index.cjs.js');\nrest.SafeObject.freeze(x);")).toBe('bailAll')
  })

  it('records an inline require member read', () => {
    expect(usageOfCjs("require('./d/index.cjs.js').SafeObject.freeze(x);")).toEqual({ SafeObject: ['freeze'] })
  })

  it('records an inline require string element-access member read', () => {
    expect(usageOfCjs("require('./d/index.cjs.js')['SafeObject'].freeze(x);")).toEqual({ SafeObject: ['freeze'] })
  })

  it('bails the whole target on a nested destructure binding', () => {
    expect(usageOfCjs("var { SafeObject: { freeze } } = require('./d/index.cjs.js');\nfreeze(x);")).toBe('bailAll')
  })

  it('bails the whole target on an array-destructured require binding', () => {
    expect(usageOfCjs("var [first] = require('./d/index.cjs.js');\nfirst.freeze(x);")).toBe('bailAll')
  })

  it('bails the whole target on an inline dynamic require member', () => {
    expect(usageOfCjs("require('./d/index.cjs.js')[k].freeze(x);")).toBe('bailAll')
  })

  it('bails the whole target when require escapes into a call argument', () => {
    expect(usageOfCjs("use(require('./d/index.cjs.js'));")).toBe('bailAll')
  })

  it('ignores a require with a non-relative specifier', () => {
    expect(collectNamespaceUsage("var dep = require('pkg');\ndep.SafeObject.freeze(x);", '/p', 'cjs').size).toBe(0)
  })
})

// context: classify the first occurrence of `NS` in a snippet.
const classify = (source: string): ReturnType<typeof classifyNamespaceUse> => {
  const sourceFile = parseChunk(source)
  let result: ReturnType<typeof classifyNamespaceUse> | undefined
  const visit = (node: ts.Node): void => {
    if (result === undefined && ts.isIdentifier(node) && node.text === 'NS') result = classifyNamespaceUse(node)
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return <ReturnType<typeof classifyNamespaceUse>>result
}

describe('classifyNamespaceUse', () => {
  it('reads a property access', () => {
    expect(classify('NS.freeze')).toEqual({ kind: 'read', prop: 'freeze' })
  })

  it('ignores a member-name position', () => {
    expect(classify('host.NS')).toEqual({ kind: 'ignore' })
  })

  it('reads a string element access', () => {
    expect(classify("NS['freeze']")).toEqual({ kind: 'read', prop: 'freeze' })
  })

  it('bails a dynamic element access', () => {
    expect(classify('NS[k]')).toEqual({ kind: 'bail' })
  })

  it('bails when the binding is itself an element-access argument', () => {
    expect(classify('host[NS]')).toEqual({ kind: 'bail' })
  })

  it('ignores an object-literal key', () => {
    expect(classify('const o = { NS: 1 }')).toEqual({ kind: 'ignore' })
  })

  it('ignores a binding-element property name', () => {
    expect(classify('const { NS: x } = src')).toEqual({ kind: 'ignore' })
  })

  it('bails any other position', () => {
    expect(classify('use(NS)')).toEqual({ kind: 'bail' })
  })
})

const dump = (demand: PropDemand): 'all' | string[] => (demand === 'all' ? 'all' : [...demand].sort())

describe('mergeDemand', () => {
  it('seeds a fresh name with a copy of the contribution', () => {
    const map = new Map<string, PropDemand>()
    mergeDemand(map, 'X', createSet(['a']))
    expect(dump(<PropDemand>map.get('X'))).toEqual(['a'])
  })

  it('unions two set contributions', () => {
    const map = new Map<string, PropDemand>([['X', createSet(['a'])]])
    mergeDemand(map, 'X', createSet(['b']))
    expect(dump(<PropDemand>map.get('X'))).toEqual(['a', 'b'])
  })

  it('promotes a set to all', () => {
    const map = new Map<string, PropDemand>([['X', createSet(['a'])]])
    mergeDemand(map, 'X', 'all')
    expect(map.get('X')).toBe('all')
  })

  it('keeps all absorbing against a later set', () => {
    const map = new Map<string, PropDemand>([['X', 'all']])
    mergeDemand(map, 'X', createSet(['a']))
    expect(map.get('X')).toBe('all')
  })
})
