import ts from 'typescript'
import { from } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { parseChunk } from './ast-utils'
import { analyzeChunk } from './chunk-graph'
import { collectIdentifierTexts, uniqueLocal } from './chunk-names'

/**
 * Outcome of synthesizing missing named exports onto a single ESM chunk.
 */
export interface SynthesisResult {
  /** Rewritten chunk source with the synthesized bindings appended. */
  code: string
  /** Exported names that were synthesized, in emission order. */
  synthesizedNames: string[]
}

const IDENTIFIER_NAME = /^[A-Za-z_$][A-Za-z0-9_$]*$/

const interopSourceLocal = (sourceFile: ts.SourceFile, defaultLocal: string): string | null => {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const decl of statement.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || decl.name.text !== defaultLocal) continue
      const initializer = decl.initializer
      // why: `getDefaultExportFromCjs(...)` is the commonjs plugin's interop marker; only a chunk carrying it is a CJS wrap whose runtime surface lives behind the default object.
      if (
        initializer !== undefined &&
        ts.isCallExpression(initializer) &&
        ts.isIdentifier(initializer.expression) &&
        initializer.expression.text === 'getDefaultExportFromCjs'
      )
        return decl.name.text
    }
  }
  return null
}

/**
 * Appends named-export bindings for demanded names a CJS-interop ESM wrapper
 * does not export, reading each from the wrapper's interop default object.
 *
 * The commonjs plugin's ESM wrap of a dynamically-shaped CJS dependency (one
 * whose `module.exports` is assembled inside the lazy `require` closure) can
 * only emit a default export, yet first-party consumers written against the
 * dependency's typings import named bindings — which native ESM then refuses at
 * link time, while the CJS twin resolves the same names at runtime. For every
 * demanded-but-missing name this appends `const <name> = <default>.<name>;`
 * plus a closing `export { ... };`, reproducing exactly what the CJS twin's
 * consumers observe. Chunks without a `getDefaultExportFromCjs(...)` interop
 * default are left untouched: a missing name on a genuine ESM surface is a real
 * error that must stay observable.
 *
 * @param source - Raw ESM chunk source text.
 * @param demanded - Named exports importers demand from this chunk.
 * @returns The rewritten source and synthesized names, or `null` when nothing
 * needs synthesizing or the chunk is not a CJS-interop wrap.
 *
 * @example Satisfying a named import from a default-only wrapper
 * ```typescript
 * synthesizeMissingNamedExports(wrapperSource, createSet(['inject']))
 * ```
 */
export const synthesizeMissingNamedExports = (source: string, demanded: Set<string>): SynthesisResult | null => {
  if (demanded.size === 0) return null
  const sourceFile = parseChunk(source)
  const model = analyzeChunk(sourceFile, 'esm')
  const exported = createSet(model.exports.map((entry) => entry.exported))
  // why: `default` is only demanded via re-export lists and can never be synthesized from itself; non-identifier names cannot be read off the default with a plain member access.
  const missing = from(demanded)
    .filter((name) => !exported.has(name) && name !== 'default' && IDENTIFIER_NAME.test(name))
    .sort()
  if (missing.length === 0) return null
  const defaultEntry = model.exports.find((entry) => entry.exported === 'default')
  if (defaultEntry === undefined) return null
  const defaultLocal = interopSourceLocal(sourceFile, defaultEntry.local)
  if (defaultLocal === null) return null
  const taken = collectIdentifierTexts(sourceFile)
  const lines: string[] = []
  const bindings: string[] = []
  for (const name of missing) {
    const local = uniqueLocal(name, taken)
    taken.add(local)
    lines.push(`const ${local} = ${defaultLocal}.${name};`)
    bindings.push(local === name ? name : `${local} as ${name}`)
  }
  const block = `${lines.join('\n')}\nexport { ${bindings.join(', ')} };`
  return { code: `${source}${source.endsWith('\n') ? '' : '\n'}${block}\n`, synthesizedNames: missing }
}
