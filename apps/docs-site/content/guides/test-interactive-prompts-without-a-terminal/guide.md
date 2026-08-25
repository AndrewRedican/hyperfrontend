# How to test interactive prompts without a terminal

You will put your prompts under test the same way you test anything else: call the code, drive it, assert on what came back, and see it fail when someone breaks a validator.

Interactive prompts usually end up as the one part of a CLI nobody covers. They read raw keystrokes from a TTY, so the test runner has no terminal to give them, and the usual escape is to extract the "logic" until the prompt itself is a thin layer nothing exercises. Every prompt in [`@hyperfrontend/questions`](/docs/libraries/questions) takes the streams it talks to as configuration, so a test can hand it a pair of ordinary streams and act as the terminal.

## 1. Build a fake terminal

Every prompt config extends [`PromptConfig`](/docs/libraries/questions#api-PromptConfig), which accepts an [`input`](/docs/libraries/questions#api-PromptConfig-prop-input) to read from and an [`output`](/docs/libraries/questions#api-PromptConfig-prop-output) to draw on. A [`PassThrough`](https://nodejs.org/api/stream.html#class-streampassthrough) is enough for both, with nothing added to make it look like a terminal: writing to the input is a keystroke, and everything the prompt draws arrives on the output where you can read it back.

Keystrokes go in as the escape sequences a terminal would send, so name the ones your prompts use once.

`fake-terminal.mjs`:

```js
import { PassThrough } from 'node:stream'

export const KEY = { enter: '\r', up: '\x1B[A', down: '\x1B[B', space: ' ', backspace: '\x7F', ctrlC: '\x03' }

export function createFakeTerminal() {
  const input = new PassThrough()
  const output = new PassThrough()
  let transcript = ''
  output.on('data', (chunk) => {
    transcript += chunk.toString()
  })

  return {
    streams: { input, output },
    press(...keys) {
      for (const key of keys) input.write(key)
    },
    get transcript() {
      return transcript
    },
  }
}
```

One `write` per key is the part that matters. Typed characters may share a chunk, but Enter must arrive in a write of its own: send `'billing\r'` as one string and the prompt waits forever, with no error to tell you why. Writing every key separately makes that impossible to get wrong. Nothing here belongs to a particular test runner: it is two streams and a string, so it works wherever your suite already runs.

## 2. Start the prompt, then type

[`text`](/docs/libraries/questions#api-text) returns a promise as soon as you call it, and it resolves only once an answer is submitted. Hold that promise, send the keystrokes, and await it afterwards:

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import { text } from '@hyperfrontend/questions'
import { createFakeTerminal, KEY } from './fake-terminal.mjs'

test('accepts a service name', async () => {
  const terminal = createFakeTerminal()
  const outcome = text({ message: 'Service name:', ...terminal.streams })

  terminal.press(...'billing', KEY.enter)

  assert.deepEqual(await outcome, { result: 'submitted', value: 'billing' })
})
```

Spreading a string sends it one character at a time, which is what a person typing looks like. Awaiting the prompt before sending keys is the one ordering that deadlocks: nothing will ever arrive.

## 3. Assert on the answer, not on the drawing

Every prompt resolves to the same [`PromptOutcome`](/docs/libraries/questions#api-PromptOutcome) shape, so one assertion style covers your whole wizard: [`select`](/docs/libraries/questions#api-select) below reads no differently from the `text` above. Send the keys a person would press and check the value that came back:

```js
import { select } from '@hyperfrontend/questions'

test('returns the highlighted choice', async () => {
  const terminal = createFakeTerminal()
  const outcome = select({
    message: 'Runtime:',
    choices: [
      { label: 'node', value: 'node' },
      { label: 'edge', value: 'edge' },
    ],
    ...terminal.streams,
  })

  terminal.press(KEY.down, KEY.enter)

  assert.equal((await outcome).value, 'edge')
})
```

Assert on `value` rather than on the transcript wherever you can. The transcript carries cursor moves and colour codes that change when the rendering changes, and a test pinned to those breaks on a cosmetic release.

## 4. Prove a rejected answer is really rejected

A [`validate`](/docs/libraries/questions#api-TextConfig-prop-validate) function is worth a test precisely because its failure mode is silent: a validator that accidentally accepts everything still passes every test that only submits good input. Submit something invalid first, and the prompt keeps asking rather than resolving, so the same test can then correct it:

```js
test('rejects a name with a space and keeps asking', async () => {
  const terminal = createFakeTerminal()
  const outcome = text({
    message: 'Service name:',
    validate: (value) => (/^[a-z][a-z0-9-]*$/.test(value) ? undefined : 'Lowercase letters, digits and dashes'),
    ...terminal.streams,
  })

  terminal.press(...'bad name', KEY.enter)
  terminal.press(...Array(8).fill(KEY.backspace), ...'billing', KEY.enter)

  assert.equal((await outcome).value, 'billing')
  assert.ok(terminal.transcript.includes('Lowercase letters, digits and dashes'))
})
```

A rejected submission keeps what was typed, which is why the correction backspaces over the eight characters rather than starting from an empty line. This is the one case where reading the transcript earns its keep: the message is the part of the contract your reader actually sees, so assert on the text you wrote and nothing around it.

## 5. Cover the cancelled path

Ctrl+C is a keystroke here rather than a signal, so the cancellation branch of your CLI is reachable from a test without spawning a process or installing a handler:

```js
import { PromptResult } from '@hyperfrontend/questions'

test('reports Ctrl+C as a cancelled outcome', async () => {
  const terminal = createFakeTerminal()
  const outcome = text({ message: 'Service name:', ...terminal.streams })

  terminal.press(KEY.ctrlC)

  const settled = await outcome
  assert.equal(settled.result, PromptResult.Cancelled)
  assert.equal(settled.value, undefined)
})
```

Give this one its own test for every step that can leave something behind. A wizard that has already created a directory by question four is exactly where a cancellation is worth proving, and [`PromptResult`](/docs/libraries/questions#api-PromptResult) is the constant your production code should be branching on too.

## Check it worked

Run the suite with no terminal attached at all, by piping it: `node --test 2>&1 | cat`. Every test still passes, because none of them touched the real stdin. Then break something on purpose. Loosen the validator's pattern so it accepts anything, and the rejection test reports `+ 'bad name' - 'billing'`: the prompt took the answer it should have refused, so the correction never happened. Change a choice's `value` and the select test reports the new value rather than complaining about the layout around it. Both failures name the thing you changed, which is the difference between covering a prompt and merely calling it.
