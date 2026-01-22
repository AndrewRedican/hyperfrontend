# GitHub Workflows Migration - Cutover Guide

This guide covers the manual steps required to complete the migration from the legacy CI workflow to the new optimized workflows.

## Status

✅ **Completed Steps** (Phases 1-6, 8):

- Custom actions created and tested
- Security hardening implemented (Dependabot, security scanning)
- PR validation workflow created (ci-pr.yml)
- Main branch workflow created (ci-main.yml)
- Test event files and local testing documentation
- Legacy workflow renamed to ci-legacy.yml
- Documentation created for workflows, actions, and contributing

⏳ **Pending Steps** (Phase 7):

- Manual branch protection updates
- Monitoring and validation in production
- Final cutover decision

## Phase 7: Cutover Checklist

### Step 1: Enable New Workflows (Ready to Execute)

The new workflows are ready and will activate automatically when merged to `main`:

- ✅ `.github/workflows/ci-pr.yml` - PR validation with affected projects
- ✅ `.github/workflows/ci-main.yml` - Main branch comprehensive checks
- ✅ `.github/workflows/security-scan.yml` - Security scanning
- ✅ `.github/dependabot.yml` - Automated dependency updates

The legacy workflow (`ci-legacy.yml`) is renamed but still active for parallel monitoring.

### Step 2: Update Branch Protection Rules

**After merging to main**, update branch protection settings:

1. Navigate to: **Settings → Branches → Branch protection rules for `main`**

2. **Add new required status check**:
   - Check name: `CI Status Check` (from ci-pr.yml)
   - This will appear after the first PR runs the new workflow

3. **Keep existing check temporarily**:
   - Keep `ci` check enabled during parallel run period
   - Both workflows will run for 3-5 days

4. **Monitor both workflows**:
   - Compare execution times
   - Verify affected calculation reduces PR check time
   - Check for false positives/negatives

### Step 3: Parallel Run Monitoring (3-5 Days)

Monitor both workflows running in parallel:

#### Success Criteria

- ✅ New ci-pr workflow completes in < 10 minutes
- ✅ New ci-main workflow completes in < 15 minutes
- ✅ Affected calculation correctly identifies changed projects
- ✅ Cache hit rates > 50%
- ✅ No false positives (failed checks when code is correct)
- ✅ No false negatives (passed checks when code has issues)

#### Monitoring Commands

```bash
# View recent workflow runs
gh run list --workflow=ci-pr.yml --limit=20

# View specific run details
gh run view <run-id>

# Check run duration
gh run view <run-id> --log | grep "Run time"
```

#### Red Flags (Require Investigation)

- ❌ Workflows taking longer than legacy workflow
- ❌ Workflows failing inconsistently
- ❌ Affected calculation missing changed projects
- ❌ Cache not working (always cache-miss)

### Step 4: Final Cutover

**Only proceed if monitoring shows success criteria met**

1. **Remove legacy workflow requirement**:
   - Go to Settings → Branches → Branch protection rules
   - Remove `ci` check from required status checks
   - Keep only `CI Status Check` required

2. **Disable legacy workflow**:

   ```bash
   # The ci-legacy.yml file still exists but won't trigger
   # Keep it for 30 days as backup, then delete
   ```

3. **Verify new workflow is sole requirement**:
   - Open a test PR
   - Confirm only new workflows run
   - Verify PR can be merged with new checks

4. **Monitor for 48 hours post-cutover**:
   - Check all PRs are validated correctly
   - Verify no merge issues
   - Monitor for any unexpected failures

### Step 5: Cleanup (30 Days After Cutover)

After 30 days of stable operation:

1. **Delete legacy workflow**:

   ```bash
   git rm .github/workflows/ci-legacy.yml
   git commit -m "chore(ci): remove legacy workflow after successful migration"
   ```

2. **Update documentation**:
   - Remove references to legacy workflow
   - Update migration notes to show completion

3. **Archive migration documentation**:
   - Move this cutover guide to `docs/` if needed
   - Update roadmap to mark migration as complete

## Rollback Procedures

If critical issues arise during monitoring or cutover:

### Emergency Rollback

1. **Re-enable legacy workflow** (if disabled):
   - Rename `ci-legacy.yml` back to `ci.yml` if needed
   - Or restore trigger events in ci-legacy.yml

2. **Update branch protection**:
   - Add `ci` check back as required
   - Can remove `CI Status Check` if causing issues

3. **Disable new workflows temporarily**:
   - Add `if: false` to all jobs in ci-pr.yml and ci-main.yml
   - Or rename files to prevent triggering

4. **Investigate offline**:
   - Create a separate test branch
   - Fix issues and retest
   - Attempt migration again when stable

### Partial Rollback

Keep new workflows but with modifications:

1. **Disable affected calculation**:
   - Change `affected-only: 'true'` to `'false'` in ci-pr.yml
   - This makes it behave like legacy workflow

2. **Increase resources**:
   - Change `--parallel=3` to higher value if needed
   - Add more runners if timeouts occur

3. **Simplify workflows**:
   - Temporarily disable security-scan.yml
   - Remove non-critical checks

## Post-Migration Validation

After successful cutover, validate:

### Week 1 Checks

- [ ] All PRs validated correctly
- [ ] No merge blockers
- [ ] Performance metrics meet targets
- [ ] Cache working as expected
- [ ] Dependabot creating PRs weekly

### Week 2 Checks

- [ ] Security scanning running weekly
- [ ] No workflow failures on main
- [ ] Coverage reports uploading correctly
- [ ] Team comfortable with new system

### Month 1 Review

- [ ] Compare pre/post migration metrics
- [ ] Document lessons learned
- [ ] Update workflows based on feedback
- [ ] Consider Nx Cloud for further optimization

## Performance Metrics Tracking

Track these metrics pre and post migration:

| Metric             | Target  | Legacy | New | Status |
| ------------------ | ------- | ------ | --- | ------ |
| PR workflow time   | < 10min | ~15min | TBD | ⏳     |
| Main workflow time | < 15min | ~20min | TBD | ⏳     |
| Cache hit rate     | > 50%   | ~30%   | TBD | ⏳     |
| False positives    | 0       | 0      | TBD | ⏳     |
| False negatives    | 0       | 0      | ⏳  | ⏳     |

## Contact & Support

For questions or issues during cutover:

1. **Check logs**: GitHub Actions → Workflows → Select run → View logs
2. **Local testing**: Use `act` to reproduce issues locally
3. **Documentation**: Review `.github/workflows/README.md` and `.github/actions/README.md`
4. **Rollback**: Follow emergency rollback procedures if needed

## Timeline Summary

```
✅ Week 1: Custom Actions Setup (COMPLETED)
✅ Week 2: Security Hardening (COMPLETED)
✅ Week 3: PR & Main Workflows (COMPLETED)
✅ Week 4-5: Test Events & Documentation (COMPLETED)
✅ Week 5: Parallel Run Setup (COMPLETED)
⏳ Week 5+: Enable workflows, update branch protection (PENDING)
⏳ Week 6: Monitor parallel runs 3-5 days (PENDING)
⏳ Week 6: Final cutover if success criteria met (PENDING)
⏳ Week 6-10: Post-cutover monitoring (PENDING)
⏳ Month 2: Cleanup and delete legacy workflow (PENDING)
```

## Next Actions

**Immediate (Before Merge)**:

1. Review all created files
2. Test workflows locally with `act` if possible
3. Verify custom actions syntax

**After Merge to Main**:

1. Wait for first workflow run to complete
2. Verify workflows execute successfully
3. Add "CI Status Check" to required status checks
4. Begin parallel run monitoring period

**After Monitoring Period (3-5 Days)**:

1. Evaluate success criteria
2. Make cutover decision (proceed or investigate)
3. Remove legacy workflow requirement
4. Monitor for 48 hours post-cutover

**After Stable Operation (30 Days)**:

1. Delete ci-legacy.yml
2. Update documentation
3. Archive migration guides
4. Consider future optimizations (Nx Cloud)

---

**Migration prepared on**: January 22, 2026
**Estimated completion**: February 2026
**Status**: Ready for merge and monitoring phase
