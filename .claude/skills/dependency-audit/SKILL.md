---
name: dependency-audit
description: Audit a package.json's dependencies, devDependencies, and overrides for unused entries and remove them safely — evidence rules, implicit-consumer checklist, empirical hide-and-test, lock regeneration, per-package verification. Use when pruning deps, removing unused packages, auditing overrides, or asked whether a dependency is still needed.
---

# Dependency Audit

One package.json at a time; run every command from its directory. Root, `apps/docs-site/`, and `apps/demos/<name>/` each own a lockfile.

## Paths

| Role                 | Path                                                                      |
| -------------------- | ------------------------------------------------------------------------- |
| Lint dep rules       | `<app>/eslint.config.cjs` `@nx/dependency-checks` → `ignoredDependencies` |
| Lock-regen toolchain | `/usr/local/share/nvm/versions/node/v24.18.1/bin`                         |
| Workaround registry  | project `README.md` + findings registry (see `demo-findings` skill)       |

## Gate

Before removing any entry: positive evidence of non-use. Zero grep hits = lead, not verdict — clear the implicit-consumer table first.

## Overrides — `npm ls` decides

```bash
npm ls lodash        # "(empty)" → inert → remove
npm ls ajv --all     # nested override: live only if a path runs through the declared parent
```

**Cascades:** a dep removal can orphan an override whose only path ran through it (`ts-node` → `diff`, `gray-matter` → `js-yaml`). Re-run all overrides after any dep removal.

## Deps/devDeps — grep decides, `npm ls` does not

`npm ls` proves installation, not use (declared deps always list). Count references:

```bash
for pkg in $(jq -r '.dependencies + .devDependencies | keys[]' package.json); do
  n=$(git grep -l -F "$pkg" -- . ':!package-lock.json' ':!package.json' ':!*.tgz' ':!vendor' 2>/dev/null | wc -l)
  echo "$n $pkg"
done | sort -n
```

Inspect each low-count entry (`git grep -n -F "$pkg"`):

- Real use: source import, executor/plugin in `nx.json`/`project.json`, require in eslint/jest/vite/tailwind/postcss config, tsconfig `extends`.
- Mention ≠ use: `ignoredDependencies` entry, docs prose, spec fixture string. Zero imports + list-only mention → remove dep **and** stale list entry.

## Implicit consumers — grep finds none of these

| Consumer                  | Evidence                                                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Script bins               | scripts + `lefthook.yml`: `run-p`/`run-s` → npm-run-all2, `cl`/`cz` → @hyperfrontend/versioning, `format:write` → prettier |
| TS-config loaders         | `jest.config.ts` → `ts-node`; `eslint.config.ts` → `jiti`                                                                  |
| tsconfig `types`          | `"types": ["node", "jsdom"]` = `@types/node` + `@types/jsdom` by bare name — grep tsconfigs                                |
| Walk-up resolution        | app eslint config requires plugins it doesn't declare → root devDep is the provider                                        |
| tsconfig `extends`        | `@tsconfig/*`, `@vue/tsconfig`                                                                                             |
| Framework-implicit        | `@types/react`/`@types/react-dom` under Next; `tslib` with `importHelpers`                                                 |
| Documented workarounds    | README/findings name the dep (clock `rollup`/`tslib` exist only for `hf build`)                                            |
| Vendored `file:` tarballs | `@hyperfrontend/demo-*-shell` — **never remove**; exact name stays in `ignoredDependencies`                                |
| Editor/devcontainer       | `.devcontainer/devcontainer.json` extensions (prettier)                                                                    |

## Undecidable? Hide-and-test

```bash
mv node_modules/ts-node /tmp/ts-node-bak
npx nx test lib-json-utils --skipNxCache   # narrowest consuming target
mv /tmp/ts-node-bak node_modules/ts-node
```

Failure naming the package → keep. Clean pass → removable.

## Redundant direct declarations

Other parents in `npm ls` (deduped) → direct entry redundant; package survives its removal (`@nx/js` root, `vue-eslint-parser` clock). Keep deliberate version pins.

## After editing package.json

```bash
PATH=/usr/local/share/nvm/versions/node/v24.18.1/bin:$PATH npm install                # old npm writes broken wasm32-wasi lock entries
PATH=/usr/local/share/nvm/versions/node/v24.18.1/bin:$PATH npx -y npm@12 ci --dry-run # MUST exit 0
```

Inert-override removal = zero lock churn. Non-empty diff → not inert; stop, re-check.

## Verify

| Audited   | Commands                                                                             |
| --------- | ------------------------------------------------------------------------------------ |
| Root      | `npx nx test lib-json-utils --skipNxCache` (jest + ts-node + ts-jest)                |
| docs-site | `npx tsc --noEmit` + `npx eslint package.json` — **never `nx lint docs-site`** (OOM) |
| Vue demo  | `npm run type-check` + `npm run test:unit -- --run` + `npx eslint src/App.vue`       |

Removed a `@types/*` → type-check mandatory. Leave everything uncommitted.

## Checklist

- [ ] Overrides `npm ls`-checked, nested + post-removal cascades included
- [ ] Zero/low-count deps cleared against the implicit-consumer table
- [ ] README/findings searched before removing any zero-import dep
- [ ] Stale `ignoredDependencies` entries removed with their deps
- [ ] Lock regenerated via node 24.18.1; `npm@12 ci --dry-run` exits 0
- [ ] Sanity targets pass; nothing committed
