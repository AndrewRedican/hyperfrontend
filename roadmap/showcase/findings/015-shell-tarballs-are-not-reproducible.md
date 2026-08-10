# F-015 — Repacking an unchanged feature produces a different shell tarball every time

| Field        | Value                              |
| ------------ | ---------------------------------- |
| Category     | packaging                          |
| Severity     | medium                             |
| Surfaced by  | demo-koi-fish-\* (vendored shells) |
| Status       | open                               |
| Disposition  | —                                  |
| Graduated to | —                                  |

## What happened

I vendor generated shells into the host that consumes them, so I wanted the same guard my
shared library has: repack, compare against the committed tarball, and fail if they differ.
That guard is impossible, because `hf build` never packs the same bytes twice.

Repacking a feature whose source, contract, and config had not changed at all produced a
different tarball. The only difference in the extracted contents is the staging directory's
name inside `index.d.ts.map`:

```
-  "sources": [".../.hf-shell--hyperfrontend-demo-koi-fish-vanilla-287195/src/index.ts"]
+  "sources": [".../.hf-shell--hyperfrontend-demo-koi-fish-vanilla-335469/src/index.ts"]
```

The number is the packing process's PID (`build.ts` names the staging dir
`.hf-shell-<name>-${process.pid}`). Every build gets a new one, so every emitted declaration
map — and therefore every tarball hash — is unique to the run that produced it. The three
shells vendored into the docs site show the same thing (`-33670`, `-26449`, `-32979`), so
this is every generated shell, not one feature's mistake.

## Why it's friction (consumer lens)

1. **No integrity guard is possible.** A vendored tarball is only trustworthy if I can prove
   it matches its sources. For a plain library I pack into a temp dir and compare hashes; for
   a shell there is nothing stable to compare, so vendored shells can silently go stale and
   the only symptom is a wrong contract at runtime.
2. **Every repack is a binary diff.** Vendoring a shell into a repo means a new ~124 kB blob
   in history each time the shell is rebuilt, even when nothing about it changed.
3. **The path it records never existed for me.** The staging directory is deleted when the
   build finishes, so the declaration map points at nothing — it cannot help anyone debug,
   and it publishes the build machine's directory layout and a PID to whoever installs it.

## Proposed fix / improvement

Make the emitted shell independent of where it was staged: either strip or rewrite the
declaration map's `sources` to a stable placeholder, or give the staging directory a name
derived from the feature rather than the process (a fixed `.hf-shell-<name>` cleaned before
use, with collisions avoided by locking rather than by PID). Either makes `hf build`
reproducible, which is what lets a consumer vendor a shell and verify it later. A test that
packs the same feature twice and asserts identical bytes would pin it.

## Repro / evidence

```bash
npx nx run demo-koi-fish-vanilla:pack-shell   # note the tarball's sha512
npx nx run demo-koi-fish-vanilla:pack-shell --skip-nx-cache
# different sha512; `diff -r` over the extracted packages shows only index.d.ts.map,
# differing solely in the `.hf-shell--…-<pid>` path segment.
```
