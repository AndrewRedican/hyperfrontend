# Scenario Fixtures

Status: BRIEF (inputs only), 2026-08-28. Traced in Phase 8.

## Purpose

These are the REQ-TEST-01 fixtures ([MASTER.md](../MASTER.md) section 12; deliverable 11,
section 16): concrete situations that exercise the decision framework without the website.
The decision model must be testable standalone; each fixture pairs raw inputs with broad
expected-outcome guardrails so that rule, scale, or taxonomy changes that break a previously
sound trace are caught as regressions. In Phase 8, each fixture is hand-traced through the
decision model and the trace recorded in its section 4; on any
later model change, fixtures are re-traced against their guardrails.

Anatomy of a brief (all four sections, nothing else):

1. **Situation**: the raw conversational input, in the organization's own language, no MFE
   vocabulary (REQ-LLM-01 posture: this is what a user or an LLM front-end would start from).
   Frozen once written.
2. **Normalized inputs (provisional)**: the Situation translated to stable ids from
   [model/topology.md](../model/topology.md),
   [model/state-transition.md](../model/state-transition.md), and
   [model/migration.md](../model/migration.md), each marked hard-constraint or preference.
   Re-normalized when [model/constraints.md](../model/constraints.md) exists (Phase 5).
3. **Guardrail expectations**: inviolable sanity checks derived from the guidance, never a
   predicted winner; plus which REQ-TRUST-01 outcome classes the scenario may exercise.
4. **Trace**: empty until Phase 8.

## Outcome-class vocabulary (REQ-TRUST-01)

Shorthand ids used by every brief; the system must be willing to produce all seven
([MASTER.md](../MASTER.md) section 9).

| Id | Outcome |
|---|---|
| `trust.hf-community` | HyperFrontend Community is the strongest recommendation |
| `trust.other-oss` | Another open-source solution is strongest |
| `trust.commercial` | A commercial competitor is strongest |
| `trust.hfe-future` | HyperFrontend Enterprise would likely fit but is unavailable; use X today (always paired per REQ-AVAIL-02) |
| `trust.no-match` | No strong current match (first-class gap record, REQ-GAP-01) |
| `trust.no-mfe` | You probably do not need microfrontends |
| `trust.change-assumptions` | Viable only if specific stated assumptions change |

## Scenario list

| Slug | Topology id | Situation in one line | Guardrail class |
|---|---|---|---|
| [acquisition-no-rewrite](acquisition-no-rewrite.md) | `topology.acquisition` | Acquired product must appear inside the host in two quarters; its code, build, and releases cannot be touched | participant untouchable |
| [coordinated-greenfield-platform](coordinated-greenfield-platform.md) | `topology.platform-product` | Funded greenfield portal; platform group plus four product teams, independent releases chartered from day one | no migration eliminations |
| [independent-teams-different-frameworks](independent-teams-different-frameworks.md) | `topology.independent-teams` | Three products on three UI stacks with independent cadences must become one connected experience in nine months | stacks and cadences immovable |
| [legacy-angular-modernization](legacy-angular-modernization.md) | `topology.legacy-modernization` | End-of-life 400k-line app carved incrementally by a new funded team; legacy side accepts config-level change only | split appetite honored |
| [third-party-vendor-widget](third-party-vendor-widget.md) | `topology.third-party-vendor` | Vendor tool embedded in a bank portal under security audit; vendor exposes a URL or script tag and nothing else | security boundary real |
| [plugin-marketplace](plugin-marketplace.md) | `topology.plugin-ecosystem` | Coordinated product opening a reviewed add-on marketplace for unknown outside authors | hostile-input boundary; no host redeploy per add-on |
| [should-not-use-microfrontends](should-not-use-microfrontends.md) | `topology.coordinated-team` | One team, one repo, aspiration-driven interest in splitting; real pains are build time and bundle weight | non-MFE baseline expected |
| [b2b2c-embedded-product](b2b2c-embedded-product.md) | `topology.b2b-distribution` | Embeddable product distributed to hundreds of customer sites with per-load entitlements and one-snippet setup (REQ-ORG-02) | one-snippet customers; editions never pick families |

Mapping to the REQ-TEST-01 example names: `third-party-widget` is
`third-party-vendor-widget`; `independent-react-teams` is covered by
`independent-teams-different-frameworks` (the framework-diverse variant carries more
information; add a same-framework sibling later if the matrix shows the distinction changes
outcomes); `single-team-modular-monolith` is covered by `should-not-use-microfrontends`;
`b2b2c-embedded-product` is added per REQ-ORG-02.

## Fixture integrity rule (REQ-ORCH-11)

When a trace produces a recommendation that feels wrong, fix the abstraction: the scale, the
taxonomy, the rule, or the priors. Never patch a fixture with special-case logic, never add a
vendor-specific rule to make a scenario pass, and never edit a Situation to make the model
look right. Situations are frozen inputs; Normalized inputs may be re-derived as the model
evolves (and must be, at Phase 5); Guardrail expectations change only when the underlying
guidance changes. A fixture that keeps failing its guardrails is evidence about the model,
and per [model/migration.md](../model/migration.md) section 7 the fix belongs in the prior or
the scale, not in the scenario.
