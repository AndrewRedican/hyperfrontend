# Build a CLI with a --verbose mode

You will build a `sync` command that says one line when it works, prints every stage with its elapsed time when you pass `--verbose`, and names the stage that broke either way. Its data output stays clean enough to pipe into [`jq`](https://jqlang.org/).

Everything comes from [`@hyperfrontend/logging`](/docs/libraries/logging). In an empty directory, install it and make something to sync:

```bash
npm install @hyperfrontend/logging
node -e "fs.writeFileSync('orders.json',JSON.stringify(Array.from({length:50},(_,i)=>({id:'ord_'+i,total:10+i}))))"
```

## Send diagnostics to stderr

A command has two output streams, and mixing them is what makes a tool unpipeable. Give the logger five sinks that all write to [`process.stderr`](https://nodejs.org/api/process.html#processstderr), and leave [`process.stdout`](https://nodejs.org/api/process.html#processstdout) for data.

`log.mjs`:

```js
import { createLogger } from '@hyperfrontend/logging'

const toStderr =
  (label) =>
  (...parts) =>
    process.stderr.write(`${label} ${parts.join(' ')}\n`)

export const log = createLogger(toStderr('ERROR'), toStderr('WARN'), toStderr('LOG'), toStderr('INFO'), toStderr('DEBUG'))
```

[`createLogger`](/docs/libraries/logging#api-createLogger) takes its sinks in severity order: error, warn, log, info, debug. Any you leave out become no-ops, so a one-argument call is a valid logger that only ever speaks about errors.

Check what you built:

```js
import { log } from './log.mjs'

console.log(log.getLogLevel()) // error
log.info('starting') // nothing
log.error('nope') // ERROR nope
```

A new logger starts at [`'error'`](/docs/libraries/logging#api-LogLevel), so nothing below that reaches a sink until you say otherwise. That is the right default for a library and the first thing an application changes.

## Choose the level from the flags

Create `sync.mjs`. Its first line turns a flag into a policy:

```js
import { readFile } from 'node:fs/promises'
import { log } from './log.mjs'

log.setLogLevel(process.argv.includes('--verbose') ? 'debug' : 'log')
```

The levels run `none`, `error`, `warn`, `log`, `info`, `debug`, and setting one admits it along with everything more severe. `'log'` suits a command's normal run: summaries and warnings get through, the play-by-play does not. `'debug'` opens everything. `'none'` closes everything, which is what a `--quiet` flag should set.

## Name the stage that is talking

A flat stream of verbose lines is barely better than none. [`channel`](/docs/libraries/logging#api-Logger-prop-channel) returns a logger that tags every line with a prefix and shares the level of the logger it came from:

```js
const config = log.channel('config')
const source = log.channel('source')
const output = log.channel('output')

function readConfig() {
  const file = process.argv.slice(2).find((argument) => !argument.startsWith('--')) ?? 'orders.json'
  config.debug('resolving', file, 'against', process.cwd())
  config.info('source is', file)
  return { file, minTotal: 30 }
}
```

Under `--verbose`, each line arrives labelled:

```text
DEBUG [config] resolving orders.json against /home/you/sync
INFO [config] source is orders.json
```

Channels nest, so `source.channel('retry')` prefixes `[source:retry]`. One [`setLogLevel`](/docs/libraries/logging#api-Logger-prop-setLogLevel) on the root still governs all of them, because a channel borrows the level rather than copying it.

## Time the slow parts

Wrap a stage in [`timed`](/docs/libraries/logging#api-Logger-prop-timed), or [`timedAsync`](/docs/libraries/logging#api-Logger-prop-timedAsync) when it returns a promise. Both return whatever the call returns, so they drop into an expression you already have:

```js
async function loadOrders({ file }) {
  source.debug('reading', file)
  const orders = JSON.parse(await readFile(file, 'utf8'))
  source.info('read', orders.length, 'orders')
  return orders
}

function writeOrders(orders, { minTotal }) {
  const kept = orders.filter((order) => order.total >= minTotal)
  output.debug('dropped', orders.length - kept.length, 'below', minTotal)
  process.stdout.write(JSON.stringify(kept) + '\n')
  return kept.length
}

try {
  const settings = config.timed('read', readConfig)
  const orders = await source.timedAsync('load', () => loadOrders(settings))
  const written = output.timed('write', () => writeOrders(orders, settings))
  log.log('synced', written, 'orders')
} catch {
  process.exitCode = 1
}
```

A stage that succeeds reports at debug level, so `node sync.mjs --verbose` is where the timings live:

```text
DEBUG [config] read completed in 3ms
DEBUG [source] load completed in 2ms
DEBUG [output] write completed in 0ms
LOG synced 30 orders
```

## Let a failure speak at any level

A stage that throws reports at error level and rethrows, so the wrapper never swallows a failure and never needs a flag to admit one. That leaves the `catch` with nothing to say beyond setting [`process.exitCode`](https://nodejs.org/api/process.html#processexitcode). Point the command at a file that is not there:

```bash
node sync.mjs missing.json
```

```text
ERROR [source] load failed after 1ms: ENOENT: no such file or directory, open 'missing.json'
```

The stage, the elapsed time, and the message, on a run with no flags. Add `--verbose` and the stack trace follows at debug level. That split is worth keeping: the fact of a failure is always news, the stack is news only while you are debugging.

## What you have

```bash
node sync.mjs                  # LOG synced 30 orders
node sync.mjs --verbose        # every stage, labelled and timed
node sync.mjs | jq '.[0].id'   # "ord_20", with diagnostics still on stderr
node sync.mjs missing.json     # ERROR [source] load failed after 1ms: ENOENT...
```

Four behaviours from one logger, with no flag threaded through a single function signature. The parts come apart cleanly: sinks decide where a line goes, the level decides whether it goes at all, channels decide who is speaking, and the timing wrappers decide what a stage costs. Rewrite `toStderr` to append JSON to a file and this same command starts producing structured logs, with nothing else edited.
