# policy

Describes what a static server sends, as data: the serve-config authoring shape and its validators, the header policy fields and presets, and the fold that turns ordered header rules into one response's headers.

This entry imports no Node.js built-in, so a browser bundle, a build step or a lint rule can author, check and read a serve config without loading the HTTP stack.

```ts
import { defineServeConfig, validateServeConfig } from '@hyperfrontend/server/policy'

const config = defineServeConfig({
  root: 'dist/site',
  embedders: ["'self'", 'https://host.example'],
  permissionsPolicy: { camera: [], geolocation: ['self'] },
  isolation: 'require-corp',
  headers: [{ suffix: '.html', headers: { 'Cache-Control': 'no-cache' } }],
})

validateServeConfig(config, 'serve.config.json')
```

## Usage

A config's policy fields expand into ordered header rules, and the rules fold into the headers of one path. The fold is the one the static server runs, so what it returns is what a response carries:

```ts
import { applyHeaderRules, expandHeaderPolicy } from '@hyperfrontend/server/policy'

const rules = expandHeaderPolicy({
  embedders: ["'self'", 'https://host.example'],
  permissionsPolicy: { camera: [], geolocation: ['self'] },
  isolation: 'require-corp',
  headers: [{ suffix: '.html', headers: { 'Cache-Control': 'no-cache' } }],
})

applyHeaderRules(rules, '/index.html')
// {
//   'Content-Security-Policy': "frame-ancestors 'self' https://host.example",
//   'Permissions-Policy': 'camera=(), geolocation=(self)',
//   'Cross-Origin-Opener-Policy': 'same-origin',
//   'Cross-Origin-Embedder-Policy': 'require-corp',
//   'Cross-Origin-Resource-Policy': 'cross-origin',
//   'Cache-Control': 'no-cache',
// }
```

[`expandHeaderPolicy`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-expandHeaderPolicy) checks the four fields it reads the way [`validateServeConfig`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-validateServeConfig) does and throws the same sentences, one per line, so no rule is built from a policy that never passed a validator. Any other field of the value is left unread, which lets a whole serve config be handed over.

A config written in TypeScript, or a service that builds its own rules, can compose the presets instead of spelling header values:

```ts
import { contentSecurityPolicy, defineServeConfig, immutableAssets, nosniff, referrerPolicy } from '@hyperfrontend/server/policy'

const embedders = ["'self'", 'https://host.example']

export default defineServeConfig({
  embedders,
  headers: [
    nosniff(),
    referrerPolicy(),
    contentSecurityPolicy({ embedders, directives: { 'img-src': ["'self'", 'data:'] } }, { suffix: '.html' }),
    immutableAssets('/assets/'),
  ],
})
```

## Configuration

### Policy fields

Three fields of a serve config declare an intent and expand into one rule each. The rule matches every path.

| Field                                                                                                                     | Expands into                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [`embedders`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-ServeConfig-prop-embedders)                 | `Content-Security-Policy` holding one `frame-ancestors` directive, plus `X-Frame-Options` when the list is empty, `'none'` or `'self'` alone |
| [`permissionsPolicy`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-ServeConfig-prop-permissionsPolicy) | One `Permissions-Policy` header; no rule at all for an empty record                                                                          |
| [`isolation`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-ServeConfig-prop-isolation)                 | `Cross-Origin-Opener-Policy: same-origin`, the declared `Cross-Origin-Embedder-Policy`, and `Cross-Origin-Resource-Policy: cross-origin`     |

[`expandHeaderPolicy`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-expandHeaderPolicy) places them in that order, ahead of the authored [`headers`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-ServeConfig-prop-headers) rules, so an authored rule still overrides any header a field set.

### Embedders

An entry is `'self'`, `'none'` as the only entry, or `scheme://host` with an optional leading `*.` label and an optional port. Sources are written in the order given, and an empty list writes `frame-ancestors 'none'`. A port of `*` and a custom scheme such as `tauri://localhost` are accepted.

| Refused                                                  | Why                                                                  |
| -------------------------------------------------------- | -------------------------------------------------------------------- |
| A bare `*`, a scheme alone (`https:`), a host of `*`     | Each permits every origin                                            |
| A host without a scheme                                  | Its scheme would follow the served page's                            |
| Any path, a trailing `/` included                        | An ancestor is matched by its origin, so a deeper path never matches |
| Uppercase, `'SELF'` included                             | The string in the config is the string on the wire                   |
| A non-ASCII host                                         | Write an internationalised name in its punycode form                 |
| `https://*.app`                                          | A wildcard over a single label covers a whole top-level domain       |
| A trailing dot, IPv6 brackets, an underscore, user info  | Outside the grammar                                                  |
| A keyword without its single quotes, or in double quotes | A keyword is written `'self'` or `'none'`                            |
| `'none'` beside another entry                            | It must be the only entry                                            |

An IPv4 literal is accepted because the grammar admits it. The Content Security Policy specification says an IP host matches no ancestor and browsers differ, so test one before relying on it.

### Permissions policy

Each key is a feature name in lowercase letters, digits and hyphens. A name no browser knows is accepted, since browsers ignore it.

| Allowlist                          | Header member                           |
| ---------------------------------- | --------------------------------------- |
| `[]`                               | `camera=()`, which disables the feature |
| `['self']`                         | `camera=(self)`                         |
| `['*']`                            | `camera=*`                              |
| `['self', 'https://maps.example']` | `camera=(self "https://maps.example")`  |

The keyword and the wildcard are written without quotes, as the header writes them (`['self']`, `['*']`), and the wildcard must be the only entry. An origin follows the embedders grammar.

The field restricts what the served documents may do, whatever an embedder delegates to them. It is not a list of the features a document asks for.

### A rule that sets the policy header

The fold replaces a header's whole value, and `frame-ancestors` does not fall back to `default-src`. So once [`embedders`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-ServeConfig-prop-embedders) is declared, every authored rule that sets `Content-Security-Policy`, in any letter case, is checked:

- A rule whose value names no `frame-ancestors` directive is refused, bounded or not: the paths it matches would be framable by any origin.
- A rule that matches every path is refused unless its directive lists exactly the declared sources, in the same order. Otherwise the field would decide nothing.
- A rule bounded by a prefix or suffix may list sources of its own, which is how one area of a site is given a narrower or wider list.

`Content-Security-Policy-Report-Only` is never checked. A rule is refused instead of having the directive appended to it, so what a rule writes is always what is sent.

A directive counts only when a browser would enforce it. One that holds any character other than ASCII whitespace and visible ASCII is discarded whole by a browser, so it is read as absent: a no-break space pasted beside the directive, or a host that is not in its punycode form, gets the rule refused as one that names no `frame-ancestors`.

A bound counts only when it excludes a path. A [`prefix`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-ServeHeaderRule-prop-prefix) that is empty or `/`, and a [`suffix`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-ServeHeaderRule-prop-suffix) that is empty, exclude none, so a rule carrying only those is judged as a rule for every path. [`matchesEveryPath`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-matchesEveryPath) is that test.

The fold compares a bound with the path it is handed, letter for letter. The static server hands it the path of the file it serves in the spelling the file system stores, not the spelling of the request: on a volume that ignores letter case, `/HOST/index.html` reaches the file `host/index.html` and is sent the headers of a rule bounded by `/host/`, and so is a request that names the directory by a Windows short name. Write a bound the way the directory lists the name. A request that reaches no file, such as a redirect, a 404 or a 405, is matched by its path as requested.

### Problems

[`checkServeConfig`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-checkServeConfig) returns every problem of a config at once, each with a stable code, the path it was found at and a full sentence. [`validateServeConfig`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-validateServeConfig) throws the same sentences, one per line, each opening with the config's path. The order is fixed: the scalar fields and the rules first, then a hole in the rule list and any header value Node.js would refuse to send, then [`embedders`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-ServeConfig-prop-embedders), then [`permissionsPolicy`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-ServeConfig-prop-permissionsPolicy), then rules at odds with the embedders, then unknown fields.

A field the config does not take is a problem, at the top level and inside a rule, so a mistyped [`prefix`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-ServeHeaderRule-prop-prefix) cannot leave a rule matching every path. `$schema` is the one extra field accepted.

A header value is refused when Node.js would refuse to send it: a control character other than a tab, or any character above U+00FF. A header name is a token of letters, digits and the punctuation HTTP allows. Both are checked when the config loads, so a pasted typographic quote is a load error and not a 500 on every matching request. A hole in a list, as a doubled comma leaves in a config written in TypeScript, is an entry of the wrong type.

## Presets

Each preset returns one header rule. A preset given a refused value throws one error with a line per problem.

| Preset                                                                                                               | Sets                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`embedders`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-embedders)                             | What the config field expands into, with an optional scope                                                                                                    |
| [`permissionsPolicy`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-permissionsPolicy)             | What the config field expands into, with an optional scope                                                                                                    |
| [`crossOriginIsolation`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-crossOriginIsolation)       | What the [`isolation`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-ServeConfig-prop-isolation) field expands into, with an optional scope |
| [`contentSecurityPolicy`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-contentSecurityPolicy)     | Four default directives, any authored ones, and `frame-ancestors` from its embedders, last                                                                    |
| [`nosniff`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-nosniff)                                 | `X-Content-Type-Options: nosniff`                                                                                                                             |
| [`referrerPolicy`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-referrerPolicy)                   | `Referrer-Policy`, `strict-origin-when-cross-origin` unless told otherwise                                                                                    |
| [`strictTransportSecurity`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-strictTransportSecurity) | `Strict-Transport-Security`; it takes no scope, because the header covers the whole host                                                                      |
| [`immutableAssets`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-immutableAssets)                 | `Cache-Control: public, max-age=31536000, immutable` under a prefix                                                                                           |

The scope is a [`prefix`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-RuleScope-prop-prefix), a [`suffix`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-RuleScope-prop-suffix) or both, matched the way a rule's are. The defaults of [`contentSecurityPolicy`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-contentSecurityPolicy) are `default-src 'self'`, `script-src 'self'`, `object-src 'none'` and `base-uri 'self'`; an authored directive of the same name takes the default's place. Its embedders are required, since there is no safe guess for who may frame a page.

[`frameAncestorsOf`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-frameAncestorsOf) reads the source lists a `Content-Security-Policy` value declares, one per comma-separated policy and none for a directive a browser would discard. [`permitsEveryOrigin`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-permitsEveryOrigin) tells whether one source lets any origin through, and [`matchesEveryPath`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-matchesEveryPath) whether a rule's bounds exclude no path. Together they let a tool judge a policy it did not write.
