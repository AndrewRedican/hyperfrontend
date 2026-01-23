# GitHub Workflows - Remaining Tasks

**Status**: Phases 1-5 Complete, Monitoring and Future Phases Pending
**Current Branch**: `cicd` (PR #2 open)
**Last Updated**: January 23, 2026

---

## Phase 8: Cleanup (Pending)

- [ ] Update repository README.md with CI/CD badge
- [ ] Tag release with workflow refactoring completion

---

## Future Phases

### Deployment Workflows

- [ ] Test deploy-docs workflow with workflow_dispatch trigger
- [ ] Verify documentation site deploys successfully
- [ ] Create deploy-demos workflow (vendor/host TBD)
- [ ] Add deployment status badges

### Package Publishing

- [ ] Create publish-features.yml for @hyperfrontend/features
- [ ] Create publish-window-messages.yml
- [ ] Add npm provenance attestation
- [ ] Configure CDN for standalone builds

### Advanced Optimization

- [ ] Evaluate Nx Cloud for remote caching
- [ ] Monitor CI times and consider distributed execution
- [ ] Set up workflow failure notifications
- [ ] Create workflow health dashboard

---

## Validation After Merge

- [x] All custom actions execute successfully
- [x] CI-PR workflow runs only affected projects
- [x] CI-Main workflow runs all projects
- [ ] Security scanning runs weekly and on PRs
- [ ] Dependabot creates weekly PRs
- [ ] All third-party actions pinned to SHA
- [ ] Cache hit rate >50%
- [ x Zero high/critical vulnerabilities
