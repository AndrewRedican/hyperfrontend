# Build a setup wizard for your CLI

You will build a `create-service` command that asks four questions, refuses answers it cannot use, lets the reader back out at any point, and writes a project from what it collected.

Everything comes from [`@hyperfrontend/questions`](/docs/libraries/questions). In an empty directory:

```bash
npm install @hyperfrontend/questions
```

## Ask the first question

Create `create-service.mjs`:

```js
import { text } from '@hyperfrontend/questions'

const outcome = await text({ message: 'Service name:' })

console.log(outcome)
```

Run it with `node create-service.mjs`, type a name, press Enter:

```text
{ result: 'submitted', value: 'billing' }
```

Now run it again and press `Ctrl+C`:

```text
{ result: 'cancelled', value: undefined }
```

Every prompt resolves to that same [`PromptOutcome`](/docs/libraries/questions#api-PromptOutcome) union. Nothing throws, nothing leaves the terminal in raw mode, and there is no signal handler to install: an interrupted question is a value you read like any other.

## Refuse an answer you cannot use

The name becomes a directory and a package name, so most of what someone could type is unusable. Give [`text`](/docs/libraries/questions#api-text) a [`validate`](/docs/libraries/questions#api-TextConfig-prop-validate) function returning a message to reject and `undefined` to accept:

```js
const outcome = await text({
  message: 'Service name:',
  validate: (value) => (/^[a-z][a-z0-9-]*$/.test(value) ? undefined : 'Lowercase letters, digits and dashes, starting with a letter'),
})
```

Type `Billing` and press Enter: the message appears under the prompt and the cursor stays where it was, with what you typed still editable. The prompt only resolves once the value passes.

## Handle a cancelled session once

Three more questions are coming, and checking `result` after each one puts the same four lines in four places. Because the union is the same shape everywhere, one helper covers all of them:

```js
import { text, PromptResult } from '@hyperfrontend/questions'

async function ask(prompt) {
  const outcome = await prompt
  if (outcome.result === PromptResult.Cancelled) {
    console.log('\nNothing was written.')
    process.exit(130)
  }
  return outcome.value
}

const name = await ask(text({ message: 'Service name:', validate: /* … */ }))
```

`ask` takes the promise a prompt already returned, so it composes with every prompt in the package without knowing which one it holds, and [`PromptResult`](/docs/libraries/questions#api-PromptResult) is the pair of constants the union discriminates on. Exiting `130` is the conventional code for a run stopped by `SIGINT`, which is what a shell script wrapping your CLI looks for.

From here every answer reads as a plain value.

## Offer a closed set

A runtime is one of two things, so typing it is only an opportunity for typos. [`select`](/docs/libraries/questions#api-select) takes [`Choice`](/docs/libraries/questions#api-Choice) objects, where `label` is what the reader sees, `value` is what you get back, and `hint` is the consequence they need in order to choose:

```js
import { select } from '@hyperfrontend/questions'

const runtime = await ask(
  select({
    message: 'Runtime:',
    choices: [
      { label: 'node', value: 'node', hint: 'long-running process' },
      { label: 'edge', value: 'edge', hint: 'no filesystem, no native modules' },
    ],
  })
)
```

```text
? Runtime: (use arrows, enter to select)
❯ node — long-running process
  edge — no filesystem, no native modules
```

## Take several answers at once

Optional extras are not exclusive, so they need [`multiselect`](/docs/libraries/questions#api-multiselect): space toggles, Enter submits, and the answer is an array of the `value`s. Turning on [`searchable`](/docs/libraries/questions#api-MultiselectConfig-prop-searchable) lets typing narrow the list, which is what keeps this prompt usable when the list grows past a screen:

```js
import { multiselect } from '@hyperfrontend/questions'

const extras = await ask(
  multiselect({
    message: 'Include:',
    choices: [
      { label: 'Dockerfile', value: 'docker' },
      { label: 'GitHub Actions workflow', value: 'ci' },
      { label: 'OpenTelemetry tracing', value: 'otel' },
      { label: 'Health check endpoint', value: 'health' },
    ],
    searchable: true,
  })
)
```

```text
? Include: (type to filter, space to toggle, enter to submit)
  2 selected
  ☑ Dockerfile
❯ ☑ GitHub Actions workflow
  ☐ OpenTelemetry tracing
  ☐ Health check endpoint
```

Selecting none is a valid answer here. Pass `min: 1` when it is not.

## Confirm, then write

Show what you collected before you touch the disk, and make the last question a [`confirm`](/docs/libraries/questions#api-confirm). Its `initial` decides which answer a bare Enter gives, so the prompt reads `(Y/n)`:

```js
import { confirm } from '@hyperfrontend/questions'
import { mkdir, writeFile } from 'node:fs/promises'

console.log(`\n  ${name} (${runtime})`)
console.log(`  extras: ${extras.length ? extras.join(', ') : 'none'}\n`)

if (!(await ask(confirm({ message: `Create ./${name}?`, initial: true })))) {
  console.log('Nothing was written.')
  process.exit(0)
}

await mkdir(name, { recursive: true })
await writeFile(`${name}/service.json`, JSON.stringify({ name, runtime, extras }, null, 2) + '\n')
console.log(`Created ./${name}/service.json`)
```

A declined confirm is not a cancellation: it is a `false` the reader deliberately gave, so it exits `0`.

## What you have

```bash
node create-service.mjs
```

```text
? Service name: billing
? Runtime: node
? Include: Dockerfile, GitHub Actions workflow

  billing (node)
  extras: docker, ci

? Create ./billing? Yes
Created ./billing/service.json
```

Four prompts, one `ask` helper, and no terminal handling anywhere in your code. The shape that made that possible is the outcome union: because submission and cancellation are values of one type rather than a value and an exception, the interesting path stays a straight line of `await`s, and the boring path is handled once at the top.
