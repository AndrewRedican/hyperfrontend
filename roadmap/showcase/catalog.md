# Demo Catalog

The curated, prioritized, mapped demo backlog — maintained as a living artifact rather than a numbered plan. It reconciles three overlapping historical sources (50 enterprise use-cases, 17 headlines, and a plan trio) into **one** list with a locked build order, so the breadth build-out ([08](08-breadth-boundary-respecting.md)–[10](10-breadth-spectacle-plugin.md)) never chooses between competing inventories.

Read [00-strategy.md](00-strategy.md) for the thesis this serves: _independent apps, in different frameworks, coordinating **messages and visuals** so seamlessly the seams disappear._ Every row below is graded against that.

> **A demo is a composition, not a widget.** Each entry is ≥1 host + ≥1 hostee with a deliberate topology (invariant #4). Many enterprise "demos" in source C are single widgets; they enter the catalog only once given a host and a reason to talk. That reframing is the bulk of the curation.

---

## Legend

| Column         | Values                                                                                                                                                                                                                                                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tier**       | `gallery-feature` (boundary-respecting, [08](08-breadth-boundary-respecting.md)) · `pattern` (topology proof, [09](09-breadth-pattern.md)) · `spectacle` (visual coordination, [10](10-breadth-spectacle-plugin.md), [15](15-koi-pond.md)) · `flagship-component` (a window in the centerpiece, [11](11-flagship-composed-app.md)) |
| **Topology**   | `1:1` · `1:many` · `many:1` · `many:many` · `nested` (a hostee that is itself a host)                                                                                                                                                                                                                                              |
| **Priority**   | `P0` must-ship core (the ten the portfolio leads with) · `P1` strong supporting · `P2` opportunistic long-tail (cheap once the generator lands) · `P3` parked / fold candidate                                                                                                                                                     |
| **Real?**      | `Mock` by default · `Real` only where realism _is_ the proof (auth/payments-class), via a small Railway backend service ([deployment](00-strategy.md#deployment-and-the-origin-boundary-layer))                                                                                                                                    |
| **Prereq**     | **deploy** ([strategy](00-strategy.md#deployment-and-the-origin-boundary-layer)) · `06` generator — every build-out demo implicitly needs `06`, except the hand-built koi pond ([15](15-koi-pond.md))                                                                                                                              |
| **Frameworks** | React / Vue / Vanilla are live; **Svelte / Solid / Preact / Lit** arrive with the koi pond ([15](15-koi-pond.md)); **Angular** deferred                                                                                                                                                                                            |

---

## 1. Must-ship core (P0) — the ten the portfolio leads with

The cut line. These ten, _together_, prove the whole thesis: all four tiers, all five topologies, the framework palette, serious **and** playful, one real backend, and the centerpiece that composes them. Everything below §1 broadens range but proves nothing the core doesn't already. Rows #1 (Clock) and #2 (Heartbeat) have shipped and left the backlog; their numbers stay reserved so cross-references hold.

| #   | Demo                      | Tier               | Topology           | Frameworks                                                            | Capability proven / stressed                                                                                                                                                                                                                              | Real?                       | Prereq                   | Slot                        |
| --- | ------------------------- | ------------------ | ------------------ | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------ | --------------------------- |
| 3   | **Stock dashboard**       | gallery-feature    | 1:many             | React host + mixed widget features                                    | One host composing **many** live-data widget features; contract fan-in; subsumes ledger/portfolio/gauge widgets                                                                                                                                           | Mock (faux feed)            | 06                       | `stock` (new)               |
| 4   | **Auth flow**             | gallery-feature    | 1:1                | React feature → Vanilla host + Railway backend                        | The **real-boundary** proof: secure isolation where the host never sees credentials; contract across a real backend                                                                                                                                       | **Real**                    | deploy, 06               | `auth` (new)                |
| 5   | **Views**                 | pattern            | 1:1                | Vanilla host + one feature                                            | The **presentation model**: one feature shown across all four display modes — embedded, dialog, popup, standalone; contract-declared modes, host-measured geometry                                                                                        | Mock                        | 06                       | `views` (keep)              |
| 6   | **Russian doll / nested** | pattern            | nested             | alternating React → Vue → Vanilla                                     | A hostee that is itself a host, chained — recursion the gallery extends (gallery → demo host → hostee)                                                                                                                                                    | Mock                        | 06                       | `nested` (new; ex-`events`) |
| 7   | **Framework chess**       | pattern            | 1:1 (feat ↔ feat)  | React feature **vs** Vue feature, Vanilla host                        | Two framework-distinct features playing **each other** through a host; complex bidirectional state sync                                                                                                                                                   | Mock                        | 06                       | `chess` (repurposed)        |
| 8   | **Koi fish pond**         | spectacle          | 1:many + nested    | Vanilla pond host + React/Vue/Svelte/Solid/Preact/Lit/vanilla-WC fish | **The** visual proof: seven framework fish apps in layered transparent full-viewport frames over a host pond; host-owned pointer/depth/environment, fish-owned motion; the pond host is itself a hostee the gallery mounts — the first live nesting chain | Mock                        | — ([15](15-koi-pond.md)) | `koi-pond` (new)            |
| 9   | **Colourcopia**           | spectacle          | many:many          | Web Components + mixed                                                | Shared visual state choreographed across many features until the seams vanish entirely                                                                                                                                                                    | Mock                        | 06                       | `colourcopia` (new)         |
| 10  | **Flagship composed app** | flagship-component | many:many + nested | React shell composing features of every framework                     | The centerpiece ([11](11-flagship-composed-app.md)) — "into something larger" made literal (e.g. a fake desktop/OS) whose windows _are_ the demos above                                                                                                   | Mock (+ real where merited) | 08–10                    | `flagship` (new)            |

**Coverage check** (why exactly these ten, counting the two shipped):

- **Tiers** — gallery-feature ×4 (1, 2, 3, 4) · pattern ×3 (5, 6, 7) · spectacle ×2 (8, 9) · flagship ×1 (10). ✔ all four.
- **Topologies** — 1:1 (1, 2, 4, 5, 7) · 1:many (3, 8) · many:many (9, 10) · nested (6, 8, 10). ✔ all shapes the thesis needs.
- **Frameworks** — React, Vue, Vanilla shipped; Svelte/Solid/Preact/Lit arrive on the koi pond; Web Components on colourcopia. ✔ palette shown, not claimed.
- **Both halves of the thesis** — messages (1–7) and visuals (8–10). ✔
- **Serious _and_ playful** — enterprise (3, 4) next to spectacle (8, 9) next to game (7). ✔
- **Mock-unless-merits-real** — exactly one real backend in the core (Auth #4); Payments is its P1 sibling. ✔
- **Prereq spread** — 15 (koi) starts immediately by hand; 06 underwrites the rest. ✔

---

## 2. Named breadth demos (P1 / P2)

The rest of the headlines plus the strongest enterprise picks, each with a real composition. P1 = build right after the core; P2 = opportunistic once the generator makes demos cheap.

| Demo                            | Tier                           | Topology  | Frameworks                       | Capability proven / stressed                                                                                                                                                                                                                                                                                                                                     | Real?              | Prereq     | Prio | Slot / note                        |
| ------------------------------- | ------------------------------ | --------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------- | ---- | ---------------------------------- |
| **Payments**                    | gallery-feature                | 1:1       | React feature + Railway backend  | Real backend; PCI-style isolation — card data never crosses into the host                                                                                                                                                                                                                                                                                        | **Real**           | deploy, 06 | P1   | `payments` (new); absorbs #44      |
| **Omni-bar**                    | flagship-component / pattern   | many:1    | Vanilla host + many feats        | A command bar that dispatches to many features; primary navigation of the flagship                                                                                                                                                                                                                                                                               | Mock               | 06         | P1   | folds into `flagship`              |
| **Security bounty hunter**      | pattern                        | 1:1       | Vanilla                          | The **security-boundary** demo: deliberately uses unsafe patterns (`postMessage(…, '*')`, unchecked listeners), then **contains** them with strict `targetOrigin` + origin-checked listeners — run across the same-/cross-origin/cross-site matrix ([deployment](00-strategy.md#deployment-and-the-origin-boundary-layer)) to surface the weakened-warranty risk | Mock               | deploy, 06 | P1   | `bounty` (new)                     |
| **Navbar**                      | flagship-component             | 1:many    | Vanilla                          | Shared chrome feature across host pages — the flagship's furniture                                                                                                                                                                                                                                                                                               | Mock               | 06         | P2   | folds into `flagship`              |
| **Footer**                      | flagship-component             | 1:many    | Vanilla                          | Smallest possible feature; the "even a footer is a composition" point                                                                                                                                                                                                                                                                                            | Mock               | 06         | P2   | folds into `flagship`              |
| **Fake terminal**               | spectacle / flagship-component | 1:1       | React / Vanilla                  | Streaming output, a terminal app — also a flagship window                                                                                                                                                                                                                                                                                                        | Mock               | 06         | P2   | `terminal` (new)                   |
| **Voice-to-text**               | gallery-feature                | 1:1       | React (Web Speech API)           | Browser-native capability inside an isolated feature; absorbs #28 Meeting Summarizer                                                                                                                                                                                                                                                                             | Real (browser API) | 06         | P2   | `voice` (new)                      |
| **JSON fixer**                  | gallery-feature                | 1:1       | Vanilla                          | Utility feature; round-trips structured payloads over a contract                                                                                                                                                                                                                                                                                                 | Mock               | 06         | P2   | `json-fixer` (new)                 |
| **Default event/error on drag** | spectacle                      | 1:1       | mixed                            | Cross-boundary drag with sane **default** event + error handling; absorbs #24 Kanban, #4 KYC drag                                                                                                                                                                                                                                                                | Mock               | 06         | P2   | `drag` (new)                       |
| **File share** (binary)         | gallery-feature                | 1:1       | Vanilla/React (Angular deferred) | Binary / large-payload transfer across the boundary; absorbs #25, #4                                                                                                                                                                                                                                                                                             | Mock               | 06         | P2   | `file-share` (keep; defer Angular) |
| **Internal messaging thread**   | pattern                        | many:many | mixed                            | Real-time chat on a shared bus — a clean many:many proof (promoted from #27)                                                                                                                                                                                                                                                                                     | Mock               | 06         | P2   | `chat` (new)                       |
| **Collaborative whiteboard**    | pattern / spectacle            | many:many | mixed                            | Multi-user canvas, multi-cursor — many:many + visual (promoted from #50)                                                                                                                                                                                                                                                                                         | Mock               | 06         | P2   | `whiteboard` (new)                 |

---

## 3. The enterprise 50 — folded into the backlog

Source C reconciled. Most enterprise items are single widgets; each is tagged with the tier/topology it would take **once composed**, a priority, and a disposition: **fold** (its capability is already covered by a §1/§2 demo — build it as a widget _inside_ that demo, not standalone), **standalone** (a genuine long-tail candidate), or **promoted** (graduated to §2). The four bolded standalones are the best picks if more enterprise breadth is wanted after the core.

### Finance & Banking

| #   | Demo                  | Tier            | Topology | Prio | Disposition                       |
| --- | --------------------- | --------------- | -------- | ---- | --------------------------------- |
| 1   | Transaction Ledger    | gallery-feature | 1:1      | P2   | fold → Stock dashboard (widget)   |
| 2   | Portfolio Visualizer  | gallery-feature | 1:1      | P2   | fold → Stock dashboard (widget)   |
| 3   | Loan Calculator       | gallery-feature | 1:1      | P3   | standalone                        |
| 4   | KYC Document Uploader | gallery-feature | 1:1      | P2   | fold → Drag / File share          |
| 5   | Fraud Alert Summary   | gallery-feature | 1:many   | P3   | standalone (live feed)            |
| 6   | Currency Converter    | gallery-feature | 1:1      | P2   | fold → Payments / Stock dashboard |
| 7   | Budget Planner        | gallery-feature | 1:1      | P3   | standalone                        |
| 8   | Credit Score Gauge    | gallery-feature | 1:1      | P3   | fold → Stock dashboard (widget)   |

### Healthcare & Life Sciences

| #   | Demo                   | Tier            | Topology | Prio | Disposition                                    |
| --- | ---------------------- | --------------- | -------- | ---- | ---------------------------------------------- |
| 9   | Patient Profile Header | gallery-feature | 1:1      | P3   | standalone (chrome)                            |
| 10  | Appointment Scheduler  | gallery-feature | 1:1      | P3   | standalone                                     |
| 11  | **Vitals Monitor**     | gallery-feature | 1:many   | P2   | **standalone** (live-feed cousin of Heartbeat) |
| 12  | Prescription History   | gallery-feature | 1:1      | P3   | standalone                                     |
| 13  | Radiology Image Viewer | gallery-feature | 1:1      | P3   | standalone (specialized viewer)                |
| 14  | Lab Results Timeline   | gallery-feature | 1:1      | P3   | standalone                                     |
| 15  | Symptom Checker        | gallery-feature | 1:1      | P3   | standalone (wizard)                            |

### Retail & E-Commerce

| #   | Demo                            | Tier            | Topology  | Prio | Disposition                              |
| --- | ------------------------------- | --------------- | --------- | ---- | ---------------------------------------- |
| 16  | **Smart Shopping Cart**         | gallery-feature | 1:many    | P2   | **standalone** (persistent sidebar host) |
| 17  | Product Recommendation Carousel | gallery-feature | 1:1       | P3   | standalone                               |
| 18  | Order Tracker                   | gallery-feature | 1:1       | P3   | standalone (timeline)                    |
| 19  | Customer Review Thread          | pattern         | many:many | P3   | standalone (threaded)                    |
| 20  | Inventory Asset Manager         | gallery-feature | 1:1       | P3   | standalone (back-office tool)            |
| 21  | Price Comparison Widget         | gallery-feature | 1:1       | P3   | standalone                               |
| 22  | Wishlist Manager                | gallery-feature | 1:1       | P3   | standalone                               |
| 23  | Return Request Portal           | gallery-feature | 1:1       | P3   | standalone (wizard)                      |

### Workplace & Productivity

| #   | Demo                      | Tier            | Topology  | Prio | Disposition                                                             |
| --- | ------------------------- | --------------- | --------- | ---- | ----------------------------------------------------------------------- |
| 24  | Task Kanban Board         | spectacle       | 1:1       | P2   | fold → Default event/error on drag                                      |
| 25  | Shared File Browser       | gallery-feature | 1:1       | P2   | fold → File share                                                       |
| 26  | Team Attendance Summary   | gallery-feature | 1:1       | P3   | standalone                                                              |
| 27  | Internal Messaging Thread | pattern         | many:many | P2   | **promoted → §2 (chat)**                                                |
| 28  | Meeting Minute Summarizer | gallery-feature | 1:1       | P2   | fold → Voice-to-text                                                    |
| 29  | Time Tracker Widget       | gallery-feature | 1:1       | P3   | standalone                                                              |
| 30  | **Employee Directory**    | gallery-feature | 1:many    | P2   | **standalone** (named in [08](08-breadth-boundary-respecting.md) scope) |
| 31  | Poll & Survey Creator     | pattern         | many:many | P3   | standalone (live results)                                               |

### Logistics & Supply Chain

| #   | Demo                     | Tier            | Topology | Prio | Disposition                     |
| --- | ------------------------ | --------------- | -------- | ---- | ------------------------------- |
| 32  | **Fleet Map Tracker**    | gallery-feature | 1:many   | P2   | **standalone** (map + live GPS) |
| 33  | Warehouse Grid           | spectacle       | 1:1      | P3   | standalone (2D/3D viz)          |
| 34  | Incident Report Form     | gallery-feature | 1:1      | P3   | standalone                      |
| 35  | Driver Performance Chart | gallery-feature | 1:1      | P3   | fold → Stock-dashboard pattern  |
| 36  | Digital Bill of Lading   | gallery-feature | 1:1      | P3   | standalone (PDF + e-sign)       |
| 37  | Route Optimizer          | gallery-feature | 1:1      | P3   | standalone (map)                |
| 38  | Pallet Scanner           | gallery-feature | 1:1      | P3   | standalone (camera)             |

### Real Estate & Property Management

| #   | Demo                       | Tier            | Topology | Prio | Disposition            |
| --- | -------------------------- | --------------- | -------- | ---- | ---------------------- |
| 39  | Property Gallery           | spectacle       | 1:1      | P3   | standalone (lightbox)  |
| 40  | Maintenance Request Portal | gallery-feature | 1:1      | P3   | standalone             |
| 41  | Lease Document Manager     | gallery-feature | 1:1      | P3   | standalone (vault)     |
| 42  | Occupancy Analytics        | gallery-feature | 1:1      | P3   | standalone (heatmap)   |
| 43  | Neighborhood Amenity Map   | gallery-feature | 1:1      | P3   | standalone (map)       |
| 44  | Rent Payment Portal        | gallery-feature | 1:1      | P2   | fold → Payments (real) |

### Media & Entertainment

| #   | Demo                 | Tier            | Topology | Prio | Disposition                     |
| --- | -------------------- | --------------- | -------- | ---- | ------------------------------- |
| 45  | Video Player Embed   | gallery-feature | 1:1      | P3   | standalone                      |
| 46  | Podcast Episode List | gallery-feature | 1:1      | P3   | standalone                      |
| 47  | Image Editor Lite    | spectacle       | 1:1      | P3   | standalone (Colourcopia cousin) |

### Education & Training

| #   | Demo                     | Tier                | Topology  | Prio | Disposition                    |
| --- | ------------------------ | ------------------- | --------- | ---- | ------------------------------ |
| 48  | Quiz Builder             | gallery-feature     | 1:1       | P3   | standalone                     |
| 49  | Progress Dashboard       | gallery-feature     | 1:many    | P3   | standalone (dashboard)         |
| 50  | Collaborative Whiteboard | pattern / spectacle | many:many | P2   | **promoted → §2 (whiteboard)** |

**Enterprise tally** — 50 items: 2 promoted to §2, 9 folded into core/§2 demos, 4 standout P2 standalones, 35 P3 long-tail standalones. None lost; the long tail is reachable through the generator whenever breadth is wanted, but the portfolio does not depend on it.

---

## 4. Reconciliation & dedupe notes

Standing decisions that keep the three historical sources from re-diverging:

- **Chess collapses to one.** The `chess` placeholder, the "Chess game" headline, and the "Framework chess" headline are **one demo — Framework chess** (§1 #7): two framework-distinct features playing each other through a host. The cross-framework angle is what makes it a _pattern_ proof rather than just a game.
- **Clock is one demo.** Every clock idea across the sources is the shipped Demo 1; no second clock demo enters the backlog.
- **Stock dashboard absorbs the finance widgets.** #1 Ledger, #2 Portfolio, #6 Currency, #8 Credit gauge (and #35 Driver chart) become **widget-features inside** the dashboard host rather than standalone demos — that's what makes it a 1:many composition instead of four 1:1 widgets.
- **Payments ≡ Rent Payment Portal (#44)** + the "Payments" headline; one **real-backend** demo. Currency Converter (#6) rides along as a widget.
- **Voice-to-text absorbs Meeting Minute Summarizer (#28)** — both are audio → text inside an isolated feature.
- **Drag demo absorbs the drag mechanics** — #24 Kanban and #4 KYC uploader are drag surfaces; the demo's _point_ is cross-boundary drag with default event/error handling, not the domain.
- **File share absorbs #25 Shared File Browser and #4 KYC** — the shared capability is binary/large-payload transfer across the boundary.
- **Events is subsumed, its slot repurposed.** The original `events` idea (pub/sub "event logger") proves nothing distinct: message flow is _visible in every demo_. Its slot is repurposed to the **Russian-doll / nested** demo (§1 #6); the gallery manifest teaser now reflects this.
- **Views is the presentation-model showcase.** One feature across all four display modes (§1 #5) — the earlier "framework-agnostic dynamic 1:many host" concept is retired in its favor.
- **Many:many candidates** were scattered across source C: #27 Messaging → promoted to `chat`; #50 Whiteboard → promoted to `whiteboard`; #19 Reviews, #31 Polls remain P3.
- **Heartbeat stays distinct** — connection health / reconnection is its own capability; never folded.

---

## 5. Placeholder slot disposition

Four on-disk reservations remain, each a single `demo-<name>` app (`@hyperfrontend/demo-<name>`, no source). The composition model is settled: **feature-only demos are hosted by the docs-site gallery** (a slot stays a single self-contained feature app); demos whose point requires their own host grow host sub-apps under the slot directory. New slots are scaffolded by the generator ([06](06-demo-2-and-generator.md)) — except `koi-pond`, which [15](15-koi-pond.md) builds by hand.

| Slot         | Was                      | Disposition     | Becomes                                                                      |
| ------------ | ------------------------ | --------------- | ---------------------------------------------------------------------------- |
| `views`      | Views (Vanilla)          | **Repurpose**   | Presentation-model showcase — four display modes (§1 #5)                     |
| `chess`      | Chess (React)            | **Repurpose**   | Framework chess — cross-framework pattern (§1 #7)                            |
| `events`     | Events (Svelte, pub/sub) | **Repurpose**   | Russian-doll / nested (§1 #6) — original identity subsumed (§4)              |
| `file-share` | File Share (Angular)     | **Keep, defer** | Binary-transfer gallery-feature (§2); Angular deferred off the start palette |

New slots the core/§2 introduce: `stock`, `auth`, `nested` (re-uses `events`), `koi-pond`, `colourcopia`, `flagship`, `payments`, `bounty`, `terminal`, `voice`, `json-fixer`, `drag`, `chat`, `whiteboard`. All created under the host+hostee model — never as bare single-app placeholders.

---

## 6. Build order (locked)

1. **[15](15-koi-pond.md) Koi pond** — hand-built, next up; the visual-thesis flagship and the first live nesting chain.
2. **[06](06-demo-2-and-generator.md) generator** — proven by reproducing the heartbeat demo's shape; unblocks cheap repeatable demos.
3. **Breadth, parallelized:** [08](08-breadth-boundary-respecting.md) (Stock, Auth, Payments, gallery-features) ∥ [09](09-breadth-pattern.md) (Russian-doll, Framework chess, chat/whiteboard) ∥ [10](10-breadth-spectacle-plugin.md) (Colourcopia, Drag, Terminal, Voice) — build the rest of P0, then P1, then P2 as budget allows.
4. **[11](11-flagship-composed-app.md) Flagship** — composes the core as its windows (Omni-bar, Navbar, Footer, Terminal become its furniture).
5. **[12](12-gallery-docs-integration.md) gallery residue** — every shipped demo registered live as it lands (invariant #3), plus the per-demo how-to guides.

The P3 long tail (§3) is reachable through the generator at any point but gates nothing.
