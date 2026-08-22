# 16: Koi pond instance model, dynamic shoal, consolidated lib

The koi pond currently boots its full eight-app scene even when mounted as a 288px gallery
card, making it the device's largest low-importance renderer and Android's preferred memory
reclaim victim (frame deaths verified on a physical S24 Ultra; see findings
[F-018](../findings/018-no-way-to-revive-a-session-whose-frame-died.md) and
[F-019](../findings/019-dead-iframe-left-mounted-paints-the-browser-crash-placeholder.md)).
This plan family:

1. **Splits card and expanded into separate pond instances**: a one-fish resting card, and an
   expanded scene that cold-opens with a three-fish shoal behind its curtain.
2. **Makes the shoal dynamic**: visitors add and remove koi, duplicates are allowed with
   variant seeds, and a device-tier cap bounds the roster.
3. **Consolidates the duplicated fish logic into `demo-koi-lib`** (about 78 percent of each
   fish app is shared code) and retunes the motion brain once, centrally.
4. **Redesigns the interaction overlay**: head-centered gradient cones, predicted-path pearl
   dots, a sliding double-caret; full replacement of the color-coded grammar.
5. **Ships the approved robustness fixes**: gallery-side resurrection, visibility polling,
   DPR caps, and a synchronous `hosted` signal in the features SDK.

Evidence for every load-bearing claim is distilled in [recon.md](recon.md).

---

## Locked decisions (do not re-litigate)

All decisions below were interrogated and settled with the author on 2026-08-22.

| Decision               | Locked answer                                                                                                                                                                                                                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expand handover        | Destroy the card instance; cold-open the expanded instance behind its curtain                                                                                                                                                                                                                                                         |
| Card fish pick         | Hour-of-day rotation: `KOI_FRAMEWORKS[hour % 8]`                                                                                                                                                                                                                                                                                      |
| Card motion            | Reuse the `pause` scull; a new `resting` flag suppresses the held chrome                                                                                                                                                                                                                                                              |
| Lib doctrine           | Lib owns body + physics + brain; the brain is configurable via init and runtime hooks                                                                                                                                                                                                                                                 |
| Consolidation breadth  | Full: motion, runtime, wire plumbing, three.js stage, card anchor, `fish.css`                                                                                                                                                                                                                                                         |
| Scene at boot          | SDK exposes `hosted` synchronously; hosted ponds defer shells until the first presentation or set-scene signal (about 1s fallback to full); standalone opens full instantly                                                                                                                                                           |
| Landing hero           | Same one-fish card treatment as the gallery card                                                                                                                                                                                                                                                                                      |
| Perf fixes             | All four: gallery outer resurrection + corpse destroy, visibility polling, floor DPR cap, release-GL-on-hidden                                                                                                                                                                                                                        |
| Inner contract         | One bump to 0.8.0: `pause.resting`, identity `instance`, outline `path`                                                                                                                                                                                                                                                               |
| Duplicates             | Allowed, with variant seeds (same species and palette, jittered phenotype); instance-ID keying throughout the host                                                                                                                                                                                                                    |
| Initial roster and cap | Expanded opens with the hour-anchored trio (`hour % 8`, `+1`, `+2`); cap by device tier 4 / 8 / 12 (low: at most 2GB or at most 4 cores; middle and unknown, including Safari: 8; high: at least 8GB and at least 8 cores: 12); duplicates only reachable above 8                                                                     |
| Controls home          | Unified shoal panel: the roster becomes interactive (add/remove, count badges, presence), the View-interactions toggle moves inside it, and it collapses to a pill under 680px so phones keep it in the full scene                                                                                                                    |
| Overlay dots           | 10 live pearls, 20 hard cap; white, 5 to 6px, opacity 80 percent at the nose fading to 10 percent at the horizon; consumed at the nose, appended at the horizon; the path is predicted advancement (curved), not a direction ray                                                                                                      |
| Overlay grammar        | Full replacement of green/red/yellow: head-centered cone origin, gradient-to-transparent cone edges, sliding double-caret around the head; escapes and depth read through path curvature and caret motion; monochrome                                                                                                                 |
| Motion tuning          | Three turn tiers (subtle/normal/hard) chosen by obstacle proximity, always least effort; slowdown proportional to maneuver magnitude; global turn-magnitude cap at 80 percent of current ceilings; avoidance side chosen by the obstacle field, with a seeded 70/30 right bias when evidence is equal so head-on pairs mutually avoid |

---

## Phases

Each phase is independently verifiable and has its own folder with one sub-plan per work
item. Read the phase README first; it orders the sub-plans and states the phase gate.

| Phase | Folder                                                                   | Theme                                                                                                      | Depends on |
| ----- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ---------- |
| 1     | [phase-1-lib-consolidation](phase-1-lib-consolidation/README.md)         | The consolidated koi lib: brain, runtime, wire, stage, geometry; motion retune; contract 0.8.0             | none       |
| 2     | [phase-2-isolated-improvements](phase-2-isolated-improvements/README.md) | Self-contained fixes: SDK `hosted` signal, visibility polling, DPR caps, gallery resurrection, device tier | none       |
| 3     | [phase-3-instance-model](phase-3-instance-model/README.md)               | Instance keying, dynamic shoal, deferred boot, card profile, fish migration, repack                        | 1, 2       |
| 4     | [phase-4-chrome-and-overlay](phase-4-chrome-and-overlay/README.md)       | Unified shoal panel, overlay grammar replacement, vitals                                                   | 1, 3       |
| 5     | [phase-5-integration](phase-5-integration/README.md)                     | Gallery choreography, guides, doctrine, findings, device acceptance                                        | 3, 4       |

### Sequencing constraints that are easy to miss

- **Phases 1 and 2 can run in parallel**; nothing in one blocks the other.
- **The SDK change gates phase 3.** Demos consume the published `@hyperfrontend/features`
  package, never workspace source. The `hosted` signal
  ([phase 2, item 1](phase-2-isolated-improvements/01-lib-features-hosted.md)) must land on
  `main` and publish before the pond's deferred boot can be written against it. Land it
  early. Watch the version bump: the change is a `feat` and must produce a minor bump; the
  changelog window has under-bumped feature releases before, so verify the computed version
  before the release merge.
- **Phases 3, 4, and 5 land on `main` in the same release cycle.** The pond README's
  standing doctrine ("never a simulation engine", `apps/demos/koi-pond/README.md:16`)
  becomes false the moment the fish adopt lib primitives in phase 3; its rewrite ships in
  phase 5. Shipped prose must never contradict shipped code on `main`.

---

## Guardrails (single source; every sub-plan links here)

1. **Shipped prose is timeless.** No mention of phases, plans, roadmaps, or this folder in
   any deliverable: code comments, JSDoc, package READMEs, ARCHITECTURE files, guides, skill
   files, commit messages. Write present-state descriptions only and avoid trajectory
   wording ("now", "new", "no longer", "previously", "moved"). This folder is the only home
   for the development trajectory.
2. **Comment style.** Single-line comments with `// why:` / `// how:` / `// note:` prefixes;
   the lint autofix silently deletes unprefixed continuation lines.
3. **No em dashes** in `guide.md`, `README.md`, or JSDoc; grep for the character before
   finishing any doc edit.
4. **Append-only identity.** `KOI_FRAMEWORKS` and every trait or body draw band are
   append-only (list position is seed identity, `lib/src/model/types.ts:28`,
   `lib/src/model/traits.ts:76-79`). Variant seeds are derived, never repositioned.
5. **Commits.** Scope is the Nx project name, one project per commit, single-line messages,
   never `--no-verify` (see `.claude/skills/commit-messages/`).
6. **Consumer-only usage.** Demos consume the published `@hyperfrontend/features` and the
   packed `file:` tarballs exactly as an external consumer would; no workspace shortcuts.
7. **Every friction is a finding.** File via the `demo-findings` skill before working around
   it (registry: [findings/README.md](../findings/README.md)).
8. **Vendored shells.** Every vendored shell package stays in `dependency-checks`
   `ignoredDependencies` by exact name, or `lint --fix` deletes the dependency and breaks
   the build.
9. **Read the skills first.** `.claude/skills/coding/SKILL.md` and
   `.claude/skills/koi-pond-demo/SKILL.md` before touching any of these projects.
10. **Fish apps carry no tests.** Every behavior moved into `demo-koi-lib` inherits its spec
    obligations, including the mutation-proven suites.

---

## Verification conventions

Each sub-plan ends with the standard per-project block (the only content deliberately
repeated across files):

```bash
npx nx test PROJECT
npx nx lint PROJECT --fix
npx nx typecheck PROJECT
npx nx format:write --projects=PROJECT
```

Phase READMEs add the phase gate (multi-project runs, builds, browser checks). The full koi
family gate, rerun once after phase 5:

```bash
npx nx run-many -t test build lint typecheck -p demo-koi-lib demo-koi-pond demo-koi-fish-vanilla demo-koi-fish-react demo-koi-fish-vue demo-koi-fish-svelte demo-koi-fish-solid demo-koi-fish-preact demo-koi-fish-lit demo-koi-fish-angular
```
