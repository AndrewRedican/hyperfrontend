# How to harden your code against prototype pollution

You will make the checks that matter (an authorisation test, a serialiser, a dispatch table) keep telling the truth after something else on the page has moved the ground under them.

Any script sharing your realm can write `Object.prototype.isAdmin = true` or reassign `Array.isArray`, and every later reader inherits the lie without an error anywhere. A tag manager, a chat widget, a plugin, or a dependency five levels down is enough. [`@hyperfrontend/immutable-api-utils`](/docs/libraries/utils/immutable-api) gives you references captured before that happens, plus the two access patterns that a polluted prototype cannot reach through.

## 1. Capture the built-ins first

```bash
npm install @hyperfrontend/immutable-api-utils
```

Put the imports above every other import in your entry module. Each one reads its built-in a single time, when the module is evaluated, so the reference you get is whatever was true at that moment:

```ts
import { hasOwn, keys, create } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'

import './analytics'
import './app'
```

Order decides the outcome, because [ES modules evaluate in source order](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules#importing_features_into_your_script). Above `./analytics` the copies are the originals; below it they would be whatever that module left behind. Everything else in your build can import them at any point afterwards.

There is one entry point per built-in ([`object`](/docs/libraries/utils/immutable-api/built-in-copy/object), [`array`](/docs/libraries/utils/immutable-api/built-in-copy/array), [`json`](/docs/libraries/utils/immutable-api/built-in-copy/json), [`console`](/docs/libraries/utils/immutable-api/built-in-copy/console), [`timers`](/docs/libraries/utils/immutable-api/built-in-copy/timers), and the rest), so you take only what you depend on.

## 2. Call the copies where a lie would matter

Say another script has run this:

```ts
Object.prototype.isAdmin = true
Array.isArray = () => true
JSON.stringify = () => '{"amount":0}'
```

The globals now agree with the attacker. Your captured references do not:

```ts
Array.isArray({}) // true
isArray({}) // false

JSON.stringify({ amount: 4200 }) // '{"amount":0}'
stringify({ amount: 4200 }) // '{"amount":4200}'
```

Use them on the paths where a wrong answer is a security or correctness event: type gates before a privileged branch, the serialiser that produces a signed payload, the [`console`](/docs/libraries/utils/immutable-api/built-in-copy/console) call your incident report depends on, the [`setTimeout`](/docs/libraries/utils/immutable-api/built-in-copy/timers) that arms a session expiry. Ordinary application code can keep using the globals.

## 3. Ask about own properties, not inherited ones

A polluted prototype answers for every object you did not explicitly check. [`hasOwn`](/docs/libraries/utils/immutable-api/built-in-copy/object#api-hasOwn) asks the object itself:

```ts
const session = { user: 'ada' }

'isAdmin' in session // true
session.isAdmin // true
hasOwn(session, 'isAdmin') // false
```

The same split runs through enumeration. [`for...in`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...in) walks the prototype chain and picks the injected key up; [`keys`](/docs/libraries/utils/immutable-api/built-in-copy/object#api-keys) stays on the object:

```ts
for (const key in session) console.log(key) // 'user', then 'isAdmin'

keys(session) // ['user']
```

## 4. Give lookup objects no prototype at all

An object keyed by data you did not author (a message type, a route name, a feature flag) answers to `toString`, `constructor`, and `__proto__` before anyone attacks it. [`create(null)`](/docs/libraries/utils/immutable-api/built-in-copy/object#api-create) removes the chain, so a miss is a miss:

```ts
const handlers = create(null)
handlers.refund = onRefund

handlers['toString'] // undefined
```

Built with `{}` instead, `handlers['toString']` is a function, and `if (handlers[type])` dispatches on a key nobody registered.

## Check it worked

Write a scratch module that pollutes `Object.prototype` and reassigns `Array.isArray`, and import it after your captured copies. The copied `isArray` still rejects `{}`, `hasOwn` still reports `false` for the injected key, and your dispatch table still misses on `toString`. Then move the polluting import above the copies and run it again: every one of those flips, which is the whole reason the import sits where it does.
