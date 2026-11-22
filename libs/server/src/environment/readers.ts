import { createTypeError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { isSafeInteger } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createURL } from '@hyperfrontend/immutable-api-utils/built-in-copy/url'
import { createSecret } from './secret'

/** Turns one raw string into a value. A consumer may write its own as a literal of this shape. */
export interface Reader<Value> {
  /** Completes "expected ..." in an issue line, for example `an integer between 1 and 65535`. */
  readonly expected: string
  /** Whether the value is a secret; a secret may not have a fallback. */
  readonly secret: boolean
  /** Returns the value, or `undefined` when the text is malformed. A throw also counts as malformed, and its message is dropped. So does a returned promise: a reader is synchronous. */
  readonly read: (raw: string) => Value | undefined
}

/** A value that prints `[secret]` through `String`, a template, JSON and inspection. `reveal()` is the only way out. */
export interface Secret {
  /** The secret itself. Use it inside a `try` and throw a message of your own: a parser, an argument check or a client library may quote the text it was given, and `runService` prints the message of a failed start. */
  reveal(): string
}

/** What {@link asPort} is told about the ports it accepts. */
export interface PortOptions {
  /** Whether port 0, which lets the operating system choose, is accepted. */
  readonly allowZero?: boolean
}

/** What {@link asUrl} and {@link asOrigin} are told about the schemes they accept. */
export interface SchemeOptions {
  /** Whether plain `http` is accepted for a host that is not a loopback. */
  readonly allowHttp?: boolean
}

/** What {@link asSecret} is told about the secrets it accepts. */
export interface SecretOptions {
  /** The fewest characters a secret may have; 16 when omitted. */
  readonly minLength?: number
}

// note: A port above zero in decimal digits, with no sign, padding, fraction or exponent.
const PORT = /^[1-9][0-9]{0,4}$/

// note: The largest port TCP has.
const MAX_PORT = 65535

// note: A whole count with no padding, then its unit; fifteen digits keep the count itself a safe integer.
const DURATION = /^(0|[1-9][0-9]{0,14})(ms|s|m|h)$/

// note: Milliseconds in one of each unit a duration may be written in.
const UNIT_MILLISECONDS: Readonly<Record<string, number>> = freeze({ ms: 1, s: 1000, m: 60000, h: 3600000 })

// note: The hosts that never leave the machine, as a parsed URL spells them; plain http to one of them crosses no network.
const LOOPBACK_HOSTS: readonly string[] = freeze(['localhost', '127.0.0.1', '[::1]'])

// note: The shortest secret accepted when a declaration names no length.
const DEFAULT_SECRET_LENGTH = 16

/**
 * Parses a text as a URL a service may be pointed at: `https`, or `http`
 * where that is allowed, and no credentials in it.
 *
 * @param raw - The text to parse.
 * @param allowHttp - Whether plain `http` is accepted for a host that is not a loopback.
 * @returns The parsed URL, or `undefined` for a text that does not parse or is refused.
 */
function parseServiceUrl(raw: string, allowHttp: boolean): URL | undefined {
  let url: URL
  try {
    url = createURL(raw)
  } catch {
    // why: The parser's error quotes its input, so it is dropped and the text is only reported as malformed.
    return undefined
  }
  const schemeAccepted = url.protocol === 'https:' || (url.protocol === 'http:' && (allowHttp || LOOPBACK_HOSTS.includes(url.hostname)))
  return schemeAccepted && url.username === '' && url.password === '' ? url : undefined
}

/**
 * Reads a TCP port written in decimal digits: 1 to 65535, and 0 only with `allowZero`.
 *
 * A sign, a decimal point, an exponent, a hexadecimal form, padding zeros and
 * surrounding whitespace are all refused, so `080` and `1e3` are not ports.
 *
 * @param options - Whether port 0 is accepted; it is not when omitted.
 * @returns A frozen reader that yields the port as a number.
 *
 * @example Declaring a port the operating system may choose
 * ```typescript
 * import { asPort, defineEnvironment, optional } from '@hyperfrontend/server/environment'
 *
 * const environment = defineEnvironment({ http: { PORT: optional(asPort({ allowZero: true }), 8080) } })
 * environment.load({ PORT: '0' }).http.PORT // => 0
 * environment.load({}).http.PORT // => 8080
 * ```
 */
export function asPort(options?: PortOptions): Reader<number> {
  const allowZero = options?.allowZero === true
  return freeze({
    expected: `an integer between ${allowZero ? 0 : 1} and ${MAX_PORT}`,
    secret: false,
    read: (raw: string) => ((allowZero && raw === '0') || (PORT.test(raw) && Number(raw) <= MAX_PORT) ? Number(raw) : undefined),
  })
}

/**
 * Reads an absolute `https` URL without credentials, returned as its normalised string.
 * Plain `http` is accepted for a loopback host, and anywhere with `allowHttp`.
 *
 * The value is a string because a URL object stays mutable even when frozen.
 *
 * @param options - Whether plain `http` is accepted for every host; it is not when omitted.
 * @returns A frozen reader that yields the URL's normalised text.
 *
 * @example Reading an identity provider's address
 * ```typescript
 * import { asUrl } from '@hyperfrontend/server/environment'
 *
 * asUrl().read('https://issuer.example/realms/main') // => 'https://issuer.example/realms/main'
 * asUrl().read('http://issuer.example/') // => undefined
 * asUrl().read('http://localhost:8080/') // => 'http://localhost:8080/'
 * ```
 */
export function asUrl(options?: SchemeOptions): Reader<string> {
  const allowHttp = options?.allowHttp === true
  return freeze({
    expected: `${allowHttp ? 'an http or https' : 'an https'} URL without credentials`,
    secret: false,
    read: (raw: string) => parseServiceUrl(raw, allowHttp)?.href,
  })
}

/**
 * Reads a URL that is exactly an origin (scheme, host, optional port), returned
 * as the serialised origin. The same scheme rule as {@link asUrl}.
 *
 * A path, a query or a fragment is refused, an empty one included. What comes
 * back is the form a browser sends in its `Origin` header: no trailing slash,
 * and no port when the port is the scheme's default.
 *
 * @param options - Whether plain `http` is accepted for every host; it is not when omitted.
 * @returns A frozen reader that yields the serialised origin.
 *
 * @example Reading the origin of the site that calls a service
 * ```typescript
 * import { asOrigin } from '@hyperfrontend/server/environment'
 *
 * asOrigin().read('https://site.example:443/') // => 'https://site.example'
 * asOrigin().read('https://site.example/app') // => undefined
 * ```
 */
export function asOrigin(options?: SchemeOptions): Reader<string> {
  const allowHttp = options?.allowHttp === true
  return freeze({
    expected: `${allowHttp ? 'an http or https' : 'an https'} origin (scheme, host and optional port)`,
    secret: false,
    read: (raw: string) => {
      const url = parseServiceUrl(raw, allowHttp)
      return url !== undefined && url.href === `${url.origin}/` ? url.origin : undefined
    },
  })
}

/**
 * Reads `250ms`, `30s`, `5m` or `1h` as milliseconds.
 *
 * The count is a whole number without padding, and the unit is required, so
 * a bare `30` is refused instead of being guessed at.
 *
 * @returns A frozen reader that yields a whole number of milliseconds.
 *
 * @example Reading a refresh interval
 * ```typescript
 * import { asDuration } from '@hyperfrontend/server/environment'
 *
 * asDuration().read('5m') // => 300000
 * asDuration().read('30') // => undefined
 * ```
 */
export function asDuration(): Reader<number> {
  return freeze({
    expected: 'a duration such as 250ms, 30s, 5m or 1h',
    secret: false,
    read: (raw: string) => {
      const match = DURATION.exec(raw)
      if (match === null) return undefined
      // why: the pattern captures both groups whenever it matches and admits no unit outside the table
      const milliseconds = Number(match[1]) * (UNIT_MILLISECONDS[match[2] as string] as number)
      return isSafeInteger(milliseconds) ? milliseconds : undefined
    },
  })
}

/**
 * Reads a secret of at least `minLength` characters, 16 when omitted, wrapped
 * so that it cannot be printed by accident.
 *
 * The reader is marked as a secret, so a declaration that gives it a fallback
 * is refused: a default secret must never be written in source.
 *
 * @param options - The fewest characters a secret may have.
 * @returns A frozen reader that yields the wrapped secret.
 * @throws {TypeError} When `minLength` is not a positive integer.
 *
 * @example Reading a service key
 * ```typescript
 * import { asSecret, defineEnvironment, required } from '@hyperfrontend/server/environment'
 *
 * const environment = defineEnvironment({ service: { SERVICE_KEY: required(asSecret({ minLength: 32 })) } })
 * const { SERVICE_KEY } = environment.load({ SERVICE_KEY: 'a-key-of-thirty-two-characters-ok' }).service
 * String(SERVICE_KEY) // => '[secret]'
 * SERVICE_KEY.reveal() // => 'a-key-of-thirty-two-characters-ok'
 * ```
 */
export function asSecret(options?: SecretOptions): Reader<Secret> {
  const minLength = options?.minLength ?? DEFAULT_SECRET_LENGTH
  if (!isSafeInteger(minLength) || minLength < 1) {
    throw createTypeError('asSecret: "minLength" must be a positive integer.')
  }
  return freeze({
    expected: `a secret of at least ${minLength} characters`,
    secret: true,
    read: (raw: string) => (raw.length >= minLength ? createSecret(raw) : undefined),
  })
}

/**
 * Reads any non-empty text, as it is: nothing is trimmed.
 *
 * @returns A frozen reader that yields the text.
 *
 * @example Reading a host name
 * ```typescript
 * import { asText } from '@hyperfrontend/server/environment'
 *
 * asText().read('0.0.0.0') // => '0.0.0.0'
 * asText().read('') // => undefined
 * ```
 */
export function asText(): Reader<string> {
  return freeze({ expected: 'non-empty text', secret: false, read: (raw: string) => (raw === '' ? undefined : raw) })
}
