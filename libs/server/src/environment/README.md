# environment

Declares the environment variables a service reads, as data: named variables in groups, a typed reader for each, and one check that reports every missing or malformed variable without repeating a value.

This entry imports no Node.js built-in and never reads the process environment itself. The environment is always passed in, so a service hands over `process.env` at boot and a test hands over an object.

```ts
import { asPort, asSecret, asText, defineEnvironment, optional, required } from '@hyperfrontend/server/environment'

const environment = defineEnvironment({
  http: { PORT: optional(asPort({ allowZero: true }), 8080), HOST: optional(asText(), '0.0.0.0') },
  hello: { HELLO_GREETING: required(asText()), HELLO_KEY: required(asSecret()) },
})

const values = environment.load({ HELLO_GREETING: 'Hello', HELLO_KEY: 'a-key-of-sixteen-characters-or-more' })
values.http.PORT // 8080, a number: the fallback of an unset variable
values.hello.HELLO_GREETING // 'Hello'
String(values.hello.HELLO_KEY) // '[secret]'
```

## Usage

The outer keys are group names and the inner keys are the variables' names as the environment spells them. The values come back under the same two keys, each typed by its reader, and frozen. A group is a plain object, so a group that several services share is a constant spread into each declaration.

At boot a service loads the process environment and stops when it is not valid. [`load`](https://www.hyperfrontend.dev/docs/libraries/server/environment/#api-EnvironmentContract) throws one error named EnvironmentError whose message lists every problem, so a deployment is fixed in one pass instead of one variable per restart:

```ts
import { asPort, asSecret, asText, defineEnvironment, optional, required } from '@hyperfrontend/server/environment'

const environment = defineEnvironment({
  http: { PORT: optional(asPort({ allowZero: true }), 8080) },
  hello: { HELLO_GREETING: required(asText()), HELLO_KEY: required(asSecret()) },
})

try {
  const values = environment.load(process.env)
  console.log(`${values.hello.HELLO_GREETING} from port ${values.http.PORT}`)
} catch (error) {
  console.error(String(error))
  process.exitCode = 1
}
```

```text
EnvironmentError: Invalid environment:
  - PORT (http) is malformed; expected an integer between 0 and 65535.
  - HELLO_GREETING (hello) is missing; expected non-empty text.
  - HELLO_KEY (hello) is missing; expected a secret of at least 16 characters.
```

A service that runs on [`runService`](https://www.hyperfrontend.dev/docs/libraries/server/#api-runService) does not load the environment itself. It hands the contract over in its definition; the runner checks the process environment before the start function runs, prints the problems as one block on standard error and ends the process with exit code 78, and the start function receives the typed values.

[`check`](https://www.hyperfrontend.dev/docs/libraries/server/environment/#api-EnvironmentContract) returns the same problems as a list and never throws, for a tool that prints or counts them itself:

```ts
import { asPort, asText, defineEnvironment, optional, required } from '@hyperfrontend/server/environment'

const environment = defineEnvironment({
  http: { PORT: optional(asPort(), 8080) },
  hello: { HELLO_GREETING: required(asText()) },
})

environment.check({ PORT: 'eighty' })
// [
//   { name: 'PORT', group: 'http', problem: 'malformed', expected: 'an integer between 1 and 65535' },
//   { name: 'HELLO_GREETING', group: 'hello', problem: 'missing', expected: 'non-empty text' },
// ]
```

[`variables`](https://www.hyperfrontend.dev/docs/libraries/server/environment/#api-EnvironmentContract-prop-variables) is the declaration as data, in declaration order: the name, the group, whether the variable is required, whether it is a secret, and the phrase that describes it. A build step or a documentation table reads it without loading anything.

## Configuration

### Variables

| Declared with                                                                               | When the variable is unset                    | When it is set                                           |
| ------------------------------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------- |
| [`required`](https://www.hyperfrontend.dev/docs/libraries/server/environment/#api-required) | A problem, reported as missing                | Read; a value the reader refuses is a problem, malformed |
| [`optional`](https://www.hyperfrontend.dev/docs/libraries/server/environment/#api-optional) | The fallback, as given and without being read | Read; a value the reader refuses is a problem, malformed |

A variable is unset when the environment holds nothing under its name, or the empty string. A set value is handed to the reader as it is, untrimmed. A set but malformed value is never replaced by the fallback: a typing mistake in a deployment is reported, not hidden behind a default. Names the declaration does not mention are ignored.

A variable that may be absent with no value at all takes a fallback of nothing: `optional<string | undefined>(asText(), undefined)`.

### Readers

| Reader                                                                                          | Accepts                                                                                                                                                                    | Returns                                  |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| [`asPort`](https://www.hyperfrontend.dev/docs/libraries/server/environment/#api-asPort)         | Decimal digits from 1 to 65535, with no sign, padding, fraction or exponent; 0 as well with `asPort({ allowZero: true })`                                                  | The port, a number                       |
| [`asUrl`](https://www.hyperfrontend.dev/docs/libraries/server/environment/#api-asUrl)           | An absolute `https` URL without credentials; plain `http` for a loopback host (the name localhost, `127.0.0.1` and `[::1]`), or any host with `asUrl({ allowHttp: true })` | The normalised URL, a string             |
| [`asOrigin`](https://www.hyperfrontend.dev/docs/libraries/server/environment/#api-asOrigin)     | A URL under the same scheme rule that is an origin and nothing more: no path, no query, no fragment                                                                        | The origin, with no trailing slash       |
| [`asDuration`](https://www.hyperfrontend.dev/docs/libraries/server/environment/#api-asDuration) | A whole count and its unit, as in `250ms`, `30s`, `5m` or `1h`                                                                                                             | Milliseconds, a number                   |
| [`asSecret`](https://www.hyperfrontend.dev/docs/libraries/server/environment/#api-asSecret)     | At least 16 characters, or the count given as `asSecret({ minLength: 32 })`                                                                                                | The text wrapped so that it cannot print |
| [`asText`](https://www.hyperfrontend.dev/docs/libraries/server/environment/#api-asText)         | Any text that is not empty                                                                                                                                                 | The text as it is                        |

Every reader refuses what it cannot read exactly: a port written `080` or `1e3`, a duration without a unit, an origin with a path. The two URL readers return strings because a URL object can still be changed after it is frozen.

### A reader of your own

A reader is an object of three members, so a service writes its own as a literal:

```ts
import type { Reader } from '@hyperfrontend/server/environment'
import { defineEnvironment, required } from '@hyperfrontend/server/environment'

const asLogLevel: Reader<'debug' | 'info' | 'error'> = {
  expected: 'one of debug, info or error',
  secret: false,
  read: (raw) => (raw === 'debug' || raw === 'info' || raw === 'error' ? raw : undefined),
}

const environment = defineEnvironment({ logging: { LOG_LEVEL: required(asLogLevel) } })
environment.load({ LOG_LEVEL: 'info' }).logging.LOG_LEVEL // 'info'
```

The function returns the value, or nothing for a text it refuses. It is synchronous: a returned promise counts as a refusal, and so does a throw, whose message is dropped because it may quote the text. The phrase completes the sentence "expected ..." in a problem line and is printed as written, so it describes the format and never holds a value.

### Secrets

What [`asSecret`](https://www.hyperfrontend.dev/docs/libraries/server/environment/#api-asSecret) returns prints as `[secret]` through string conversion, a template, JSON and Node.js inspection, and gives the text back only through `reveal()`. A log line, an error message or a JSON response that picks one up by accident shows the mask.

A secret is always required. A declaration that gives one a fallback is refused, because a default secret would be a secret written in source.

The wrapper guards against printing by accident and nothing more. The text stays in the memory of the process and in the environment it was read from, and any code that holds the wrapper can reveal it.

### Problems

No problem, error message or description holds a value: not the text a variable was set to, not a fallback, and not what a reader threw. Each names the variable, its group and the reader's phrase, so all of them are safe to log.

[`defineEnvironment`](https://www.hyperfrontend.dev/docs/libraries/server/environment/#api-defineEnvironment) checks the declaration itself and throws once, with a line per fault: a group that is not a plain object or is named `__proto__`, a variable name that is not upper-case letters, digits and underscores starting with a letter, a value that was not built by [`required`](https://www.hyperfrontend.dev/docs/libraries/server/environment/#api-required) or [`optional`](https://www.hyperfrontend.dev/docs/libraries/server/environment/#api-optional), a name declared in two groups, and a secret with a fallback.
