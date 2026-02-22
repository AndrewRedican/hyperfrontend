# Phase 2 Continuation: Advanced API & Content Features

**Documentation Roadmap — Phase 2.5**

**Status:** ✅ Complete — All planned features implemented: TypeDoc generation, link validation, search/filter, copy-to-clipboard, and module organization display.

---

## Current Capabilities

### TypeDoc API Generation

All 16 library packages generate TypeDoc API documentation:

| Library                                 | Entry Points | API Size | Status |
| --------------------------------------- | ------------ | -------- | ------ |
| `@hyperfrontend/nexus`                  | 1            | 249 KB   | ✅     |
| `@hyperfrontend/network-protocol`       | 18           | 629 KB   | ✅     |
| `@hyperfrontend/cryptography`           | 3            | 98 KB    | ✅     |
| `@hyperfrontend/state-machine`          | 11           | 159 KB   | ✅     |
| `@hyperfrontend/logging`                | 1            | 55 KB    | ✅     |
| `@hyperfrontend/web-worker`             | 1            | 4 KB     | ✅     |
| `@hyperfrontend/data-utils`             | 1            | 264 KB   | ✅     |
| `@hyperfrontend/function-utils`         | 1            | 40 KB    | ✅     |
| `@hyperfrontend/immutable-api-utils`    | 1            | 24 KB    | ✅     |
| `@hyperfrontend/json-utils`             | 1            | 79 KB    | ✅     |
| `@hyperfrontend/list-utils`             | 1            | 64 KB    | ✅     |
| `@hyperfrontend/random-generator-utils` | 1            | 34 KB    | ✅     |
| `@hyperfrontend/string-utils`           | 2            | 52 KB    | ✅     |
| `@hyperfrontend/time-utils`             | 1            | 48 KB    | ✅     |
| `@hyperfrontend/ui-utils`               | 10           | 291 KB   | ✅     |
| `@hyperfrontend/features`               | 1            | 2 KB     | ✅     |

### Dynamic Entry Point Discovery

The [generate-docs.ts](../apps/docs-site/scripts/generate-docs.ts) script automatically discovers entry points from each library's `package.json` exports field:

```typescript
// Entry points are parsed from package.json exports:
// "./browser/channel": "./src/browser/channel/index.js"
// → Discovered as: src/browser/channel/index.ts
```

**Benefits:**

- No hardcoded entry point maintenance required
- Automatically captures new modules when added to package.json
- Ensures documentation matches the published package API

### API Reference Components

The API reference rendering system in `apps/docs-site/src/components/api-reference/`:

| Component                 | Purpose                      |
| ------------------------- | ---------------------------- |
| `index.tsx`               | Main ApiReference component  |
| `function-signature.tsx`  | Function/method display      |
| `type-definition.tsx`     | Interface/type alias display |
| `parameter-list.tsx`      | Parameters table             |
| `type-link.tsx`           | Type reference rendering     |
| `example-block.tsx`       | @example code blocks         |
| `type-utils.ts`           | Type rendering utilities     |
| `types.ts`                | TypeDoc JSON schema types    |
| `api-search-filter.tsx`   | Search and filter controls   |
| `copy-button.tsx`         | Copy-to-clipboard button     |
| `module-grouped-view.tsx` | Module-grouped API display   |

### Navigation Structure

- Collapsible Utils section in sidebar showing all 9 utility packages
- Mobile menu mirrors desktop navigation
- Individual pages for each utility package under `/docs/libraries/utils/*`

---

## Completed Work

### ✅ Link Validation

**Priority:** Medium — **Status: Complete**

Build-time link validation implemented in `scripts/validate-links.ts`:

- [x] Validate all internal markdown links during build
- [x] Report broken links as build warnings
- [x] Transform GitHub blob URLs to docs site URLs

**Usage:**

```bash
npm run validate-links
```

The script runs automatically during build and exits with error code if broken links are found.

### ✅ API Documentation Rendering Improvements

**Priority:** Medium — **Status: Complete**

Enhanced API reference display:

- [x] Add search/filter within API reference sections (`api-search-filter.tsx`)
- [x] Add "copy to clipboard" for function signatures and type definitions (`copy-button.tsx`)
- [x] Show which sub-module exports each symbol (for multi-entry-point libraries)

**New Components:**
| Component | Purpose |
|-----------|---------|
| `api-search-filter.tsx` | Search input and type filter toggles |
| `copy-button.tsx` | Reusable copy-to-clipboard button |
| `module-grouped-view.tsx` | Module-grouped API display |

### ✅ Module Organization Display

**Priority:** Low — **Status: Complete**

For libraries with multiple entry points (Network Protocol, State Machine, UI Utils), API docs now present the module structure with collapsible sections.

| Library          | Entry Points | Display Options               |
| ---------------- | ------------ | ----------------------------- |
| Network Protocol | 18           | Toggle: By Module / Flat List |
| State Machine    | 11           | Toggle: By Module / Flat List |
| UI Utils         | 10           | Toggle: By Module / Flat List |

**Features:**

- Automatic detection of multi-entry-point libraries
- Toggle between "By Module" (grouped) and "Flat List" views
- Collapsible module sections with export counts
- Export badges showing function/class/interface/type counts per module

---

## Remaining Work

### 🟡 Complex Generic Type Rendering

**Priority:** Low

Improve rendering of complex generic types with deeply nested type parameters. Current implementation handles most cases but could be enhanced for edge cases.

---

## Technical Reference

### Generate Script Usage

```bash
cd apps/docs-site
npm run generate
```

The script:

1. Reads each library's `package.json` to discover entry points
2. Runs TypeDoc to generate `api.json` for each library
3. Extracts README.md and ARCHITECTURE.md content
4. Writes output to `.generated/` directory

### Output Structure

```
apps/docs-site/.generated/
├── api/
│   ├── nexus/api.json
│   ├── network-protocol/api.json
│   ├── cryptography/api.json
│   └── ... (16 total)
├── docs/
│   ├── nexus/
│   │   ├── readme.md
│   │   └── architecture.md
│   └── ... (per library)
└── manifest.json
```

### Adding a New Library

1. Add entry to `LIBRARIES` array in [generate-docs.ts](../apps/docs-site/scripts/generate-docs.ts)
2. Create page under `src/app/docs/libraries/*/page.tsx`
3. Add to navigation in [sidebar.tsx](../apps/docs-site/src/components/sidebar.tsx)
4. Entry points are auto-discovered from the library's `package.json`

---

## Acceptance Criteria Status

| Criterion                              | Status |
| -------------------------------------- | ------ |
| Each utility package has its own page  | ✅     |
| Navigation shows all 9 utils           | ✅     |
| Package names match npm registry       | ✅     |
| All packages generate TypeDoc JSON     | ✅     |
| API reference renders on library pages | ✅     |
| Build completes without errors         | ✅     |
| Dynamic entry point discovery          | ✅     |
| Link validation during build           | ✅     |
| Module group display for multi-entry   | ✅     |
| Search/filter in API reference         | ✅     |
| Copy-to-clipboard for signatures       | ✅     |

---

## Related Documents

- [Phase 2: Content](./documentation-phase-2-content.md) — Parent phase
- [Phase 3: Discovery](./documentation-phase-3-discovery.md) — Next phase (search & cross-references)

---

_Last updated: February 22, 2026_
