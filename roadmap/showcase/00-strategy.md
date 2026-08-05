# 00 — Showcase Strategy

The execution strategy for turning `@hyperfrontend/features` into proof. This is the narrative behind the [index](README.md); read it once, then execute against the numbered plans.

---

## North star and what serves it

**Proof in the wild** is the north star. The other three goals named at the outset all serve it:

- **Hardening** makes the proof _trustworthy_ — every demo that hurts to build surfaces a fix.
- **Teaching material** makes the proof _legible_ — how-to guides and docs grow out of real consumer experience.
- **Scaling machinery** (the generator) makes the proof _abundant_ — demos get cheap and consistent.

The **audience is the author's portfolio**: people evaluating capability and ecosystem depth. So the dominant axis is **variety and range** — playful spectacle next to serious enterprise, many integration patterns, many frameworks — all crafted enough to be credible, and all telling the "many independent packages compose into something larger" story.

## The thesis, stated precisely

`@hyperfrontend/features` makes independent web apps — often in **different frameworks** — coordinate **messages _and_ visuals** so seamlessly the seams disappear.

The message half is what the SDK does (contract-validated `send`/`on` over `@hyperfrontend/nexus`) and is proven live by the shipped demos. The visual half — independent apps composited into one shared scene — is the harder, more spectacular claim, canonically embodied by the **koi pond** ([15-koi-pond.md](15-koi-pond.md)): seven framework-distinct fish apps in layered transparent frames over a host-owned pond.

A demo is a **complete composition**: at least one host and one hostee, with the _topology_ as the point — one host with many hostees, a hostee that is itself a host (Russian-doll, short but long enough to prove it), one-way or two-way, 1:1 / 1:many / many:1 / many:many. Because the gallery is itself a hyperfrontend host, **nesting proves itself**: gallery host → demo host → demo hostee. The koi pond realizes the first instance of that chain (its pond host is also a hostee the gallery mounts).

Four of the six original demo slot reservations remain empty placeholders (`chess`, `events`, `file-share`, `views`); the composition model they grow into is settled in [catalog.md](catalog.md) §5.

---

## The remaining implementation journeys

Each maps to one or more numbered plans; dependencies are explicit; discovery is distinguished from execution.

### J-koi — The visual flagship (plan 15, next up)

The koi pond: seven framework fish apps over a host pond, composited into one scene. Jumps the generator gate deliberately — hand-built like the two demos before it. See [15-koi-pond.md](15-koi-pond.md).

### J-hardening — Product hardening (findings registry)

The findings registry is the backlog; open findings (currently F-005, F-006, F-008) feed the next fix cut. The notional plugin material in [05-plugin-system.md](05-plugin-system.md) predicts one more: richer host introspection for a debug/inspection plugin.

### J-scaling — Repeatability (plan 06)

Genericize the blank prototype into the **internal Nx demo generator**, with conventions, lint rules, broad-framework templates (incremental), and validation. The generator is proven when it can reproduce the heartbeat demo's shape from the blank prototype.

### J-legacy — Legacy distillation (plan 07, parallel)

Bounded extract-then-delete of the untracked `_/` legacy subtrees. Produces distilled-idea stubs and committed Tier-1 keepers, then frees ~144 MB. Blocks nothing; runs alongside everything.

### J-breadth — Breadth build-out (plans 08, 09, 10)

The curated catalog, batched by capability/tier and built via the generator, deployed as-you-go:

- **08 — boundary-respecting**: enterprise/gallery features; a few warrant real backends (payments, auth).
- **09 — pattern**: Russian-doll nesting, cross-framework host/feature, many:many — the topology proofs.
- **10 — spectacle**: colourcopia, drag default event/error handling, terminal, voice.

### J-centerpiece — The flagship (plan 11) and gallery residue (plan 12)

The **flagship composed app** (the "into something larger" narrative made literal), plus the gallery's remaining teaching material: per-demo how-to guides, and registering each new demo as it lands.

### J-release — Release residue (plan 13)

The docs refresh owed from the last release loop, and verifying the live embeds after the next main-merge redeploy.

---

## Deployment and the origin-boundary layer

Deployment is not a separate plan; what remains is execution inside each demo's deploy step. **Proof = live**, so visibility is load-bearing, not an afterthought.

**Provider and mechanism.** Railway hosts everything that needs hosting — one provider, one mental model. Each hostable artifact is its own Railway **service** with its own **origin**, so cross-origin is real, not simulated. Deploys ride Railway's **GitHub integration**: services rebuild on merge to `main` once CI completes successfully. Service configuration (which service builds what, domains, env) lives in the **Railway dashboard, deliberately not in-repo**; each demo's `project.json` records the facts (`metadata.deploy`: provider, service, origin, boundary role, publishDir) for humans and the gallery. Static SPAs are served by a minimal static-file service per origin; demos that warrant a real backend get a small Railway backend service.

**Gallery registration.** Demos register in the static manifest (`apps/docs-site/src/lib/demo-manifest.ts`) — slug, title, boundary, stack, deployed origin (env-overridable for local `hf dev`), source links. A demo is registered as it lands (invariant #3).

**The origin-boundary matrix (the security layer).** The point is to make visible — and testable — where browser-origin guarantees can be **weakened or bypassed**: `target.postMessage(payload, '*')`, or a `message` listener with no origin check. Demos that make this their point deploy across three boundaries:

- **Same-origin** — host + hostee on one origin. The weakened case: `'*'` and unchecked listeners "work," masking the risk.
- **Cross-origin, same-site** — different subdomains of the primary domain. A different origin; `postMessage` origin checks and CORS begin to bite.
- **Cross-site** — host on the primary domain, hostee on the second domain. The strongest boundary: cookies (SameSite), storage partitioning.

The contrast a security demo draws: `postMessage(payload, '*')` leaks across origins; `postMessage(payload, expectedOrigin)` plus an origin-checked listener contains it. The concrete demo is the sharpened **Security bounty hunter** ([catalog.md](catalog.md)). Cross-origin stays **real** — never faked by serving everything together — and same-origin is an **explicit, labeled** scenario demonstrating the weakened warranty. (A spectacle demo may still choose a labeled single origin where the boundary is not its point — the koi pond does.)

**Open (mostly outside the repo).** Custom domain names and their reconciliation with what's provisioned on Railway (both demos currently ride `*.up.railway.app` origins); per-demo boundary-role assignment for future demos.

---

## What deserves its own plan, and why

Every journey above is large enough to reason about independently, so each gets at least one plan. J-breadth splits into three plans because the batches differ in prerequisites and in what they prove. The capture process (the `demo-findings` skill) and the catalog ([catalog.md](catalog.md), a living artifact rather than a numbered plan) are separated from any single demo because they are reused by _every_ plan. Deployment is deliberately **not** a numbered plan: its decisions are settled (see [above](#deployment-and-the-origin-boundary-layer)), leaving only per-demo execution. Numbers of completed plans are never reused; gaps in the sequence mark delivered work whose files were removed.
