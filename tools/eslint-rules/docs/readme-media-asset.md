# readme-media-asset

Require README media to be referenced by an absolute site URL backed by a committed asset.

## Rule Details

A project README is read on three surfaces that do not agree with each other:

- **npm** copies the file byte for byte and rewrites nothing, so a relative path resolves against the package page and 404s.
- **GitHub** resolves relative paths against the repository, so a path that works on npm does not work here and vice versa.
- **The documentation site** ingests library READMEs and renders them under `/docs/libraries/<slug>/`, so a relative path resolves against a route that has no such file.

One absolute URL under the site's own origin is the only form that works on all three. This rule enforces that, and then checks that the file the URL names is actually committed, which the link validator cannot do because it treats an absolute URL as external and never follows it.

### Scope

Applies to every `README.md` **except** the workspace root README. The root README is never ingested by the documentation site, so its media has only two surfaces to satisfy and it is free to use whichever form suits it, including the `github.com/.../blob/main/...?raw=true` form the repository logo already uses.

Status badges are ignored: `img.shields.io`, `shields.io`, `codecov.io` and `badgen.net` are served by third parties and are not project media.

References inside fenced code blocks are ignored, so a README can show markup as an example.

The rule is inert until both options are configured, so it carries no assumption about any particular repository.

## Options

| Option      | Type     | Description                                                        |
| ----------- | -------- | ------------------------------------------------------------------ |
| `baseUrl`   | `string` | Absolute URL prefix every media reference must start with.         |
| `assetRoot` | `string` | Directory, relative to the workspace root, that the prefix serves. |

```js
'workspace/readme-media-asset': [
  'error',
  {
    baseUrl: 'https://www.hyperfrontend.dev/media/',
    assetRoot: 'assets/media',
  },
]
```

With that configuration, `https://www.hyperfrontend.dev/media/koi-pond/hero.gif` must be backed by `assets/media/koi-pond/hero.gif`.

## Examples

### ❌ Incorrect

```markdown
![The pond](./assets/hero.gif)
```

A relative path resolves differently on npm, on GitHub and on the documentation site, and at most one of the three will find the file.

```markdown
<img src="https://github.com/AndrewRedican/hyperfrontend/blob/main/assets/media/koi-pond/hero.gif?raw=true">
```

The file exists, but the documentation site would then load a multi-megabyte asset from a third-party origin on every page view.

```markdown
<img src="https://www.hyperfrontend.dev/media/koi-pond/nothing-here.gif">
```

Nothing is committed at `assets/media/koi-pond/nothing-here.gif`, so the image is broken on all three surfaces at once and no build fails.

### ✅ Correct

```markdown
<p align="center">
  <img width="560" src="https://www.hyperfrontend.dev/media/koi-pond/hero.gif" alt="Eight framework apps composed into one scene">
</p>
```

```markdown
![Eight framework apps composed into one scene](https://www.hyperfrontend.dev/media/koi-pond/hero.gif)
```

## When Not To Use It

If a repository serves no media of its own, leave the options unset and the rule does nothing.
