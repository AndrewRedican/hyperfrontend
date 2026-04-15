# Demo & Application Implementation Plan

Comprehensive plan for implementing hyperfrontend demo applications and managing the hybrid monorepo application architecture.

---

## Overview

The `apps/` directory contains multiple sub-domains organized by application type:

- `apps/demos/` — Educational showcase applications
- `apps/frontend/` — Frontend framework reference implementations
- `apps/backend/` — Backend server implementations

Each sub-domain is further organized by **framework category**, where multiple applications can exist under each framework. This structure demonstrates hyperfrontend's framework-agnostic capabilities across the ecosystem.

### Purpose of Demo Applications

1. **Showcase examples** — Demonstrate the hyperfrontend architecture with real working code
2. **Framework diversity proof** — Each demo uses a different framework to prove framework-agnostic claims
3. **Communication pattern illustrations** — Show different messaging patterns and use cases
4. **Educational resources** — Linked from documentation to help developers learn
5. **Live deployments** — Hosted at `hyperfrontend.dev/demo/*` for immediate exploration

---

## Application Directory Structure

### Supported Frameworks

The framework directories serve as organizational categories. Multiple applications can exist under each:

```
apps/
├── demos/                    # Educational showcase apps
│   ├── {demo-name}/          # Individual demo apps (framework-agnostic at this level)
│   └── shared/               # Shared demo infrastructure
├── frontend/                 # Frontend framework categories
│   ├── angular/              # Angular apps
│   ├── javascript/           # Vanilla JS apps
│   ├── react/                # React apps
│   ├── svelte/               # Svelte apps
│   ├── vue/                  # Vue apps
│   ├── solid/                # (Planned) Solid.js apps
│   ├── preact/               # (Planned) Preact apps
│   ├── qwik/                 # (Planned) Qwik apps
│   ├── lit/                  # (Planned) Lit/Web Components apps
│   ├── htmx/                 # (Planned) HTMX apps
│   ├── alpine/               # (Planned) Alpine.js apps
│   ├── ember/                # (Planned) Ember.js apps
│   └── backbone/             # (Planned) Backbone.js apps (legacy support)
└── backend/                  # Backend framework categories
    ├── express/              # Express.js apps
    ├── http/                 # Node HTTP apps
    ├── nest/                 # NestJS apps
    ├── fastify/              # (Planned) Fastify apps
    ├── hono/                 # (Planned) Hono apps
    └── koa/                  # (Planned) Koa apps
```

> **Note:** Framework directories are sub-domains of `apps/`. Each can contain multiple independent applications, not just one.

---

## Current Demo State

| Demo       | Framework (Planned)  | Status            | Files Present                                   |
| ---------- | -------------------- | ----------------- | ----------------------------------------------- |
| Chess      | React                | Empty placeholder | .gitkeep, README.md, package.json, project.json |
| Clock      | Vue                  | Empty placeholder | .gitkeep, README.md, package.json, project.json |
| Events     | Svelte               | Empty placeholder | .gitkeep, README.md, package.json, project.json |
| File Share | Angular              | Empty placeholder | .gitkeep, README.md, package.json, project.json |
| Heartbeat  | React                | Empty placeholder | .gitkeep, README.md, package.json, project.json |
| Views      | JavaScript (vanilla) | Empty placeholder | .gitkeep, README.md, package.json, project.json |

---

## Demo Ideas: 50 Enterprise Use Cases

The following list provides inspiration for practical micro-frontend implementations. Each idea represents a realistic UI composition pattern found in enterprise applications. Use these to imagine how hyperfrontend could integrate with your own projects.

> **First Step:** Scaffold placeholder directories with `.gitkeep` files for any demos you plan to implement. This establishes structure early and makes progress visible.

### Finance & Banking

| #   | Demo Name                 | Description                                                                                         |
| --- | ------------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | **Transaction Ledger**    | A high-performance grid for viewing and filtering historical transactions.                          |
| 2   | **Portfolio Visualizer**  | Interactive donut and line charts showing asset allocation and growth over time.                    |
| 3   | **Loan Calculator**       | A standalone widget with sliders for principal, rate, and term showing monthly repayment estimates. |
| 4   | **KYC Document Uploader** | A secure drag-and-drop zone for identity verification documents with status tracking.               |
| 5   | **Fraud Alert Summary**   | A real-time notification feed showing suspicious activity flags and investigation status.           |
| 6   | **Currency Converter**    | Live exchange rate display with conversion calculator and historical rate charts.                   |
| 7   | **Budget Planner**        | Category-based expense tracker with spending limits and visual progress indicators.                 |
| 8   | **Credit Score Gauge**    | A gauge visualization showing credit score with factor breakdowns and improvement tips.             |

### Healthcare & Life Sciences

| #   | Demo Name                  | Description                                                                                            |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------------ |
| 9   | **Patient Profile Header** | A summary bar showing critical stats (blood type, allergies) and emergency contact info.               |
| 10  | **Appointment Scheduler**  | A calendar interface for booking and managing medical consultations with availability slots.           |
| 11  | **Vitals Monitor**         | A real-time dashboard displaying live feeds from wearable devices (heart rate, SpO2, temperature).     |
| 12  | **Prescription History**   | A searchable table of past medications with dosage info and "request refill" interactions.             |
| 13  | **Radiology Image Viewer** | A specialized component for viewing and annotating high-resolution medical scans (DICOM format).       |
| 14  | **Lab Results Timeline**   | Chronological view of test results with trend graphs and reference range indicators.                   |
| 15  | **Symptom Checker**        | An interactive questionnaire that guides users through symptom assessment with triage recommendations. |

### Retail & E-Commerce

| #   | Demo Name                           | Description                                                                                           |
| --- | ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 16  | **Smart Shopping Cart**             | A persistent sidebar managing items, quantities, price calculations, and saved-for-later.             |
| 17  | **Product Recommendation Carousel** | A "frequently bought together" carousel based on browsing history and purchase patterns.              |
| 18  | **Order Tracker**                   | A visual timeline showing package status from warehouse to doorstep with delivery estimates.          |
| 19  | **Customer Review Thread**          | A threaded comment system for product feedback with upvote capabilities and verified purchase badges. |
| 20  | **Inventory Asset Manager**         | A backend tool for staff to upload product photos, edit metadata, and manage stock levels.            |
| 21  | **Price Comparison Widget**         | Side-by-side product comparison with feature matrices and price history charts.                       |
| 22  | **Wishlist Manager**                | Shareable wishlist with price drop notifications and availability alerts.                             |
| 23  | **Return Request Portal**           | Step-by-step return initiation with reason selection, shipping label generation, and refund tracking. |

### Workplace & Productivity

| #   | Demo Name                     | Description                                                                                  |
| --- | ----------------------------- | -------------------------------------------------------------------------------------------- |
| 24  | **Task Kanban Board**         | A drag-and-drop board for managing project workflows with columns, labels, and assignees.    |
| 25  | **Shared File Browser**       | A directory-style app for uploading, downloading, and versioning documents with permissions. |
| 26  | **Team Attendance Summary**   | A grid showing "In/Out" status, scheduled leave, and working hours for team members.         |
| 27  | **Internal Messaging Thread** | A real-time chat window for cross-departmental communication with threading and reactions.   |
| 28  | **Meeting Minute Summarizer** | An AI-integrated text area that generates summaries from uploaded audio or video files.      |
| 29  | **Time Tracker Widget**       | Start/stop timer with project tagging, daily logs, and exportable timesheets.                |
| 30  | **Employee Directory**        | Searchable org chart with profile cards, reporting structure, and contact details.           |
| 31  | **Poll & Survey Creator**     | Quick poll creation with real-time results visualization and anonymous response options.     |

### Logistics & Supply Chain

| #   | Demo Name                    | Description                                                                                  |
| --- | ---------------------------- | -------------------------------------------------------------------------------------------- |
| 32  | **Fleet Map Tracker**        | A map-based interface showing live GPS positions of delivery vehicles with route history.    |
| 33  | **Warehouse Grid**           | A 2D/3D visualization of shelf occupancy, stock levels, and slot assignments.                |
| 34  | **Incident Report Form**     | A quick-entry form with image upload for reporting damaged shipments or safety issues.       |
| 35  | **Driver Performance Chart** | Bar charts comparing delivery times, fuel efficiency, and customer ratings across the fleet. |
| 36  | **Digital Bill of Lading**   | A PDF generator and viewer for shipping documentation with e-signature support.              |
| 37  | **Route Optimizer**          | Interactive map for planning multi-stop delivery routes with time and distance estimates.    |
| 38  | **Pallet Scanner**           | Camera-integrated barcode/QR scanner for rapid inventory check-in and tracking.              |

### Real Estate & Property Management

| #   | Demo Name                      | Description                                                                                 |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------- |
| 39  | **Property Gallery**           | A high-end image carousel with virtual tour integration and fullscreen lightbox.            |
| 40  | **Maintenance Request Portal** | A user interface for tenants to post issues, attach photos, and track technician visits.    |
| 41  | **Lease Document Manager**     | A specialized vault for signing, storing, and versioning legal contracts with audit trails. |
| 42  | **Occupancy Analytics**        | Heatmaps showing building usage patterns and vacancy trends over time.                      |
| 43  | **Neighborhood Amenity Map**   | An interactive map highlighting local schools, parks, transport, and points of interest.    |
| 44  | **Rent Payment Portal**        | Secure payment interface with autopay setup, payment history, and receipt downloads.        |

### Media & Entertainment

| #   | Demo Name                | Description                                                                               |
| --- | ------------------------ | ----------------------------------------------------------------------------------------- |
| 45  | **Video Player Embed**   | Customizable video player with chapters, playback speed, quality selection, and captions. |
| 46  | **Podcast Episode List** | Scrollable feed with play controls, progress indicators, and episode descriptions.        |
| 47  | **Image Editor Lite**    | Basic crop, rotate, filter, and annotation tools for quick image manipulation.            |

### Education & Training

| #   | Demo Name                    | Description                                                                                  |
| --- | ---------------------------- | -------------------------------------------------------------------------------------------- |
| 48  | **Quiz Builder**             | Interactive quiz creation with multiple question types, scoring, and result explanations.    |
| 49  | **Progress Dashboard**       | Course completion tracking with skill badges, certificates, and learning path visualization. |
| 50  | **Collaborative Whiteboard** | Real-time drawing canvas with shapes, text, sticky notes, and multi-user cursors.            |

> **Note:** These demos are designed to be rapidly mockable and developed. They represent generalizable UI composition patterns that can be adapted to various enterprise contexts.

---

## Hybrid Monorepo Architecture

### Design Decision: Single Repository

After weighing the pros and cons of a separate repository for demo applications, the practical decision is to keep everything in this repository. This provides:

- **Single source of truth** — All code, libraries, and demos in one place
- **Atomic commits** — Library changes and demo updates can be committed together
- **Simplified CI/CD** — One pipeline to rule them all
- **Easier onboarding** — Contributors clone once and have everything

However, this introduces complexity around dependency management that must be carefully addressed.

### Dependency Management Strategy

This repository uses a **hybrid monorepo** model with two distinct dependency patterns:

#### Libraries (`libs/*`)

- Dependencies managed at **root `package.json`** level
- Libraries reference dependencies but don't install them locally
- Shared `node_modules/` at root for library development
- Standard NX monorepo pattern

#### Applications (`apps/*`, `demos/*`)

- **Self-contained dependency management**
- Each application maintains its **own `node_modules/`**
- Dependencies managed via **project-level `package.json`**
- Must NOT import from repo libraries directly — only from npm packages
- Can consume published `@hyperfrontend/*` packages as npm dependencies

```
┌─────────────────────────────────────────────────────────────────┐
│                        ROOT package.json                         │
│    (library dependencies, dev tooling, workspace scripts)        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   libs/                          apps/                            │
│   ├── nexus/                     ├── demos/                       │
│   │   └── (uses root deps)       │   ├── clock/                   │
│   ├── cryptography/              │   │   ├── package.json  ◄──┐  │
│   │   └── (uses root deps)       │   │   └── node_modules/    │  │
│   └── ...                        │   └── chess/                │  │
│                                  │       ├── package.json  ◄──┤  │
│                                  └── frontend/                 │  │
│                                      └── react/                │  │
│                                          └── app-1/            │  │
│                                              ├── package.json ◄┘  │
│                                              └── node_modules/    │
│                                                                   │
│   ▲ Libraries share root deps     ▲ Apps have isolated deps       │
└─────────────────────────────────────────────────────────────────┘
```

### Custom Executors Required

Since NX doesn't explicitly cater for projects with self-contained dependencies (this goes against the standard NX grain), we need bespoke executors.

#### New Project: `tools/app`

Create a counterpart to `tools/package` specifically for application projects:

```
tools/
├── package/                 # Existing: library build/publish executors
│   ├── src/
│   │   └── executors/
│   └── ...
└── app/                     # NEW: application-specific executors
    ├── src/
    │   └── executors/
    │       ├── install/     # Install executor
    │       │   ├── executor.ts
    │       │   └── schema.json
    │       ├── build/       # Build executor
    │       │   ├── executor.ts
    │       │   └── schema.json
    │       └── serve/       # Serve executor (optional)
    │           ├── executor.ts
    │           └── schema.json
    ├── executors.json
    ├── package.json
    ├── project.json
    └── tsconfig.json
```

#### Install Executor

Invokes `npm install` or `npm ci` in the target application's project directory:

```typescript
// tools/app/src/executors/install/executor.ts
import { ExecutorContext } from '@nx/devkit'
import { execSync } from 'node:child_process'
import { join } from 'node:path'

export interface InstallExecutorOptions {
  ci?: boolean // Use npm ci instead of npm install
  frozen?: boolean // Use --frozen-lockfile
}

export default async function runExecutor(options: InstallExecutorOptions, context: ExecutorContext): Promise<{ success: boolean }> {
  const projectRoot = context.projectGraph.nodes[context.projectName].data.root
  const cwd = join(context.root, projectRoot)

  const command = options.ci ? 'npm ci' : 'npm install'
  const flags = options.frozen ? '--frozen-lockfile' : ''

  try {
    execSync(`${command} ${flags}`.trim(), { cwd, stdio: 'inherit' })
    return { success: true }
  } catch {
    return { success: false }
  }
}
```

#### Build Executor

Wraps framework-specific build commands, executed within the application's directory:

```typescript
// tools/app/src/executors/build/executor.ts
import { ExecutorContext } from '@nx/devkit'
import { execSync } from 'node:child_process'
import { join } from 'node:path'

export interface BuildExecutorOptions {
  command?: string // Custom build command (default: npm run build)
  outputPath?: string // Output directory
}

export default async function runExecutor(options: BuildExecutorOptions, context: ExecutorContext): Promise<{ success: boolean }> {
  const projectRoot = context.projectGraph.nodes[context.projectName].data.root
  const cwd = join(context.root, projectRoot)

  const command = options.command ?? 'npm run build'

  try {
    execSync(command, { cwd, stdio: 'inherit' })
    return { success: true }
  } catch {
    return { success: false }
  }
}
```

#### Application project.json Example

```json
{
  "name": "demo-clock",
  "projectType": "application",
  "tags": ["type:demo", "scope:standalone"],
  "targets": {
    "install": {
      "executor": "tools/app:install",
      "options": {}
    },
    "build": {
      "executor": "tools/app:build",
      "dependsOn": ["install"],
      "options": {
        "command": "npm run build"
      }
    },
    "serve": {
      "executor": "tools/app:serve",
      "dependsOn": ["install"],
      "options": {
        "command": "npm run dev"
      }
    }
  }
}
```

### Summary: Key Architecture Principles

1. **Libraries** (`libs/*`) — Share root `node_modules`, managed at root `package.json`
2. **Applications** (`apps/*`) — Self-contained with own `node_modules` and `package.json`
3. **No cross-imports** — Apps cannot import from workspace libs; only npm packages
4. **Custom executors** — `tools/app` provides `install`, `build`, `serve` for app projects
5. **Module boundaries** — ESLint enforces isolation via NX tags and rules

---

## Demo Specifications

### Clock Demo (Vue)

**Purpose:** Introduce basic embedding and lifecycle management.

**Features:**

- Analog and digital clock display
- Time zone synchronization with host application
- Simple event handling (start, stop, reset)
- Theme switching via host commands

**Key Learnings:**

- Basic `@hyperfrontend/nexus` channel setup
- Lifecycle events (`open`, `close`)
- Simple message patterns (host → feature)
- Contract definition basics

**Complexity:** Low

---

### Heartbeat Demo (React)

**Purpose:** Demonstrate connection health monitoring and auto-reconnection.

**Features:**

- Real-time ping/pong with visual indicators
- Latency measurement and display
- Connection status reporting
- Automatic reconnection logic
- Configurable heartbeat intervals

**Key Learnings:**

- Connection health patterns
- State machine integration
- Handling disconnections gracefully
- Periodic messaging

**Complexity:** Low-Medium

---

### Events Demo (Svelte)

**Purpose:** Showcase event-driven architecture and pub/sub patterns.

**Features:**

- Event logger showing message flow in real-time
- Custom event publishing from both host and feature
- Event filtering and categorization
- Subscription management UI
- Event replay capability

**Key Learnings:**

- Publishing custom events
- Subscribing to event streams
- Decoupled communication patterns
- Event-driven state updates

**Complexity:** Medium

---

### Views Demo (JavaScript/Vanilla)

**Purpose:** Prove framework-agnostic claims with pure JavaScript implementation.

**Features:**

- Tab-based view switcher
- State persistence across view changes
- Dynamic feature loading and unloading
- View history navigation
- Deep linking support

**Key Learnings:**

- Vanilla JavaScript integration (no framework)
- Multiple view management
- State persistence patterns
- Dynamic loading/unloading

**Complexity:** Medium

---

### Chess Demo (React)

**Purpose:** Showcase complex state synchronization and two-way communication.

**Features:**

- Fully playable chess game
- Move validation and game rules
- Host-controlled features (undo, reset, hints)
- Game state synchronization
- Move history broadcast
- Spectator mode (host observes feature state)

**Key Learnings:**

- Complex bidirectional state sync
- Real-time updates with validation
- Feature-to-host state reporting
- Contract schemas for complex data

**Complexity:** High

---

### File Share Demo (Angular)

**Purpose:** Demonstrate binary data transfer and security policies.

**Features:**

- File upload from host to feature
- File download from feature to host
- Progress indicators for transfers
- File type validation
- Size limit enforcement
- Drag-and-drop support

**Key Learnings:**

- Binary data transfer between frames
- Security policies and CORS handling
- Progress reporting patterns
- Error handling for large payloads

**Complexity:** High

---

## Implementation Phases

> **Getting Started:** The first order of business is to scaffold placeholder directories with `.gitkeep` files for planned demos and framework categories. This establishes the project structure early, makes intentions visible, and provides a foundation for incremental development.

### Phase 0: Tooling Infrastructure

| Task                                   | Description                                       | Deliverables                 |
| -------------------------------------- | ------------------------------------------------- | ---------------------------- |
| **0.1** Create `tools/app` project     | NX plugin for application executors               | `tools/app/` directory       |
| **0.2** Implement install executor     | `npm install` / `npm ci` in project directory     | `tools/app:install` executor |
| **0.3** Implement build executor       | Framework-agnostic build wrapper                  | `tools/app:build` executor   |
| **0.4** Implement serve executor       | Development server wrapper                        | `tools/app:serve` executor   |
| **0.5** Configure NX module boundaries | ESLint rules enforcing hybrid architecture        | Updated `eslint.config.cjs`  |
| **0.6** Tag existing projects          | Apply `type:*` and `scope:*` tags to all projects | Updated `project.json` files |

---

### Phase 1: Foundation & Architecture

| Task                                      | Description                                 | Deliverables                   |
| ----------------------------------------- | ------------------------------------------- | ------------------------------ |
| **1.1** Define demo specifications        | Document detailed requirements per demo     | This document ✓                |
| **1.2** Create shared demo infrastructure | Common styles, layouts, host shell template | `apps/demos/shared/` directory |
| **1.3** Set up build/deploy targets       | Nx targets using `tools/app` executors      | Updated `project.json` files   |
| **1.4** Create Vercel configuration       | Multi-project deployment setup              | `vercel.json` per demo         |
| **1.5** Establish demo conventions        | Naming, file structure, code style          | Convention documentation       |
| **1.6** Bootstrap framework directories   | Create planned framework category folders   | Placeholder directories        |

**Prerequisites:** Phase 0 complete

---

### Phase 2: Individual Demo Implementation

Implementation order is based on complexity (simple → complex) to establish patterns early:

| Order | Demo       | Framework  | Dependencies         |
| ----- | ---------- | ---------- | -------------------- |
| 1     | Clock      | Vue        | Phase 0 & 1 complete |
| 2     | Heartbeat  | React      | Phase 0 & 1 complete |
| 3     | Events     | Svelte     | Patterns from #1-2   |
| 4     | Views      | JavaScript | Patterns from #1-3   |
| 5     | Chess      | React      | Patterns from #1-4   |
| 6     | File Share | Angular    | Patterns from #1-5   |

**Important:** Each demo must:

- Have its own `package.json` with all dependencies listed
- Maintain its own `node_modules/` (via `nx run demo-{name}:install`)
- NOT import from workspace `libs/*` — only npm packages
- Consume `@hyperfrontend/*` packages as published npm dependencies

---

### Phase 3: Documentation & Testing

| Task                                | Description                                            | Deliverables                         |
| ----------------------------------- | ------------------------------------------------------ | ------------------------------------ |
| **3.1** Write per-demo README files | Setup instructions, architecture, what it demonstrates | Rich README.md per demo              |
| **3.2** Add inline code comments    | Educational annotations throughout codebase            | Commented source files               |
| **3.3** Create E2E tests            | Playwright tests per demo                              | `e2e/` directory per demo            |
| **3.4** Update docs site            | Enhance demos.md with detailed explanations            | Updated `docs/content/docs/demos.md` |
| **3.5** Add architecture diagrams   | Mermaid diagrams showing message flow                  | Diagrams in READMEs                  |

---

### Phase 4: Deployment

| Task                              | Description                             | Deliverables                         |
| --------------------------------- | --------------------------------------- | ------------------------------------ |
| **4.1** Configure Vercel projects | One project per demo                    | Vercel dashboard configured          |
| **4.2** Set up CI/CD              | GitHub Actions for automatic deployment | `.github/workflows/deploy-demos.yml` |
| **4.3** Add preview links to PRs  | PR comments with preview URLs           | Workflow integration                 |
| **4.4** Configure production URLs | `https://hyperfrontend.dev/demo/{name}` | DNS/routing configured               |
| **4.5** Add demo status badges    | Build/deploy status per demo            | Badges in READMEs                    |

---

## Technical Architecture

### Directory Structure Per Demo

Each demo is a **self-contained application** with its own dependencies:

```
apps/demos/{demo-name}/
├── src/
│   ├── index.html           # Entry point
│   ├── main.{ts|js}         # Bootstrap code
│   ├── feature/             # The micro-frontend feature
│   │   ├── contract.ts      # @hyperfrontend/nexus contract definition
│   │   ├── App.{tsx|vue|svelte|ts}  # Main component
│   │   └── ...              # Framework-specific files
│   └── host/                # Host shell for standalone preview
│       ├── index.html       # Host entry point
│       └── main.ts          # Host bootstrap
├── e2e/                     # E2E tests
│   └── demo.spec.ts
├── node_modules/            # ← Self-contained dependencies
├── project.json             # Nx project config with tools/app executors
├── package.json             # ← Own dependencies (including @hyperfrontend/*)
├── package-lock.json        # ← Lockfile for reproducible installs
├── README.md                # Rich documentation
├── vite.config.ts           # Build configuration (Vite preferred)
├── tsconfig.json            # TypeScript config
└── vercel.json              # Deployment config
```

### Framework Application Structure

Applications under `apps/frontend/{framework}/` follow a similar pattern:

```
apps/frontend/{framework}/{app-name}/
├── src/                     # Application source
├── node_modules/            # Self-contained dependencies
├── project.json             # tags: ["type:app", "scope:standalone"]
├── package.json             # Own dependencies
├── package-lock.json
└── ...                      # Framework-specific config files
```

### Shared Infrastructure

```
apps/demos/shared/
├── styles/
│   ├── base.css             # Common styles
│   └── themes/              # Light/dark themes
├── components/
│   └── host-shell.ts        # Reusable host shell
├── utils/
│   ├── demo-utils.ts        # Common utilities
│   └── contract-helpers.ts  # Contract creation helpers
└── assets/
    └── ...                  # Shared images, icons
```

### Contract Pattern

Each demo defines a contract specifying its communication interface:

```typescript
// Example: Clock demo contract
import type { IChannelContract } from '@hyperfrontend/nexus'

export const clockContract: IChannelContract = {
  emitted: [
    {
      type: 'TICK',
      schema: {
        /* time data schema */
      },
    },
    { type: 'ALARM_TRIGGERED' },
  ],
  accepted: [
    {
      type: 'SET_TIMEZONE',
      schema: {
        /* timezone schema */
      },
    },
    { type: 'START' },
    { type: 'STOP' },
    {
      type: 'SET_THEME',
      schema: {
        /* theme schema */
      },
    },
  ],
}
```

---

## Reference Resources

| Resource              | Location                                      | Use                                 |
| --------------------- | --------------------------------------------- | ----------------------------------- |
| Legacy pattern        | `_/legacy-shell-application-pattern/`         | Real-world implementation reference |
| Analog clock package  | `_/commercial-develop/packages/analog-clock/` | Potential clock component source    |
| Nexus library         | `libs/nexus/`                                 | Core communication API              |
| Features plugin       | `plugins/features/`                           | Shell generation automation         |
| Network protocol      | `libs/network-protocol/`                      | Security layer reference            |
| Package tooling       | `tools/package/`                              | Pattern for `tools/app` executors   |
| App tooling (planned) | `tools/app/`                                  | Application-specific executors      |

---

## Success Criteria

### Tooling Requirements (Phase 0)

- [ ] `tools/app` project created with install, build, serve executors
- [ ] NX module boundary rules configured and enforced
- [ ] All projects tagged with appropriate `type:*` and `scope:*` tags
- [ ] Applications prohibited from importing workspace libraries via ESLint

### Functional Requirements

- [ ] All 6 demos fully functional and deployable
- [ ] Each demo uses its designated framework
- [ ] Demos work standalone AND embedded in documentation
- [ ] All demos communicate via `@hyperfrontend/nexus` (npm package)
- [ ] Contracts are properly defined and validated
- [ ] Each demo has its own `node_modules/` managed independently

### Documentation Requirements

- [ ] README per demo explains what it demonstrates
- [ ] Inline code comments for educational value
- [ ] Architecture diagrams showing message flow
- [ ] Setup instructions for local development

### Deployment Requirements

- [ ] Live at `hyperfrontend.dev/demo/{name}`
- [ ] Links from documentation work correctly
- [ ] CI/CD pipeline deploys on merge to main
- [ ] Preview deployments for PRs

### Quality Requirements

- [ ] E2E tests pass for all demos
- [ ] No console errors in production builds
- [ ] Mobile-responsive layouts
- [ ] < 2 second load time per demo

---

## Risk Mitigation

| Risk                                 | Mitigation                                                       |
| ------------------------------------ | ---------------------------------------------------------------- |
| Framework version conflicts          | Each app is isolated with its own node_modules                   |
| Complex Angular setup                | Start with simpler frameworks; tackle Angular last               |
| Binary transfer challenges           | Research postMessage limitations early in Phase 1                |
| Vercel multi-project complexity      | Create deployment prototype before full implementation           |
| Self-contained deps against NX grain | Custom `tools/app` executors handle project-level npm operations |
| Accidental workspace lib imports     | NX module boundary rules enforce strict isolation                |
| Dependency drift between apps        | Document version policies; consider renovate bot per-app         |
| CI complexity with multiple deps     | Cache node_modules per-project; parallelize install steps        |

---

## Related Documentation

- [Documentation Roadmap](./docs-site-action-plan.md) — Where demos fit in the larger plan

---

## Revision History

| Date       | Author | Changes                                                              |
| ---------- | ------ | -------------------------------------------------------------------- |
| 2026-02-15 | —      | Initial plan created                                                 |
| 2026-02-15 | —      | Major revision: hybrid monorepo architecture, dependency management, |
|            |        | NX module boundaries, custom executors (Phase 0), expanded framework |
|            |        | directory structure, and application isolation requirements          |
| 2026-02-15 | —      | Added 50 enterprise use case demo ideas across 8 industry categories |
|            |        | Removed timeframe estimates; added scaffolding guidance              |
