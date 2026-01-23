# Hyperfrontend Roadmap - Prioritized Tasks

This document contains a flat, prioritized list of atomic tasks organized by dependency order.

## Phase 1: Core CI/CD Infrastructure

### 1.1 Build & Test Foundation

- [ ] Verify all Nx build targets are configured for packages (data, cryptography, logging, state-machine, web-worker, window-messages, utils/\*)
- [ ] Verify all Nx test targets are configured with Jest for packages
- [ ] Add test targets to packages currently without them (verify each: data, cryptography, logging, etc.)
- [ ] Run full build locally: `npx nx run-many -t=build --all`
- [ ] Run full test suite locally: `npx nx run-many -t=test --all`
- [ ] Fix any failing builds or tests before proceeding

### 1.2 Code Coverage Setup

- [ ] Configure Jest coverage collection in `jest.preset.cjs` (collectCoverageFrom, coverageReporters: ['lcov', 'text', 'json-summary'])
- [ ] Add coverage thresholds to jest.preset.cjs (global: statements 80%, branches 75%, functions 80%, lines 80%)
- [ ] Update project.json for each package to include coverage options in test targets
- [ ] Run tests with coverage locally: `npx nx run-many -t=test --all --coverage`
- [ ] Verify coverage reports are generated in coverage/ directories per project

### 1.3 Monorepo Coverage Aggregation

- [ ] Research monorepo coverage solutions (nyc merge, istanbul-merge, or Codecov's monorepo support)
- [ ] Add script to merge coverage reports: `tools/scripts/merge-coverage.js`
- [ ] Test coverage merge script locally with multiple projects
- [ ] Generate aggregate coverage badge data (overall percentage)
- [ ] Document coverage aggregation approach in CONTRIBUTING.md

### 1.4 CI Workflow Coverage Integration

- [ ] Update `.github/workflows/ci-main.yml` test job to collect coverage for all projects
- [ ] Add step to merge coverage reports using merge script
- [ ] Upload merged coverage to Codecov (add CODECOV_TOKEN to repository secrets)
- [ ] Configure Codecov to understand Nx monorepo structure (codecov.yml)
- [ ] Verify coverage uploads successfully in CI run

### 1.5 Status Badges & Visibility

- [ ] Add CI status badge to README.md (ci-main workflow)
- [ ] Add CI PR check badge to README.md (ci-pr workflow)
- [ ] Add Codecov badge to README.md (overall coverage percentage)
- [ ] Add security scan badge to README.md
- [ ] Verify all badges display correctly on GitHub

### 1.6 Baseline Release

- [ ] Tag release v0.1.0 marking workflow refactoring completion
- [ ] Create release notes documenting CI/CD infrastructure
- [ ] Document current monorepo status (which projects are ready vs. empty husks)

---

## Phase 2: Package Development & Quality

### 2.1 Documentation Tooling (Future)

- [ ] Add JSDoc comments standard to CONTRIBUTING.md
- [ ] Configure ESLint plugin for JSDoc validation (eslint-plugin-jsdoc)
- [ ] Add JSDoc lint rule to eslint.base.config.cjs (require descriptions, param types)
- [ ] Add TypeDoc configuration (typedoc.json) for API documentation generation
- [ ] Add `docs:generate` script to generate TypeDoc for all packages
- [ ] Integrate TypeDoc generation into CI workflow
- [ ] Deploy generated API docs to hyperfrontend.dev/api

### 2.2 Package Completeness (Ongoing)

- [ ] Flesh out @hyperfrontend/window-messages implementation (core protocol)
- [ ] Add comprehensive tests for window-messages (80%+ coverage)
- [ ] Flesh out @hyperfrontend/features plugin implementation
- [ ] Add comprehensive tests for features plugin (80%+ coverage)
- [ ] Add README.md examples for each package
- [ ] Validate package exports and TypeScript types

---

## Phase 3: Package Publishing

### 3.1 NPM Publishing Infrastructure

- [ ] Create `.github/workflows/publish-window-messages.yml` (manual trigger + version tags)
- [ ] Add NPM_TOKEN to repository secrets for publishing
- [ ] Configure npm provenance attestation in publish workflow
- [ ] Test publish workflow with dry-run: `npm publish --dry-run`
- [ ] Publish window-messages v1.0.0-alpha.1 to npm (scoped @hyperfrontend)

### 3.2 Features Plugin Publishing

- [ ] Create `.github/workflows/publish-features.yml` (manual trigger + version tags)
- [ ] Test features plugin build: `npx nx build features`
- [ ] Verify plugin exports and Nx plugin schema
- [ ] Publish features plugin v1.0.0-alpha.1 to npm

### 3.3 Versioning & Changelog

- [ ] Configure @jscutlery/semver for automated versioning
- [ ] Add conventional commits validation to CI
- [ ] Set up automatic changelog generation
- [ ] Create CHANGELOG.md template for packages

### 3.4 CDN Distribution (Future)

- [ ] Research CDN providers for standalone builds (jsDelivr, unpkg, CloudFlare)
- [ ] Configure rollup to generate UMD bundles for CDN use
- [ ] Add CDN upload step to publish workflows
- [ ] Document CDN usage in README (script tags, versions)

---

## Phase 4: Deployment Workflows

### 4.1 Documentation Deployment

- [ ] Test deploy-docs workflow with manual workflow_dispatch trigger
- [ ] Verify Hugo site builds successfully in CI
- [ ] Verify documentation deploys to GitHub Pages (hyperfrontend.dev)
- [ ] Add deployment status badge to README.md
- [ ] Set up automatic deployment on docs changes (path filter)

### 4.2 Backend Deployment (Future)

- [ ] Choose hosting provider for backend demos (Vercel, Railway, Fly.io)
- [ ] Create `.github/workflows/deploy-backend-express.yml`
- [ ] Create `.github/workflows/deploy-backend-nest.yml`
- [ ] Configure environment variables for deployments
- [ ] Add backend deployment URLs to README.md

### 4.3 Frontend Deployment (Future)

- [ ] Choose hosting for frontend demos (Vercel, Netlify, CloudFlare Pages)
- [ ] Create `.github/workflows/deploy-frontend-react.yml`
- [ ] Create `.github/workflows/deploy-frontend-vue.yml`
- [ ] Create `.github/workflows/deploy-frontend-angular.yml`
- [ ] Add frontend demo URLs to README.md

### 4.4 Demo Applications Deployment

- [ ] Create `.github/workflows/deploy-demos.yml` (multi-target deploy)
- [ ] Deploy chess demo application
- [ ] Deploy clock demo application
- [ ] Deploy events demo application
- [ ] Deploy file-share demo application
- [ ] Deploy heartbeat demo application
- [ ] Create demos landing page on hyperfrontend.dev/demos

---

## Phase 5: Advanced Optimization

### 5.1 Performance & Caching

- [ ] Evaluate Nx Cloud for remote caching (free tier for open source)
- [ ] Set up Nx Cloud workspace
- [ ] Configure Nx Cloud access token in CI
- [ ] Monitor CI time improvements with remote caching
- [ ] Document cache hit rates and performance gains

### 5.2 Distributed Task Execution

- [ ] Evaluate Nx distributed task execution (DTE) for large builds
- [ ] Configure DTE agents for parallel job execution
- [ ] Benchmark CI time with/without DTE
- [ ] Optimize agent allocation based on project graph

### 5.3 Monitoring & Notifications

- [ ] Set up workflow failure notifications (GitHub Actions, Discord, Slack)
- [ ] Create workflow health dashboard (track success rates, durations)
- [ ] Add workflow timing metrics collection
- [ ] Set up alerts for consistently failing workflows
- [ ] Document monitoring setup in docs/MAINTENANCE.md

---

## Notes

### Monorepo Code Coverage Strategy

For aggregating code coverage across the monorepo, consider these approaches:

1. **Codecov with Monorepo Flags**: Upload individual project coverage with flags, let Codecov aggregate
2. **NYC Merge**: Use `nyc merge` to combine Istanbul/lcov reports into a single report
3. **Custom Script**: Write Node.js script to parse json-summary reports and compute weighted average
4. **Nx Coverage Plugin**: Explore community plugins for Nx coverage aggregation

Recommended: Use Codecov with per-project flags for visibility, plus a custom script for README badge generation.

### Priority Dependencies

- Phase 1 must complete before Phase 3 (publishing requires working builds/tests)
- Phase 2.2 should complete before Phase 3 (don't publish empty packages)
- Phase 4 can begin after Phase 1 (deployments need CI but not publishing)
- Phase 5 can begin anytime but provides most value as codebase grows
