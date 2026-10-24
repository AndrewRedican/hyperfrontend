import type { DocsSymbol } from './docs-api.ts'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createDocsWorkspace } from '../__test-utils__/docs-workspace.ts'
import { listSources, readDeclarations, readSymbols } from './docs-api.ts'

const root = createDocsWorkspace()
const alpha = join(root, 'libs/alpha/src')
const symbols = readSymbols(join(alpha, 'index.ts'))

/**
 * A symbol of the alpha entry, compactly.
 *
 * @param name - The symbol
 * @returns Its kind, members, properties and methods
 */
function described(name: string): string {
  const symbol = symbols.get(name) as DocsSymbol
  return `${symbol.kind} [${symbol.members.join(',')}] [${symbol.properties.join(',')}] [${symbol.methods.join(',')}]`
}

describe('readSymbols', () => {
  it('lists the names the entry exports, through star and named re-exports', () => {
    expect([...symbols.keys()].sort()).toEqual(
      [
        'thing',
        'sharedName',
        'aliased',
        'plain',
        'quotedName',
        'hidden',
        'config',
        'literal',
        'nothing',
        'main',
        'declared',
        'Shape',
        'Union',
        'Color',
        'Widget',
        'createWidget',
        'shape',
        'Other',
      ].sort()
    )
  })

  it('reads an interface', () => {
    expect(described('Shape')).toBe('interface [width,area,2] [width,2] []')
  })

  it('reads a type alias of unions, intersections and literal types', () => {
    expect(described('Union')).toBe('type [left,right,tag,inner,other] [] []')
  })

  it('reads an enum with its string values', () => {
    expect(described('Color')).toBe('enum [Red,red,Blue,Quoted] [] []')
  })

  it('reads a class, leaving out private members and the constructor', () => {
    expect(described('Widget')).toBe('class [size,run,handler,typed,guarded,count,value] [size,typed,guarded,count] [run,handler]')
  })

  it('reads a variable initialised with an object literal through a call or an assertion', () => {
    expect([described('config'), described('literal'), described('shape')]).toEqual([
      'variable [mode,fast,method,key,size,v] [] []',
      'variable [a] [] []',
      'variable [] [] []',
    ])
  })

  it('reads functions, declared functions and re-exported variables', () => {
    expect([described('main'), described('declared'), described('aliased'), described('nothing')]).toEqual([
      'function [] [] []',
      'function [] [] []',
      'variable [] [] []',
      'variable [] [] []',
    ])
  })

  it('leaves a name exported without a source unknown', () => {
    expect(described('hidden')).toBe('unknown [] [] []')
  })

  it('reads nothing from a missing or broken file', () => {
    expect([readSymbols(join(alpha, 'missing.ts')).size, readSymbols(join(alpha, 'broken.ts')).size]).toEqual([0, 0])
  })
})

describe('listSources', () => {
  it('lists the sources, leaving out tests, fixtures, hidden directories and other extensions', () => {
    const sources = listSources(alpha).map((file) => file.slice(alpha.length + 1))
    expect(sources.filter((file) => /spec|__fixtures__|hidden|tsx/.test(file))).toEqual([])
  })

  it('lists nothing for a missing directory', () => {
    expect(listSources(join(root, 'nowhere'))).toEqual([])
  })
})

describe('readDeclarations', () => {
  it('maps each declaration other than a variable to its files', () => {
    const declarations = readDeclarations(listSources(alpha))
    expect([declarations.get('onlyHere'), declarations.get('twice')?.length, declarations.has('variableOnly')]).toEqual([
      [join(alpha, 'local.ts')],
      2,
      false,
    ])
  })
})

describe('the disposable workspace', () => {
  it('is removed at the end', () => {
    rmSync(root, { recursive: true, force: true })
    expect(existsSync(root)).toBe(false)
  })
})
