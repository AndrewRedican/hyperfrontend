# Docs-Site Action Plan

Comprehensive action plan addressing all identified issues on the documentation site.
Items are ordered for incremental implementation — later items build on earlier ones.

**Reference deployment:** https://docs-site-alvsmlqvr-hyperfrontend.vercel.app

---

## Table of Contents

- [Docs-Site Action Plan](#docs-site-action-plan)
  - [Table of Contents](#table-of-contents)
  - [10. Add `@module` header comments and render module descriptions](#10-add-module-header-comments-and-render-module-descriptions)
    - [A. Add `@module` comments to entry-point files](#a-add-module-comments-to-entry-point-files)
    - [B. Render module descriptions in grouped view](#b-render-module-descriptions-in-grouped-view)

---

## 10. Add `@module` header comments and render module descriptions

**Problem:** Module entry points (e.g., `libs/state-machine/src/actions/index.ts`) have no `@module` JSDoc comment, so TypeDoc generates no description for the module itself. The grouped view shows module name + import path but no summary of what the module provides.

### A. Add `@module` comments to entry-point files

**Example** `libs/state-machine/src/actions/index.ts`:

```typescript
/**
 * @module actions
 *
 * Action creators for async operation state transitions.
 * Provides start, cancel, pause, success, and fail action factories.
 */
export * from './actions'
export * as types from './actions.types'
```

Apply to all sub-module `index.ts` files across libraries with multiple entry points.

### B. Render module descriptions in grouped view

**File:** `apps/docs-site/src/components/api-reference/module-grouped-view.tsx`
**Change:** Check `module.comment?.summary` from the TypeDoc Module node and display it below the module name:

```tsx
{
  module.comment && <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{renderTextBlocks(module.comment.summary)}</p>
}
```

The `ModuleGroup` interface needs to carry the optional `comment` from the TypeDoc node.

---
