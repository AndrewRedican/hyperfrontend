import type { ServiceResponse } from './contract'
import { createTypeError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { setHeader } from './headers'

/**
 * Writes a value as JSON text, refusing what JSON has no form for.
 *
 * @param value - The value to write.
 * @returns The value serialised.
 * @throws {TypeError} With a fixed message when the value has no JSON form or cannot be walked.
 */
function jsonText(value: unknown): string {
  let text: string | undefined
  try {
    text = stringify(value)
  } catch {
    // why: the engine's message for a cycle or a BigInt, and whatever a `toJSON` throws, may quote the value
    text = undefined
  }
  if (text === undefined) {
    throw createTypeError('jsonResponse: the value cannot be represented as JSON.')
  }
  return text
}

/**
 * Builds a JSON response with `Content-Type: application/json; charset=utf-8`. A header given under any spelling of that name replaces it. Throws a `TypeError` for a value JSON cannot represent.
 *
 * @param status - The response status; it is judged where the response is checked, not here.
 * @param value - The value written as the body.
 * @param headers - Headers added after the content type; none when omitted.
 * @returns The response, its body the UTF-8 JSON text.
 * @throws {TypeError} For `undefined`, a function, a symbol, a `BigInt` or a cycle, with a fixed message that holds nothing of the value.
 *
 * @example Answering with a document that is never stored
 * ```typescript
 * import { jsonResponse } from '@hyperfrontend/server'
 *
 * jsonResponse(200, { ready: true }, { 'Cache-Control': 'no-store' })
 * // => { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, body: <{"ready":true}> }
 * ```
 */
export function jsonResponse(status: number, value: unknown, headers?: Readonly<Record<string, string>>): ServiceResponse {
  const given = headers ?? {}
  const contentType: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8' }
  return {
    status,
    headers: keys(given).reduce((merged, name) => setHeader(merged, name, given[name] as string), contentType),
    body: Buffer.from(jsonText(value)),
  }
}
