# How to validate a config file at startup

You will turn a config file into something your process refuses to boot without, and get every problem in it named at once instead of one crash at a time.

A bad value in a config file surfaces wherever it is finally read: a pool size of `0` becomes a hung request an hour later, a mistyped log level becomes silence. [`@hyperfrontend/json-utils`](/docs/libraries/utils/json) checks the whole file against a schema before any of it is used, and reports every failure with the path it came from.

## 1. Install it

```bash
npm install @hyperfrontend/json-utils
```

## 2. Start the schema from a config you already trust

Writing a schema by hand for an existing file is transcription. Hand [`toJsonSchema`](/docs/libraries/utils/json#api-toJsonSchema) a config you know is good and it infers the shape, marking every key it sees as required:

```ts
import { toJsonSchema } from '@hyperfrontend/json-utils'

toJsonSchema({
  port: 8080,
  host: '0.0.0.0',
  logLevel: 'info',
  database: { url: 'postgres://localhost/app', poolSize: 10 },
})
// { type: 'object', properties: { port: { type: 'integer' }, … }, required: ['port', 'host', 'logLevel', 'database'] }
```

Print it once, paste it into your source, and edit from there.

## 3. Tighten it into the contract you actually want

The generated shape only knows types. Add the constraints that carry your real rules: ranges, the closed set of allowed values, which keys are optional, and whether unknown keys are a typo or a feature.

```ts
import type { Schema } from '@hyperfrontend/json-utils'

const configSchema: Schema = {
  type: 'object',
  properties: {
    port: { type: 'integer', minimum: 1, maximum: 65535 },
    host: { type: 'string', minLength: 1 },
    logLevel: { enum: ['error', 'warn', 'info', 'debug'] },
    database: {
      type: 'object',
      properties: {
        url: { type: 'string', format: 'uri' },
        poolSize: { type: 'integer', minimum: 1, maximum: 100 },
      },
      required: ['url'],
    },
  },
  required: ['port', 'database'],
  additionalProperties: false,
}
```

The keyword vocabulary is [JSON Schema Draft v4](https://json-schema.org/specification-links#draft-4), including `allOf`/`anyOf`/`oneOf`, shared shapes through `definitions` and `$ref`, and the string formats listed on the [package page](/docs/libraries/utils/json). `additionalProperties: false` is what turns a silently ignored `databse` key into an error.

## 4. Fail the boot, and say everything that is wrong

[`validate`](/docs/libraries/utils/json#api-validate) collects every violation rather than stopping at the first, so one run fixes one round of edits:

```ts
import { validate } from '@hyperfrontend/json-utils'
import { readFileSync } from 'node:fs'

const config = JSON.parse(readFileSync('config.json', 'utf8'))
const result = validate(config, configSchema)

if (!result.valid) {
  for (const error of result.errors) {
    console.error(`config${error.path === '/' ? '' : error.path}: ${error.message}`)
  }
  process.exit(1)
}
```

Each [`ValidationError`](/docs/libraries/utils/json#api-ValidationError) carries a `path` as a [JSON Pointer](https://datatracker.ietf.org/doc/html/rfc6901) into the value, a human `message`, and a `code` naming the keyword that rejected it. Branch on `code`, never on message text:

```text
config/port: Number must be at most 65535, got 99999
config/logLevel: Value must be one of: "error", "warn", "info", "debug"
config/database/poolSize: Number must be at least 1, got 0
config/database: Missing required property: url
config: Additional property not allowed: cache
```

## 5. Reuse the check for values that arrive later

Config is validated once; a webhook body or a job payload is validated thousands of times. [`createValidator`](/docs/libraries/utils/json#api-createValidator) binds the schema once and hands back a function:

```ts
import { createValidator } from '@hyperfrontend/json-utils'

const validateWebhook = createValidator({
  type: 'object',
  properties: {
    event: { enum: ['order.paid', 'order.refunded'] },
    amount: { type: 'integer', minimum: 1 },
  },
  required: ['event', 'amount'],
})

validateWebhook(body) // { valid: true, errors: [] }
```

When the schema itself comes from a user rather than from you, pass [`safePatterns: true`](/docs/libraries/utils/json#api-ValidateOptions) so a hostile `pattern` is rejected instead of run.

## Check it worked

Break one value in each direction and boot the process: a port above 65535, a log level that is not in the enum, a missing `database.url`, and a key spelled wrong. One run should name all four, each with the path you would use to find it in the file. Fix them and the process starts.
