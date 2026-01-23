# GitHub Workflows - Remaining Tasks

**Status**: Phases 1-5 Complete, Monitoring and Future Phases Pending
**Current Branch**: `cicd` (PR #2 open)
**Last Updated**: January 23, 2026

---

## Phase 6: Parallel Run Migration (In Progress)

- [ ] Navigate to repository Settings → Branches → Branch protection rules
- [ ] Add `status` (from ci-pr.yml) as required status check
- [ ] Monitor workflows for 3-5 days after PR merge
- [x] Verify ci-pr workflow completes in <10 minutes
- [ ] Verify ci-main workflow completes in <15 minutes
- [ ] Check for false positives/negatives
- [ ] Verify affected calculation reduces PR checks
- [ ] Document any issues found

---

## Phase 7: Cutover (Pending)

- [ ] Update branch protection to require ONLY new `status` check
- [ ] Monitor exclusively for 48 hours
- [ ] Verify Nx affected optimization working
- [ ] Verify cache hit rates >50%
- [ ] Notify team about migration completion

---

## Phase 8: Cleanup (Pending)

- [x] Delete old/legacy workflow files (after 30 days stable)
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

- [ ] All custom actions execute successfully
- [ ] CI-PR workflow runs only affected projects
- [ ] CI-Main workflow runs all projects
- [ ] Security scanning runs weekly and on PRs
- [ ] Dependabot creates weekly PRs
- [ ] All third-party actions pinned to SHA
- [ ] Cache hit rate >50%
- [ ] Zero high/critical vulnerabilities
