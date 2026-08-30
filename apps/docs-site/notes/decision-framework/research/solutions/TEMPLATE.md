# <Name>

<!-- Dossier template. One file per unit of comparison. Keep headings; delete guidance comments. -->

- Unit type: product | framework | library | platform-capability | architectural-strategy (REQ-SCOPE-04)
- Status (Aug 2026): active | maintenance | inactive | deprecated | emerging, with one-line justification
- Availability: available | available-immature | announced-planned | future-roadmap | deprecated | inactive | unavailable (REQ-AVAIL-01)
- Version / release cadence at research time (where material)
- Official links: docs, repo
- Researched: 2026-08-28

## What it is

3-6 sentences: mechanics, not marketing. What actually composes what, where, and when.

## Composition mechanics

- Composition boundary (what separates participants: JS module graph, lifecycle contract, custom element, document, HTML fragment, HTTP route, build artifact)
- Integration phase (build / deploy / runtime; can integration happen after host ships?)
- Execution model (shared JS realm? shared DOM? shared document? separate document? server-composed?)

## Findings by matrix group

<!-- Atomic, mechanically meaningful findings. Each finding: statement + value
     (Yes/No/Conditional(+condition)/NA/Unknown) + evidence ref [E#] + claim type.
     Claim types: framework-guarantee | browser-guarantee | common-pattern |
     possible-extension | officially-supported | community-convention | inference. -->

### Build-time coupling
### Runtime coupling
### Isolation and failure containment
### Framework requirements
### Ownership topology fit
### Migration requirements
### Deployment
### Contracts and communication
### UX implications
### Performance causes
### Security and trust
### SSR and delivery
### Operational model

## Editions and commercial layer

Community/OSS vs commercial editions; which capabilities attach to which edition (REQ-ENT-02).
"None" if not applicable.

## Family mapping (provisional)

Which architectural strategy families this plausibly implements; multi-family honesty
(REQ-FAM-03). Marked provisional until Phase 4.

## Ambiguities and decomposition candidates

Attributes that turned subjective and need splitting for the matrix (REQ-MATRIX-03).

## Sources

- [E1] <url> (accessed 2026-08-28) - what it supports
- [E2] ...
