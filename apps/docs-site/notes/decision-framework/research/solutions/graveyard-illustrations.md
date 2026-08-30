# Graveyard illustrations (historical category evidence)

- Unit type: architectural-strategy (three historical category illustrations in one dossier; none is a candidate for adoption)
- Status (Aug 2026): all three inactive or deprecated; this dossier exists to extract decision evidence, not to evaluate adoptability
- Availability: deprecated / inactive (all three; see per-illustration status lines)
- Version / release cadence at research time: none; all publishing stopped years ago (details per illustration)
- Official links: per illustration below
- Researched: 2026-08-28

## What it is

Three dead or dormant projects that each illustrate a distinct failure mode of a microfrontend category, plus a residue list of smaller dead projects recorded so later phases do not rediscover them. (1) Zalando Tailor / Project Mosaic: the canonical first-generation streaming server-side fragment composition stack, retired by its own sponsor in favor of an internal unified platform; the retirement rationale is itself decision evidence about heterogeneous-fragment friction. (2) Ara Framework + Airbnb Hypernova: the Hypernova-era SSR composition branch, which depended on a single company's rendering service and went dormant when that service was abandoned upstream. (3) FrintJS: a framework-agnostic modular app framework that never built a community large enough to survive its sponsor's attention moving elsewhere. None of these is evaluated for adoption; the findings below are the durable lessons their deaths encode.

### Illustration 1: Zalando Tailor / Project Mosaic

- Status (Aug 2026): deprecated. GitHub repo archived 2022-12-05, read-only [E1]. Last npm publish of `node-tailor` was 3.9.2 on 2018-11-15, four years before the formal archive [E2]. Inventory status "deprecated (archived)" is confirmed; the refinement worth recording is that effective abandonment (npm) preceded formal archival by roughly four years.
- Links: https://github.com/zalando/tailor [E1], https://www.mosaic9.org/ [E3]
- What it was: a Node.js layout service that composed a web page from independent "fragment services" over HTTP, streaming fragment markup in parallel into a template without blocking, with performance budgets and fallback handling [E1]. Mosaic was the umbrella: services, libraries, and a specification for how fragments interact [E3]. This is the archetype the "server-side fragment composition" family descends from.
- The retirement story (the decision evidence): Zalando built Mosaic from 2015 to escape a monolith and let many teams ship independently [E4]. By 2018 Zalando publicly described a replacement, Interface Framework: renderers (self-contained UI blocks declaring their own data dependencies), a recommendation system choosing renderers per page, and a centralized rendering engine [E5]. By March 2021 Zalando reported "around 90% of traffic" served via Interface Framework [E4]. The stated pain points that motivated the replacement: differences in tech stacks, bundling, and deployment practices across fragments produced inconsistent user experience and cross-team collaboration difficulty, plus a high entry barrier for contributing teams; the replacement's goals were a unified tech stack, centralized deployment and operation, and guaranteed UX consistency [E4][E5]. The 2023 follow-up confirms the Rendering Engine remained Zalando's production web framework [E6].
- Reading: the company that proved streaming fragment composition at scale concluded that maximal per-fragment autonomy (any stack, any bundling, any deploy practice) was the property to remove, and migrated toward a centralized platform where autonomy lives at the renderer level inside one stack. That is evidence about where the cost of heterogeneity lands (UX consistency, cross-team collaboration, onboarding), not evidence that fragment composition cannot work. Claim type for the pain-point statements: officially-supported (Zalando's own engineering blog). Claim type for the reading: inference.

### Illustration 2: Ara Framework + Airbnb Hypernova

- Status (Aug 2026): inactive. Hypernova was archived by Airbnb on 2023-10-09 with the note that Airbnb no longer used the technology internally and interested parties should fork [E7]. The ara-framework GitHub org's repos are not formally archived but are dormant: last push to `ara-cli` 2023-02-27, most repos untouched since 2020-2021, `ara-cli` at 56 stars [E8]; last npm publish of `ara-cli` was 1.0.0-alpha.5 on 2020-06-13 and it never left alpha [E9]. Inventory status "inactive" is confirmed; refinement: dormant-but-unarchived, and effectively dead from mid-2020 on the npm side, three years before Hypernova's formal archive.
- Links: https://github.com/airbnb/hypernova [E7], https://github.com/ara-framework (org) [E8]
- What it was: Hypernova is a standalone HTTP service for server-side rendering JavaScript views; application servers POST component names plus data, get HTML back, and the browser progressively enhances it [E7]. Ara Framework wrapped Hypernova into a microfrontend architecture: per-framework Hypernova bindings (Vue, React, Svelte, Angular, Preact, and others, visible as the org's repo roster [E8]), a CLI, a proxy (`nova-proxy`) that composed Hypernova-rendered views into pages, and client-side bindings for hydration. It was the principal attempt to generalize Hypernova from "SSR service for one company's stack" into a composition architecture.
- The death mechanism: Ara's entire composition boundary was Hypernova's request/response contract. Hypernova had exactly one sponsor with an internal use case; when Airbnb's internal usage ended, the archive followed, and the downstream branch had already stopped publishing (Ara's npm activity ended 2020, before the upstream archive) [E7][E8][E9]. The dependency was structural, not incidental: Ara could not outlive Hypernova without becoming its maintainer. Claim type: inference from repository and registry timelines; the archival facts themselves are officially-supported.

### Illustration 3: FrintJS

- Status (Aug 2026): inactive. Not archived, but the last push to frintjs/frint was 2018-09-22, the last npm publish of `frint` was 5.7.2 on 2018-09-11, 757 stars, 61 open issues frozen in place [E10][E11]. Inventory status "inactive" is confirmed; refinement: roughly eight years without a commit while presenting as merely "mature", which is itself a trap for evaluators reading the README instead of the commit log.
- Links: https://github.com/frintjs/frint [E10]
- What it was: a modular JavaScript framework building apps from composable "Apps" with dependency injection and RxJS-based reactivity, environment-agnostic (browser, server, CLI) and rendering-library-agnostic (React, Vue, Preact integrations) [E10].
- The death mechanism: nothing dramatic. No sponsor retirement post, no archive notice, no successor. The community never reached the size where maintenance survives the founders' attention moving on; activity simply stopped. This is the modal death in this space: silent stall, not announced deprecation. Claim type: inference from activity data [E10][E11]; the activity data are repo-observed facts.

## Composition mechanics

Recorded only to place the illustrations in family space; none is adoptable.

- Tailor/Mosaic: composition boundary = HTML fragment over HTTP; integration phase = runtime (server-side, per-request); execution model = server-composed document, fragments as independent HTTP services, client assets loaded per fragment.
- Ara/Hypernova: composition boundary = Hypernova's HTTP render contract (component name + props in, HTML out); integration phase = runtime (server-side) with client hydration; execution model = server-composed markup, per-view hydration in a shared browser realm.
- FrintJS: composition boundary = JS module graph with an App/DI lifecycle contract; integration phase = build time; execution model = shared JS realm, shared DOM.

## Findings by matrix group

These findings are about the graveyard as evidence, not about adopting the projects. Groups that only make sense for adoptable units are marked NA.

### Build-time coupling
- NA for adoption. One historical datum: Zalando cited divergent bundling practices across fragments as a retirement driver, meaning absence of build-time coupling was experienced as a cost, not only a freedom. Value: NA (historical evidence). [E4] officially-supported.

### Runtime coupling
- NA for adoption.

### Isolation and failure containment
- NA for adoption. Tailor's fallback-on-fragment-failure design shows first-generation fragment composition already treated failure containment as a core feature. Value: NA (historical evidence). [E1] officially-supported.

### Framework requirements
- NA for adoption.

### Ownership topology fit
- Single-company sponsorship without external community is a project-survival risk: Hypernova's archive notice explicitly ties the archive to the sponsor's internal usage ending. Value: Yes (risk is real, demonstrated). [E7] officially-supported.
- Downstream projects whose composition boundary is another project's service contract inherit that project's lifetime: Ara predeceased and then was formally orphaned by Hypernova. Value: Yes. [E7][E8][E9] inference from timelines.

### Migration requirements
- A sponsor can migrate off its own fragment architecture gradually by embedding old fragments inside the new system: Zalando's Rendering Engine ran Mosaic fragments inside Renderers during the multi-year transition. Value: Yes (demonstrated once, at Zalando). [E4] officially-supported. Do not generalize beyond "possible with a compatibility layer"; this is one company's account.

### Deployment
- NA for adoption. Zalando's replacement centralized deployment and operations; decentralized per-fragment deploys were part of what got retired. Value: NA (historical evidence). [E4] officially-supported.

### Contracts and communication
- Heterogeneous per-fragment stacks produced the friction Zalando cited (UX inconsistency, collaboration difficulty, onboarding barrier); the friction attached to the boundary being "any stack behind an HTML contract". Value: Yes (as reported by the sponsor). [E4][E5] officially-supported.

### UX implications
- Cross-fragment UX consistency does not come free from fragment composition; Zalando's stated fix was centralizing the stack and design language. Value: Yes (one sponsor's production conclusion). [E4] officially-supported.

### Performance causes
- NA. Streaming composition's performance properties are covered by the living server-side fragment composition dossier; Tailor's parallel streaming design is ancestry, not evidence.

### Security and trust
- NA for adoption.

### SSR and delivery
- The Hypernova-style "SSR as a separate HTTP render service" branch is dead as a maintained OSS lineage; its living descendants are framework-integrated SSR and the Podium/fragment lineage. Value: Yes (branch dead). [E7][E8][E9] inference from repo/registry status.

### Operational model
- Formal archive dates lag effective abandonment by years (Tailor npm 2018 vs archive 2022; Ara npm 2020 vs upstream archive 2023; FrintJS never archived at all). An evaluator using "archived?" as the liveness test will misclassify projects in both directions. Value: Yes. [E1][E2][E7][E8][E9][E10][E11] inference from dated records.

## Editions and commercial layer

None. All three were pure OSS; none had a commercial edition. Zalando's replacement (Interface Framework / Rendering Engine) is internal and was never released.

## Family mapping (provisional)

- Tailor/Mosaic: server-side fragment composition (ancestor of the family's living members: Podium, SSI-based setups).
- Ara/Hypernova: server-side composition via SSR-service, a branch with no living OSS representative.
- FrintJS: build-time modular app composition (closer to plugin architecture than to microfrontends proper).

## What the graveyard teaches

1. Churn and longevity are matrix attributes, not background noise. The graveyard is large enough (three illustrations plus eleven residue projects from one inventory pass) that "expected maintenance horizon" and "what happens to us if this dies" belong in the decision matrix as first-class columns, scored per candidate. Claim type: inference from the inventory itself.
2. Sponsorship shape predicts death shape. Single-company OSS dies when the company's internal need ends (Hypernova, and Tailor once Zalando moved on); small-community OSS dies silently with no notice at all (FrintJS). Multi-adopter or foundation-backed projects are the only ones whose lifetime is not one organization's roadmap. When scoring candidates, record who sponsors it and whether any production user exists outside the sponsor. Claim types: the deaths are officially-supported or repo-observed; the predictive rule is inference.
3. Composition-boundary friction has a recurring pattern: the freer the boundary (any stack, any bundler, any deploy), the more the integration cost migrates into UX consistency, cross-team collaboration, and onboarding, and the sponsor eventually re-centralizes. Zalando is the documented instance; the framework should treat "who pays for heterogeneity, and where" as an explicit attribute rather than assuming autonomy is free. Claim type: officially-supported for Zalando's instance; inference as a general pattern (n=1 well-documented case; do not overweight).
4. Retirement stories outrank marketing. A sponsor's public explanation of why it retired its own architecture (Zalando's fragment pain points) is some of the highest-grade evidence in this research: it is a production-scale negative result, published against interest. Prefer such accounts over feature lists when scoring the corresponding living families. Claim type: inference (methodological).
5. Liveness must be measured, not read. Use last publish and last push dates, not archive flags or README tone; two of the three illustrations looked healthier than they were by their front pages. Claim type: inference from [E1][E2][E8][E9][E10][E11].

Dead-list residue (recorded so later phases do not rediscover them; none warrants a dossier): NUT, Berial, Nuz, Micromono, Compoxure, Cellular JS, Misk Web, Scalecube-js, PuzzleJs, EMP, Fronts.

## Ambiguities and decomposition candidates

- "Project longevity" is subjective as one attribute; split into: (a) months since last release, (b) months since last non-trivial commit, (c) sponsor type (single-company / community / foundation / commercial vendor), (d) count of known production adopters outside the sponsor, (e) existence of a published deprecation or succession statement.
- "Single-company sponsorship risk" splits into: sponsor still uses it internally (Yes/No/Unknown) and project survives loss of sponsor (has it ever changed maintainers).
- "Composition-boundary friction" is not scoreable as-is; decompose into: who owns cross-participant UX consistency, who pays onboarding cost for a new contributing team, and whether deploy practices are unified or per-participant.

## Sources

- [E1] https://github.com/zalando/tailor (accessed 2026-08-28) - archived 2022-12-05, read-only; streaming layout service composing pages from fragment services; fallback handling
- [E2] https://registry.npmjs.org/node-tailor (accessed 2026-08-28) - latest 3.9.2 published 2018-11-15
- [E3] https://www.mosaic9.org/ (accessed 2026-08-28, via search snippet) - Mosaic umbrella definition: services, libraries, and interaction spec
- [E4] https://engineering.zalando.com/posts/2021/03/micro-frontends-part1.html (accessed 2026-08-28) - fragment pain points (stack/bundling/deploy divergence, UX inconsistency, entry barrier), ~90% traffic on Interface Framework, Mosaic-fragments-inside-Renderers migration path
- [E5] https://engineering.zalando.com/posts/2018/12/front-end-micro-services.html (accessed 2026-08-28) - Interface Framework announced as Tailor replacement; renderers, recommendation system, centralized rendering engine
- [E6] https://engineering.zalando.com/posts/2023/07/rendering-engine-tales-road-to-concurrent-react.html (accessed 2026-08-28) - Rendering Engine still Zalando's production web framework in 2023
- [E7] https://github.com/airbnb/hypernova (accessed 2026-08-28) - archived 2023-10-09; "no longer using this technology internally"; SSR-as-HTTP-service mechanics
- [E8] https://api.github.com/orgs/ara-framework/repos (accessed 2026-08-28) - repo roster with per-framework bindings; none archived; last pushes 2019-2023; ara-cli 56 stars
- [E9] https://registry.npmjs.org/ara-cli (accessed 2026-08-28) - latest 1.0.0-alpha.5 published 2020-06-13, never left alpha
- [E10] https://github.com/frintjs/frint (accessed 2026-08-28) - README claims (modular Apps, RxJS, environment- and renderer-agnostic); 757 stars; not archived
- [E11] https://api.github.com/repos/frintjs/frint and https://registry.npmjs.org/frint (accessed 2026-08-28) - last push 2018-09-22; latest 5.7.2 published 2018-09-11; 61 open issues
