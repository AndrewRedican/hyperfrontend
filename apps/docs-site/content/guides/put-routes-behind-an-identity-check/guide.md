# How to put routes behind an identity check

You will make some or all of a service's routes answer only a verified caller, hand that caller to each handler as a typed field of its context, and decide what a refused request writes to your log.

In [`@hyperfrontend/server`](/docs/libraries/server) an identity check is a step like any other: a function that answers the request or passes it on. Its position does the work. Where it stands decides which routes it covers, whether a platform's probes and a browser's preflights get past it, and whether a refusal is logged with the request's path or with a route's name.

The examples come from a small service with a public status route, one report route that needs a caller and an admin table that needs one throughout. It checks a bearer token against a secret read from the environment; put your own verification in its place.

## 1. Write the step that verifies the caller

Type the step as a [`Step`](/docs/libraries/server#api-Step) with two type arguments: what it reads from the context, which is nothing ([`NoContext`](/docs/libraries/server#api-NoContext)), and what it adds for everything inside it. Refuse a caller by throwing an [`httpError`](/docs/libraries/server#api-httpError) with status 401 and a [`WWW-Authenticate`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/WWW-Authenticate) header. Let one through by returning [`next()`](/docs/libraries/server#api-Next) with the fields to add:

```ts
// identity.ts
import type { NoContext, Step } from '@hyperfrontend/server'
import type { Secret } from '@hyperfrontend/server/environment'
import { createHash, timingSafeEqual } from 'node:crypto'
import { httpError } from '@hyperfrontend/server'

export interface Identified {
  readonly subject: string
}

const digest = (text: string): Buffer => createHash('sha256').update(text).digest()

export function bearerIdentity(token: Secret, subject: string): Step<NoContext, Identified> {
  // the text leaves the wrapper once, here, and only its digest is kept
  const expected = digest(token.reveal())
  return (request, _context, next) => {
    const header = request.headers.authorization ?? ''
    const sent = header.startsWith('Bearer ') ? header.slice(7) : ''
    if (!timingSafeEqual(digest(sent), expected)) {
      throw httpError(401, 'unauthenticated', { 'WWW-Authenticate': 'Bearer' })
    }
    return next({ subject })
  }
}
```

The client is sent the status, its reason phrase and the header. The [code](/docs/libraries/server#api-HttpError-prop-code), `unauthenticated` here, goes to the request's log line and stays out of the response. A verifier that waits on something, such as a key lookup or a call to an identity provider, makes the step `async` and changes nothing else.

A [`Secret`](/docs/libraries/server/environment#api-Secret) prints as `[secret]` wherever it is written out, and `reveal()` is the one way to its text. Reveal it once, where the step is built, and keep only what the comparison needs. Here that is a digest, which also gives [`timingSafeEqual`](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b) the two inputs of equal length it requires. Hand the revealed text only to code that cannot quote it back in an error message.

## 2. Build the step where the secret is read

Declare the secret with [`asSecret`](/docs/libraries/server/environment#api-asSecret) in the service's [environment](/docs/libraries/server/environment#api-defineEnvironment), and build the step in the start function of [`defineService`](/docs/libraries/server#api-defineService), which receives the values once they have been checked. The first import already names what steps 4 to 6 add to this file:

```ts
// service.ts
import { chain, cors, defineService, guard, health, jsonResponse, readiness, route, router, startService } from '@hyperfrontend/server'
import { asPort, asSecret, defineEnvironment, optional, required } from '@hyperfrontend/server/environment'
import { bearerIdentity } from './identity.js'

export const service = defineService({
  environment: defineEnvironment({
    http: { PORT: optional(asPort(), 8080) },
    auth: { API_TOKEN: required(asSecret()) },
  }),
  start(values, context) {
    const requireIdentity = bearerIdentity(values.auth.API_TOKEN, 'operator')
    // the routers of steps 4 and 5, then the list of step 6
  },
})
```

A deployment that lacks the token, or carries one shorter than 16 characters, does not start. [`runService`](/docs/libraries/server#api-runService) prints the problem without the value and exits with [code 78](/docs/libraries/server/architecture#the-runner), so the service never runs with its check unset:

```text
fatal cause=environment
  - API_TOKEN (auth) is missing; expected a secret of at least 16 characters.
```

## 3. Decide what the step stands in front of

The step can stand in front of a whole [`router`](/docs/libraries/server#api-router) or inside one [`route`](/docs/libraries/server#api-route). The two differ in more than coverage:

|                                                  | In front of a router                                         | Inside one route |
| ------------------------------------------------ | ------------------------------------------------------------ | ---------------- |
| Covers                                           | Every route of the table, and every path it has no route for | That route only  |
| A path no route knows, asked without credentials | 401                                                          | 404              |
| A refusal is logged with                         | The request's path                                           | The route's name |

Decide on the last row. The router names a route before the route's handler runs, and from then on the request's [event](/docs/libraries/server#api-RequestEvent) carries that name in place of the path. A step ahead of the router refuses a request no route has claimed yet, so its event carries the [path](/docs/libraries/server#api-RequestEvent-prop-path). Two rules follow:

- A token, a signed link or any other capability goes in a header or in the body, never in a path.
- A check whose refusals must stay out of the log by path goes inside the route.

## 4. Put the step in front of a whole router

Compose the step and the router with [`chain`](/docs/libraries/server#api-chain), inside the start function. It carries what the step adds to the router in the types, so every handler of the table reads the caller from its context as a `string`:

```ts
const admin = chain(
  requireIdentity,
  router({
    'admin.whoami': route('GET', '/admin/whoami', (_request, context) => {
      return jsonResponse(200, { subject: context.subject })
    }),
  })
)
```

## 5. Put the step in front of one route

In a table that is otherwise public, wrap the one handler with [`guard`](/docs/libraries/server#api-guard). The handler keeps the params typed from its pattern and gains what the step adds:

```ts
const open = router({
  status: route('GET', '/status', () => jsonResponse(200, { up: true })),
  'reports.read': route(
    'GET',
    '/reports/:id',
    guard(requireIdentity, (request, context) => {
      return jsonResponse(200, { report: request.params.id, subject: context.subject })
    })
  ),
})
```

## 6. List the steps with the probes and the browser grant ahead

Steps run in the order they are listed, outermost first, so give [`startService`](/docs/libraries/server#api-startService) this order:

```ts
const fromSite = cors({ origins: ['https://site.example'], headers: ['Authorization'] })

return startService(
  {
    port: values.http.PORT,
    steps: [health(), readiness(), fromSite, open, admin],
  },
  { report: context.report }
)
```

- **[`health`](/docs/libraries/server#api-health) and [`readiness`](/docs/libraries/server#api-readiness) come first.** A probe carries no credentials, and an identity step ahead of them answers it 401.
- **[`cors`](/docs/libraries/server#api-cors) comes ahead of the identity step.** A browser's [preflight](https://developer.mozilla.org/en-US/docs/Glossary/Preflight_request) carries no `Authorization` header, so an identity step ahead of `cors` refuses every one. In this order the preflight is answered, and a 401 on its way out gains the grant, so the page can read the status. `cors` tells a browser what it may read; the identity step is what decides who may call.
- **The public table comes ahead of the chained one.** A chained step judges every request that reaches it, so list it after the routes that must stay open.

The [`report`](/docs/libraries/server#api-ServiceDeps-prop-report) function handed on from the runner's [context](/docs/libraries/server#api-RunContext-prop-report) writes one line per request, which is where step 3's choice shows.

## 7. Hold the wiring to what the types say

The compiler catches two mistakes only under flags that [`strict`](https://www.typescriptlang.org/tsconfig/#strict) turns on:

- **Without [`strictFunctionTypes`](https://www.typescriptlang.org/tsconfig/#strictFunctionTypes), a router whose handlers read the caller can be listed with no identity step in front of it.** Each handler then reads `undefined` and answers as if it had a caller.
- **Without [`strictNullChecks`](https://www.typescriptlang.org/tsconfig/#strictNullChecks), a step can call `next(undefined)`.** Nothing is added, and the handlers behind it read `undefined` in the same way.

With `strict` on, both are compile errors (TS2322 on the list of steps, TS2345 on the call) and you are done. Without it, pass `next()` an object written at the call, as step 1 does, and read the caller through a function that checks it is there:

```ts
// identity.ts
export function subjectOf(context: Partial<Identified>): string {
  if (typeof context.subject !== 'string') {
    throw httpError(500, 'identity-step-missing')
  }
  return context.subject
}
```

A handler that returns `subjectOf(context)` where it would have read `context.subject` answers 500 when the step is missing, and its log line says why:

```text
request method=GET route=admin.whoami status=500 outcome=sent ms=2 failure=identity-step-missing
```

## Check it worked

Start the service with the token in its environment and ask for a guarded route with no header:

```sh
curl -i localhost:8080/reports/7
```

```text
HTTP/1.1 401 Unauthorized
Content-Type: text/plain; charset=utf-8
Cache-Control: no-store
WWW-Authenticate: Bearer
Vary: Origin
Content-Length: 12
Date: Sun, 22 Nov 2026 17:17:21 GMT
Connection: keep-alive
Keep-Alive: timeout=5

Unauthorized
```

Then the same route with the header, a route behind the chained step without it, and a probe:

```sh
AUTH='Authorization: Bearer correct-horse-battery-staple'
curl -s -w ' %{http_code}\n' -H "$AUTH" localhost:8080/reports/7
curl -s -w ' %{http_code}\n' localhost:8080/admin/whoami
curl -s -w ' %{http_code}\n' localhost:8080/healthz
```

```text
{"report":"7","subject":"operator"} 200
Unauthorized 401
ok 200
```

The service's own output has one line for each of the four requests:

```text
started port=8080
request method=GET route=reports.read status=401 outcome=sent ms=5 failure=unauthenticated
request method=GET route=reports.read status=200 outcome=sent ms=1
request method=GET path=/admin/whoami status=401 outcome=sent ms=0 failure=unauthenticated
request method=GET path=/healthz status=200 outcome=sent ms=0
```

The first refusal names its route and holds no path: it came from inside the route. The second holds the path: it came from the step ahead of the router. Read your own refusals the same way. If one shows a path you would not want kept, move that check into its route.
