# deploy-static-headers

Require statically deployed projects to ship an `hf-serve.config.json` that `hf serve` loads and that
leaves no path framable by every origin.

## Rule Details

A project whose `project.json` declares `metadata.deploy.kind: "static"` is served by `hf serve`, which
applies the header rules it finds in the served root's own `hf-serve.config.json`. That file is copied
there from the project's `public/` directory at build time, so the policy travels inside the artifact
instead of living in a hosting dashboard.

`hf serve` sends no security headers of its own. A static deploy that ships no config therefore answers
every request with no `Content-Security-Policy` at all, which means any page on the internet may embed
it in an iframe.

This rule reads `public/hf-serve.config.json` with the same code the server loads it with, and makes
four checks in order. Every report is on the project file.

1. **The file is there and is JSON.**
2. **The server loads it.** Each problem the server's own validator finds is reported with the
   validator's sentence: a mistyped field, an unknown field, a refused `embedders` source, a rule that
   undoes the declared `embedders`. Nothing further is judged until the config loads.
3. **Every path has a framing policy.** The rule expands the config into the ordered header rules the
   server applies and judges what they leave on each path.
4. **The installed server reads the fields the config declares.** `embedders` and `permissionsPolicy`
   are read from `@hyperfrontend/features` 0.13.0 onwards. An older server loads a config that declares
   them and sends nothing for them. A prerelease of 0.13.0 orders before it and is reported like an
   older release, since nothing says which of its builds reads the fields.

### How the header rules are judged

A header rule may be bounded by a `prefix` or a `suffix`, and a later rule replaces the whole value of
any header an earlier rule set. A rule carrying neither bound applies to every path, and so does one
whose only bounds are a `prefix` of `/` or an empty string, since those exclude no path. The
`embedders` field expands into a rule for every path, placed ahead of the authored ones.

The last unbounded rule that sets `Content-Security-Policy` is the policy every path starts from, so
that rule must carry a `frame-ancestors` directive. Rules before it are replaced and are not judged.
Each rule after it is bounded, and replaces the policy on the paths it matches:

- one that sets the header **without** the directive leaves those paths with no framing policy, because
  `frame-ancestors` falls back to no other directive
- one whose directive **permits every origin** defeats the policy on those paths

A source permits every origin when it is a bare `*`, a scheme on its own such as `https:`, or a host
that is `*` such as `https://*`. A header value may hold several policies separated by commas, and a
browser enforces all of them, so a value is permissive only when every policy that names the directive
holds such a source.

The directive name is matched without regard to case, and `Content-Security-Policy-Report-Only` is not
judged, since it enforces nothing. A directive that holds any character other than ASCII whitespace
and visible ASCII is read as absent, because a browser discards it whole: a no-break space pasted
beside the directive, or a host that is not in its punycode form, leaves the path framable.

Bounded rules may still narrow the policy for part of the origin. A host page that nothing should ever
frame can carry `frame-ancestors 'none'` under its own prefix while the unbounded rule keeps the
origin's default.

### The installed server

The release is read from the project's own `package-lock.json`: the
`node_modules/@hyperfrontend/features` entry, when it is resolved from `https://registry.npmjs.org/`.
A project with no lock, or one that installs the package from anywhere else, is not reported here.
[railway-service-pins](./railway-service-pins.md) reports a deployed demo whose lock names no registry
release.

### Why?

- **Clickjacking**: an unprotected feature page can be framed invisibly over an attacker's own UI
- **Policy travels with the artifact**: the same config serves local, preview and production
- **Deliberate choice**: naming the permitted ancestors forces the question to be answered once, in review
- **No silent drop**: a config the server refuses, or a field the installed server ignores, fails lint
  and not the deploy

## Examples

### ❌ Incorrect

A static deploy with no `public/hf-serve.config.json` at all:

```json
{
  "name": "demo-clock",
  "metadata": {
    "deploy": { "provider": "railway", "kind": "static" }
  }
}
```

**Error**: `Project 'demo-clock' deploys as a static site but ships no public/hf-serve.config.json. Without it every origin on the internet may frame it.`

A config the server refuses to load, here for a source that names no host:

```json
{
  "embedders": ["*"]
}
```

**Error**: `'public/hf-serve.config.json' is a config hf serve refuses to load: embedders[0] permits every origin: name each host instead of a bare "*", a scheme on its own or a "*" host.`

A config whose only policy is bounded by a prefix, leaving the rest of the origin uncovered:

```json
{
  "headers": [{ "prefix": "/embed", "headers": { "Content-Security-Policy": "frame-ancestors 'self'" } }]
}
```

**Error**: `'public/hf-serve.config.json' declares neither "embedders" nor an unbounded Content-Security-Policy with a frame-ancestors directive, so paths outside its bounded rules are framable by any origin.`

A bounded rule that writes a fuller policy for documents and forgets the directive:

```json
{
  "headers": [
    { "headers": { "Content-Security-Policy": "frame-ancestors 'self'" } },
    { "suffix": ".html", "headers": { "Content-Security-Policy": "default-src 'self'" } }
  ]
}
```

**Error**: `'public/hf-serve.config.json' sets a Content-Security-Policy without a frame-ancestors directive in headers[1], which replaces the unbounded policy on the paths that rule matches and leaves them framable by any origin.`

A policy that permits every origin, which is the same as having none:

```json
{
  "headers": [{ "headers": { "Content-Security-Policy": "frame-ancestors https:" } }]
}
```

**Error**: `'public/hf-serve.config.json' declares a frame-ancestors source that permits every origin in headers[0], which defeats the policy.`

A config that declares `embedders` in a project whose lock installs `@hyperfrontend/features` 0.12.2:

```json
{
  "embedders": ["'self'", "https://www.hyperfrontend.dev"]
}
```

**Error**: `'public/hf-serve.config.json' declares "embedders", which @hyperfrontend/features 0.12.2 does not read: the policy would silently not be sent. The project's lock must install 0.13.0 or later.`

### ✅ Correct

The embedders declared as a field, with a narrower rule for a page nothing should frame:

```json
{
  "embedders": ["'self'", "https://www.hyperfrontend.dev", "https://hyperfrontend.dev"],
  "headers": [
    { "headers": { "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "cross-origin" } },
    { "prefix": "/host", "headers": { "Content-Security-Policy": "frame-ancestors 'none'" } }
  ]
}
```

The same policy written as an unbounded rule, which every release of the server reads:

```json
{
  "headers": [
    {
      "headers": {
        "Content-Security-Policy": "frame-ancestors 'self' https://www.hyperfrontend.dev https://hyperfrontend.dev",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "cross-origin"
      }
    },
    {
      "prefix": "/host",
      "headers": { "Content-Security-Policy": "frame-ancestors 'none'" }
    }
  ]
}
```

## When Not To Use It

- Projects that declare no `metadata.deploy`, such as planned demos and development workbenches
- Deploys whose `metadata.deploy.kind` is not `"static"`, which do not go through `hf serve`

## Related Rules

- [railway-service-pins](./railway-service-pins.md)
- [project-lifecycle-policy](./project-lifecycle-policy.md)
- [lib-project-metadata](./lib-project-metadata.md)
