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
 * single argument. This is the behaviour the suites were written against.
 *
 * @param row - The row as authored in the table.
 * @returns The arguments to invoke the test body with.
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
