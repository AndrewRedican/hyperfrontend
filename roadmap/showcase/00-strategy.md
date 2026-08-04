# 00 — Showcase Strategy

The sharpened execution strategy for turning `@hyperfrontend/features` into proof. This is the narrative behind the [index](README.md); read it once, then execute against the numbered plans.

---

## North star and what serves it

**Proof in the wild** is the north star. The other three goals named at the outset all serve it:

- **Hardening for v2** makes the proof _trustworthy_ — every demo that hurts to build surfaces a fix.
- **Teaching material** makes the proof _legible_ — how-to guides and docs grow out of real consumer experience.
- **Scaling machinery** (the generator) makes the proof _abundant_ — demos get cheap and consistent.

The **audience is the author's portfolio**: people evaluating capability and ecosystem depth. So the dominant axis is **variety and range** — playful spectacle next to serious enterprise, many integration patterns, many frameworks — all crafted enough to be credible, and all telling the "many independent packages compose into something larger" story.

## The thesis, stated precisely

`@hyperfrontend/features` makes independent web apps — often in **different frameworks** — coordinate **messages _and_ visuals** so seamlessly the seams disappear.

The message half is what the SDK already does (contract-validated `send`/`on` over `@hyperfrontend/nexus`). The visual half — a host choreographing feature containers on a shared surface — is the harder, more spectacular claim, canonically embodied by the **koi pond**: SVG fish, each a minimal-framework feature app, swimming on a pond host in another framework, framework-themed, autonomously wandering yet _coordinating_ (collision-avoidance between fish, host repositioning containers).

A demo is a **complete composition**: at least one host and one hostee, with the _topology_ as the point — one host with many hostees, a hostee that is itself a host (Russian-doll, short but long enough to prove it), one-way or two-way, 1:1 / 1:many / many:1 / many:many. Because the gallery is itself a hyperfrontend host, **nesting proves itself**: gallery host → demo host → demo hostee.

---

## Two discoveries from the grill (acted on before any demo code)

1. **The plugin system is a phantom.** `ExperiencePlugin` is an exported _type with zero implementation_ — `onMount`/`onUnmount` are invoked nowhere in `libs/features/src`, and `ShellOptions` has no `plugins` field ([libs/features/src/host/plugins.ts](../../libs/features/src/host/plugins.ts), [libs/features/src/shared/types.ts](../../libs/features/src/shared/types.ts)). The instruction to "showcase the plugin system already built in" rests on a false premise. The chosen approach — "formalize the plugin escape hatch" — therefore means **building the plugin system for the first time** ([05-plugin-system.md](05-plugin-system.md)). It is the keystone: the same hook that showcases the plugin system also hands a demo the container element it needs for visual choreography. The committed cut is the registration + lifecycle **seam**, generalized to carry any plugin kind; a broader plugin taxonomy and a showcase-internal debug/inspection plugin are captured as **notional** design in [05-plugin-system.md](05-plugin-system.md).

2. **`_/` is untracked.** The 162 MB legacy directory is gitignored — 0 files in version control. "Delete it once and for all" is therefore _irreversible_, so distillation must **commit the keepers before deleting** ([07-legacy-distillation.md](07-legacy-distillation.md)).

A third, smaller reality: `apps/demos/{chess,clock,events,file-share,heartbeat,views}` already exist as **empty placeholders** (`.gitkeep` + `package.json` + `project.json` + `README.md`, project `demo-<name>`, no source). Demo 1 fills a reserved-but-empty slot; the single-app-per-demo placeholder convention must grow into the host+hostee composition model — a thing the blank prototype settles.

---

## The major implementation journeys

Seven coherent swaths. Each maps to one or more numbered plans; dependencies are explicit; discovery is distinguished from execution.

### J1 — Foundations & weed-clearing (plan 01 ✓ delivered; 04 pending)

The capture process now stands — the `demo-findings` skill. What remains: stand up the [deployment layer](#deployment-and-the-origin-boundary-layer) and **Demo 1 (Clock)** end-to-end as a real external consumer. The deliverable is not a clock; it is a cleared path — install → cross-framework host+hostee → contract → dev loop → build → deploy → embed → capture — and a **blank prototype** extracted as a by-product. Slow on purpose: this journey pays down the friction every later demo would otherwise re-encounter.

### J2 — Product hardening for v2 (plan 05, + findings)

Build the plugin system (phantom → real) and address whatever else Demo 1 surfaces. The findings registry is the backlog; this journey is where the high-severity entries get fixed.

### J3 — Repeatability & scaling (plan 06)

Genericize the blank prototype into the **internal Nx demo generator**, with conventions, lint rules, broad-framework templates (incremental), and validation. **Demo 2** is the generator's first real test case — its emphasis is repeatability, not novelty.

### J4 — Legacy distillation (plan 07, parallel)

Bounded extract-then-delete of `_/`. Produces distilled-idea stubs and committed Tier-1 keepers (the fluent Connector API, contract/action patterns, the scenario-mock model), then frees the 162 MB. Blocks nothing; runs alongside J1–J3.

### J5 — Breadth build-out (plans 08, 09, 10)

The curated catalog, batched by capability/tier and built via the generator, deployed as-you-go:

- **08 — boundary-respecting**: enterprise/gallery features; a few warrant real backends (payments, auth).
- **09 — pattern**: Russian-doll nesting, cross-framework host/feature, many:many — the topology proofs.
- **10 — spectacle / plugin**: koi pond, colourcopia, drag default event/error handling, clock spectacle — depend on the plugin system (J2).

### J6 — The centerpiece (plans 11, 12)

The **flagship composed app** (the "into something larger" narrative made literal) and the **self-hosting gallery** realized within the docs site — live embeds, carousel, per-demo pages (live + source + how-to).

### J7 — v2 release (plan 13)

Triage the findings registry into concrete v2 changes, publish, and refresh docs/how-tos/ARCHITECTURE. The proof loop closes: the demos that exposed the rough edges become the demos that show them sanded down.

---

## Deployment and the origin-boundary layer

Deployment is not a separate plan — the decisions below are settled; what remains is execution inside each demo's deploy step. **Proof = live**, so visibility is load-bearing, not an afterthought.

**Provider.** Railway hosts everything that needs hosting — apps, widgets, demos, live artifacts — chosen for being cheap and simple at this stage. One provider, one mental model. Each hostable artifact is its own Railway **service** with its own **origin**, so cross-origin is real, not simulated. Static SPAs are served by a minimal static-file service per origin; the few demos that warrant a real backend get a small Railway backend service. Cloudflare and GitHub Pages are out of scope.

**The origin-boundary matrix (the security layer).** The point is to make visible — and testable — where browser-origin guarantees can be **weakened or bypassed**: `target.postMessage(payload, '*')`, or a `message` listener with no origin check. A `'*'` target (or an unchecked listener) forfeits the warranty stricter origin handling would otherwise give. Demos that make this their point deploy across three boundaries:

- **Same-origin** — host + hostee on one origin. The weakened case: `'*'` and unchecked listeners "work," masking the risk.
- **Cross-origin, same-site** — different subdomains of the primary domain. A different origin; `postMessage` origin checks and CORS begin to bite.
- **Cross-site** — host on the primary domain, hostee on the second domain. The strongest boundary: cookies (SameSite), storage partitioning.

The contrast a security demo draws: `postMessage(payload, '*')` leaks across origins; `postMessage(payload, expectedOrigin)` plus an origin-checked listener contains it. The concrete demo is the sharpened **Security bounty hunter** ([catalog.md](catalog.md)).

**Domains.** Two registrable domains (cheap, procured for this): a **primary** (`<zone-a>` — gallery, most hosts, cross-origin same-site subdomains) and a **secondary** (`<zone-b>` — cross-site hostees, a distinct eTLD+1). Subdomain pattern `<demo>-<role>.<zone>` (e.g. `clock-host.<zone-a>`, `clock-face.<zone-b>`). Railway's default `*.up.railway.app` origins cover preview/staging before custom domains attach.

**Monorepo → deploy.** Everything is configured, built, deployed, and reasoned about from this single codebase. Each demo is an Nx project (host + hostee subprojects) under `apps/demos/<demo>/`; each deployable project carries deploy metadata (target Railway service, assigned origin/domain, boundary role), with a workspace manifest mapping project → service → origin. CI selects changed demos with `nx affected` (mirroring the [`library-ci-workflows`](../../.claude/skills/library-ci-workflows/SKILL.md) path-filter approach) and deploys each to its service, with per-PR previews. This reuses the shape of a prior Railway setup in this codebase's lineage — per-project deploys off `nx affected` + a project→service map — re-validated rather than assumed.

**Gallery registration.** A deployed demo announces its live URL(s) + metadata (including boundary role) so the gallery ([12-gallery-docs-integration.md](12-gallery-docs-integration.md)) can mount it (static manifest vs. runtime registry).

**Locked.** Deploy-as-you-go, per-service origin on Railway. Test both boundaries deliberately (supersedes "do not collapse to same-origin"): cross-origin stays **real** — never faked by serving everything together — and same-origin is an **explicit, labeled** scenario demonstrating the weakened warranty.

**Open (mostly outside the repo).** Actual domain names (and reconciliation with anything already owned / provisioned on Railway); per-demo boundary-role assignment; Railway specifics — static-hosting approach, per-service cost at the demo count, custom-domain + TLS, API token + per-service IDs for CI; and how demos consume the **published** package in CI without workspace shortcuts (a finding Demo 1 surfaced and resolved).

---

## Special handling

- **Demo 1 (Clock)** — plan 04, delivered and removed. Its job is to expose setup/packaging/dev-loop/deploy/gallery-embed/capture friction with the lowest possible feature-risk, so the friction is cleanly attributable. It births the blank prototype and is the first real exercise of the `demo-findings` skill. Expected to take the longest.
- **Demo 2 (+ generator)** — [06-demo-2-and-generator.md](06-demo-2-and-generator.md). Emphasis flips to repeatability: it exists to _prove the generator_ and lay down the conventions/templates/validation that make demos 08+ cheap and uniform.

---

## What deserves its own plan, and why

Every journey above is large enough to reason about independently, so each gets at least one plan. J5 splits into three plans because the batches differ in capability prerequisites (08/09 need only the generator; 10 needs the plugin system) and in what they prove. The capture process (01) and the catalog ([catalog.md](catalog.md), a living artifact rather than a numbered plan) are separated from Demo 1 because they are reused by _every_ later plan, and entangling them with the first demo would couple a cross-cutting convention to a single app's quirks. Deployment is deliberately **not** a numbered plan: its decisions are settled (see [Deployment and the origin-boundary layer](#deployment-and-the-origin-boundary-layer)), leaving only per-demo execution — so it lives in this strategy rather than a standalone TIP. The 03 slot is left vacant rather than renumbering 04–13.
