import { format } from 'node:util'
import { formatValue } from '../expect/format'

/**
 * A single row of a parameterised table, already spread into call arguments.
 */
export type EachRow = unknown[]

/**
 * Normalises a table row into the argument list the test body receives.
 *
 * A row that is itself an array is spread across parameters; any other value becomes a
 * single argument, which is Jest's behaviour.
 *
 * @param row - The row as authored in the table.
 * @returns The arguments to invoke the test body with.
 * @example Spreading an array row and wrapping anything else
 * ```ts
 * rowArguments([1, 2]) // => [1, 2], spread across the body's parameters
 * rowArguments({ port: 8080 }) // => [{ port: 8080 }], a single argument
 * ```
 */
export function rowArguments(row: unknown): EachRow {
  return Array.isArray(row) ? row : [row]
}

/**
 * Renders a parameterised test title.
 *
 * `%p` and `%#` have no `util.format` equivalent, so they are substituted first: `%p`
 * becomes the pretty-printed argument and `%#` the zero-based row index. Everything else
 * is left to `util.format`. A title with no placeholder gets the arguments appended, so
 * rows stay distinguishable in the report.
 *
 * @param title - The title template as authored.
 * @param args - The arguments for this row.
 * @param index - The row's position in the table.
 * @returns The rendered title.
 * @example Rendering each placeholder kind
 * ```ts
 * formatTitle('treats %s as compressible', ['/big.json'], 0) // => 'treats /big.json as compressible'
 * formatTitle('rejects the port %p', ['8080'], 0) // => "rejects the port '8080'"
 * formatTitle('case %#', ['x'], 3) // => 'case 3'
 * formatTitle('pairs', ['a', 1], 0) // => "pairs [ 'a', 1 ]", the row appended when there is no placeholder
 * ```
 */
export function formatTitle(title: string, args: EachRow, index: number): string {
  if (!title.includes('%')) return `${title} ${formatValue(args.length === 1 ? args[0] : args)}`

  let cursor = 0
  // how: one pass keeps each placeholder aligned with its own argument, whatever order the kinds appear in.
  return title.replace(/%[sdifjop#%]/g, (token) => {
    if (token === '%%') return '%'
    if (token === '%#') return String(index)
    if (cursor >= args.length) return token
    const argument = args[cursor++]
    return token === '%p' ? formatValue(argument) : format(token, argument)
  })
}
