# deploy-static-headers

Require statically deployed projects to ship an `hf-serve.config.json` declaring who may frame them.

## Rule Details

A project whose `project.json` declares `metadata.deploy.kind: "static"` is served by `hf serve`, which
applies the header rules it finds in the served root's own `hf-serve.config.json`. That file is copied
there from the project's `public/` directory at build time, so the policy travels inside the artifact
instead of living in a hosting dashboard.

`hf serve` sends no security headers of its own. A static deploy that ships no config therefore answers
every request with no `Content-Security-Policy` at all, which means any page on the internet may embed
it in an iframe.

This rule requires such a project to carry `public/hf-serve.config.json`, and requires that file to
declare a `frame-ancestors` directive on a rule that applies to the whole origin.

### What counts as covering the whole origin

Header rules may be bounded by a `prefix` or a `suffix`, and later rules override earlier ones one
header at a time. A rule carrying neither bound applies to every path, so that is the rule that has to
declare the framing policy. A config whose only `frame-ancestors` sits behind a `prefix` leaves every
other path unprotected, and the rule reports it.

Bounded rules may still narrow the policy for part of the origin. A host page that nothing should ever
frame can carry `frame-ancestors 'none'` under its own prefix while the unbounded rule keeps the
origin's default.

### Why?

- **Clickjacking**: an unprotected feature page can be framed invisibly over an attacker's own UI
- **Policy travels with the artifact**: the same config serves local, preview and production
- **Deliberate choice**: naming the permitted ancestors forces the question to be answered once, in review

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

A config whose only policy is bounded by a prefix, leaving the rest of the origin uncovered:

```json
{
  "headers": [{ "prefix": "/embed", "headers": { "Content-Security-Policy": "frame-ancestors 'self'" } }]
}
```

**Error**: `'public/hf-serve.config.json' declares no unbounded Content-Security-Policy with a frame-ancestors directive, so paths outside its prefixed rules are framable by any origin.`

A policy that permits every origin, which is the same as having none:

```json
{
  "headers": [{ "headers": { "Content-Security-Policy": "frame-ancestors *" } }]
}
```

**Error**: `'public/hf-serve.config.json' declares 'frame-ancestors *', which permits every origin and defeats the policy.`

### ✅ Correct

An unbounded rule naming the permitted ancestors, with a narrower rule for a page nothing should frame:

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

- [project-lifecycle-policy](./project-lifecycle-policy.md)
- [lib-project-metadata](./lib-project-metadata.md)
