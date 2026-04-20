---
name: eslint-rules
version: 1.0.0
description: Create custom ESLint rules for the hyperfrontend Nx monorepo.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Terminal
---

# ESLint Rules Skill

Create rules in `tools/eslint-rules/`. REUSE shared utilities. Follow existing patterns.

## Reference Locations

| What                | Where                               |
| ------------------- | ----------------------------------- |
| Existing rules      | `tools/eslint-rules/src/rules/*.ts` |
| Rule documentation  | `tools/eslint-rules/docs/*.md`      |
| Shared utilities    | `tools/eslint-rules/src/utils/`     |
| Test infrastructure | `tools/eslint-rules/src/testing/`   |
| Registration        | `tools/eslint-rules/src/index.ts`   |
| Config              | `eslint.base.config.cjs`            |

**Before creating a rule:** Read `tools/eslint-rules/docs/` to check for existing rules. Do not duplicate.

---

## Rule Categories

- **`lib-*`** — Publishable library enforcement (package.json, project.json, README). Guard with `isPublishableLibrary()`.
- **`no-*`** — Prohibitions (enums, unsafe patterns, async fs).
- **`prefer-*`** — Style preferences with autofixes.
- **`require-*`** — Mandate presence (node: protocol).
- **Workspace** — Cross-project validation (docs-site, root-readme).

---

## Critical Patterns

### Publishable Library Detection

A library is publishable if `project.json` has `projectType: 'library'` AND both `build` + `publish` targets.

```typescript
import { isPublishableLibrary } from '../utils/nx-project'
if (!isPublishableLibrary(dirname(context.filename))) return {}
```

### JSON Rule Cast

JSON rules require this cast for the listener return:

```typescript
return { ... } as unknown as Rule.RuleListener
```

### Doc URL

```typescript
const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${name}.md`
)
```

### Registration

In `tools/eslint-rules/src/index.ts`:

```typescript
[RULE_NAME]: rule as unknown as Rule.RuleModule
```

### File I/O

- **Use `utils/fs.ts` first** — Do not reimplement file operations
- **Sync only** — Use `readFileSync`, `writeFileSync`, `existsSync` (never async)
- **Specify mode** — `writeFileSync(path, data, { mode: 0o644 })`
- **Safe reads** — Use `readJsonFileIfExists()`, `readFileIfExists()` from utils

### String Matching

- **Avoid regex** — Use `startsWith()`, `endsWith()`, `includes()`, `split()`
- **Node builtins** — Use `NODE_BUILTIN_MODULES.has()` not regex patterns

---

## Shared Utilities — MUST REUSE

### nx-project.ts

- `isPublishableLibrary(projectRoot)` — Check if lib has build+publish targets
- `isPublishableProjectJson(json)` — Check parsed project.json
- `readProjectJson(dir)` / `readPackageJson(dir)` — Parse config files
- `findPublishableLibraryDirectories(dir)` — Find all publishable libs
- `getAllPublishableLibraries(root, subdir)` — Full metadata for all

### workspace.ts

- `findWorkspaceRoot(path)` — Monorepo root
- `findProjectRoot(path)` — Nearest project root
- `findNxWorkspaceRoot(path)` — Find nx.json location
- `findWorkspaceRootByMarker(path, marker)` — Custom root detection

### fs.ts

- `exists(path)` / `isDirectory(path)` — Path checks
- `readJsonFileIfExists(path)` / `readFileIfExists(path)` — Safe reads
- `readDirectory(path)` — List contents

### import-analysis.ts

- `getImportCategory(source)` — Returns 0-4 (NodeBuiltin→CurrentDir)
- `compareImportSources(a, b)` — Sort comparator
- `ImportCategory` enum — NodeBuiltin=0, External=1, Hyperfrontend=2, Relative=3, CurrentDir=4

### node-builtins.ts

- `NODE_BUILTIN_MODULES` — Set of all Node.js builtins
- `isNodeBuiltinWithoutPrefix(name)` — Missing node: prefix?
- `addNodePrefix(name)` — Add node: prefix

### logger.ts

- `createRuleLogger(ruleName)` — Scoped debug logger

---

## Testing — Jest + RuleTester

Tests run with **Jest**. 100% code coverage required.

### Test Naming

Use assertive language. No "should":

- ✗ `should report error when...`
- ✓ `reports error when...`
- ✓ `flags missing field`
- ✓ `allows valid import`

### RuleTester Factories

```typescript
import { createTypeScriptRuleTester, createPackageJsonRuleTester, createProjectJsonRuleTester } from '../testing'
```

### TempWorkspace (workspace-aware rules)

```typescript
import { createTempWorkspaceManager, PUBLISHABLE_LIBRARY_PROJECT_JSON } from '../testing'
const manager = createTempWorkspaceManager()
afterAll(() => manager.cleanupAll())
const ws = manager.create({ projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON, files: {...} })
// Use: { code: '...', filename: ws.getPath('package.json') }
```

### Fixtures

**project.json:** `PUBLISHABLE_LIBRARY_PROJECT_JSON`, `NON_PUBLISHABLE_LIBRARY_PROJECT_JSON`, `APPLICATION_PROJECT_JSON`, `E2E_PROJECT_JSON`

**package.json:** `PUBLISHABLE_PACKAGE_JSON`, `MINIMAL_PACKAGE_JSON`, `PACKAGE_JSON_WITH_PACKAGE_EXPORT`

**Factories:** `createPublishableProjectJson(overrides)`, `createPackageJson(overrides)`

---

## Checklist

- [ ] Export `RULE_NAME` constant
- [ ] Guard lib-\* rules with `isPublishableLibrary()`
- [ ] Use shared utilities (do not reimplement)
- [ ] Tests: assertive names, 100% coverage, TempWorkspace if workspace-aware
- [ ] Add to `index.ts` with cast
- [ ] Doc in `tools/eslint-rules/docs/{name}.md`
- [ ] Enable in `eslint.base.config.cjs`
