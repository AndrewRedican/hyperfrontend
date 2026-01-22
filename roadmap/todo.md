# GitHub Workflows Refactoring - Implementation Steps

**Reference**: See [github-workflows-refactoring.md](github-workflows-refactoring.md) for detailed context and rationale.

**Status**: Ready for Implementation
**Timeline**: 4-6 weeks
**Last Updated**: January 22, 2026

---

## Implementation Steps

### Phase 1: Custom Actions Setup (Week 1)

1. Create directory structure `.github/actions/setup-monorepo/`
2. Create `.github/actions/setup-monorepo/action.yml` with Node.js setup, npm cache, and dependency installation
3. Add Hugo installation step to setup-monorepo action with conditional input
4. Test setup-monorepo action locally with `act --action .github/actions/setup-monorepo`
5. Create directory structure `.github/actions/nx-affected/`
6. Create `.github/actions/nx-affected/action.yml` with base-ref, head-ref, and targets inputs
7. Implement affected project calculation using `npx nx print-affected`
8. Add empty affected projects handling to nx-affected action
9. Add outputs for affected-projects (CSV), has-affected (boolean), and projects-json (JSON array)
10. Test nx-affected action locally in a feature branch with changes
11. Create directory structure `.github/actions/run-checks/`
12. Create `.github/actions/run-checks/action.yml` with check-type, affected-only, and affected-projects inputs
13. Implement format check target in run-checks action
14. Implement lint check target in run-checks action
15. Implement test check target in run-checks action
16. Implement build check target in run-checks action
17. Implement e2e check target in run-checks action
18. Add conditional logic for affected-only vs all projects in run-checks action
19. Add parallel execution with `--parallel=3` flag to run-checks action
20. Test run-checks action locally with different check types

**CHECKPOINT 1**: Test all three custom actions independently with `act` - verify they execute successfully

---

### Phase 2: Security Hardening (Week 2)

21. List all workflows in `.github/workflows/` directory
22. For each workflow, identify all `uses:` statements with third-party actions
23. Get commit SHA for `actions/checkout@v4` using `gh api repos/actions/checkout/commits/v4.1.1 --jq '.sha'`
24. Get commit SHA for `actions/setup-node@v4` using GitHub API
25. Get commit SHA for `actions/upload-artifact@v4` using GitHub API
26. Get commit SHA for `actions/download-artifact@v4` using GitHub API
27. Get commit SHA for `github/codeql-action/init@v3` using GitHub API
28. Get commit SHA for `github/codeql-action/analyze@v3` using GitHub API
29. Update all `actions/checkout` references to pinned SHA with version comment
30. Update all `actions/setup-node` references to pinned SHA with version comment
31. Update all `actions/upload-artifact` references to pinned SHA with version comment
32. Update all `actions/download-artifact` references to pinned SHA with version comment
33. Create `.github/dependabot.yml` file
34. Configure Dependabot for github-actions ecosystem with weekly schedule
35. Configure Dependabot for npm ecosystem with weekly schedule
36. Set commit-message prefix to "chore(deps)" in Dependabot config
37. Set open-pull-requests-limit to 10 for npm updates
38. Configure Dependabot to ignore major and minor version updates (security only)
39. Create `.github/workflows/security-scan.yml` file
40. Add CodeQL analysis job with `contents: read` and `security-events: write` permissions
41. Configure CodeQL for JavaScript language scanning
42. Add dependency-audit job with npm audit for high/critical vulnerabilities
43. Configure security-scan workflow to run on push to main, pull requests, and weekly schedule
44. Test security-scan workflow locally if possible

**CHECKPOINT 2**: Push security changes to a test branch, verify Dependabot PRs are created and security-scan workflow runs

---

### Phase 3: PR Validation Workflow (Week 3)

45. Create `.github/workflows/ci-pr.yml` file
46. Configure trigger for `pull_request` to `main` branch
47. Set default permissions to `contents: read` (read-only)
48. Add concurrency group `ci-pr-${{ github.ref }}` with cancel-in-progress
49. Create `setup` job that runs on ubuntu-latest
50. Add checkout step with `fetch-depth: 0` for affected calculation
51. Add setup-monorepo custom action step
52. Add nx-affected custom action step with `base-ref: origin/${{ github.base_ref }}`
53. Configure setup job outputs for affected-projects and has-affected
54. Create `format` job that depends on setup job
55. Add condition `if: needs.setup.outputs.has-affected == 'true'` to format job
56. Add checkout, setup-monorepo, and run-checks steps to format job
57. Configure run-checks for format with affected-only=true
58. Create `lint` job that depends on setup job with same pattern as format
59. Create `build` job that depends on setup job with same pattern as format
60. Create `test` job that depends on setup and build jobs
61. Add coverage upload artifact step to test job with 7-day retention
62. Create `ci-status` job that depends on all check jobs with `if: always()`
63. Add logic to ci-status to pass if no affected projects
64. Add logic to ci-status to fail if any required job failed
65. Add success message to ci-status job

**CHECKPOINT 3**: Push ci-pr.yml to test branch, open PR, verify workflow runs and affected projects are calculated correctly

---

### Phase 4: Main Branch Workflow (Week 3-4)

66. Create `.github/workflows/ci-main.yml` file
67. Configure trigger for `push` to `main` branch only
68. Set default permissions to `contents: read`
69. Add concurrency group `ci-main-${{ github.ref }}` with cancel-in-progress=false
70. Create `setup` job with checkout and setup-monorepo (install-hugo=true)
71. Create `format` job that runs format check for ALL projects (affected-only=false)
72. Create `lint` job that runs lint for ALL projects
73. Create `build` job that runs build for ALL projects
74. Create `test` job that depends on setup and build
75. Add test execution for ALL projects to test job
76. Add coverage threshold check with `npx nx run-many -t=coverage-check --all`
77. Add coverage upload artifact with 30-day retention for main branch
78. Create `e2e` job with `if: false` placeholder for future E2E tests
79. Create `ci-status` job that depends on all check jobs (except e2e)
80. Add failure detection logic to ci-status for main branch
81. Add success message to ci-status job

---

### Phase 5: Test Event Files and Local Testing (Week 4)

82. Create directory `.github/test-events/`
83. Create `.github/test-events/pr-opened.json` with sample pull request event
84. Create `.github/test-events/push-main.json` with sample push event
85. Document local testing commands in `.github/test-events/README.md`
86. Test ci-pr workflow locally with `act pull_request -W .github/workflows/ci-pr.yml`
87. Test ci-main workflow locally with `act push -W .github/workflows/ci-main.yml`
88. Test specific job locally with `act -j format`
89. Verify cache behavior in local tests (check for cache hit messages)
90. Verify affected calculation works with test PR event

**CHECKPOINT 4**: Run complete local test suite with act, verify all workflows execute successfully end-to-end

---

### Phase 6: Parallel Run Migration (Week 5, Days 1-3)

91. Backup current `.github/workflows/ci.yml` to safe location
92. Rename `.github/workflows/ci.yml` to `.github/workflows/ci-legacy.yml`
93. Commit and push ci-pr.yml and ci-main.yml workflows
94. Navigate to repository Settings → Branches → Branch protection rules
95. Add `CI Status Check` (from ci-pr.yml) as required status check
96. Keep existing CI check from ci-legacy.yml as required
97. Create test PR with small change to verify both workflows run
98. Monitor both workflows for 3-5 days, comparing execution times
99. Verify new ci-pr workflow completes in <10 minutes
100.  Verify new ci-main workflow completes in <15 minutes
101.  Check for any false positives or negatives in new workflows
102.  Verify affected calculation reduces PR checks appropriately
103.  Monitor for any workflow failures or errors
104.  Document any issues found in parallel run

---

### Phase 7: Cutover (Week 5, Days 4-5)

105. Update branch protection rules to require ONLY new `CI Status Check`
106. Remove old CI check requirement from branch protection
107. Remove trigger events from `.github/workflows/ci-legacy.yml` (keep file for reference)
108. Create test PR to verify new workflow is now the only one running
109. Monitor new workflow exclusively for 48 hours
110. Check GitHub Actions logs for any unexpected errors
111. Verify Nx affected optimization is working correctly
112. Verify cache hit rates are >50%
113. Update `CONTRIBUTING.md` with new workflow information
114. Document how to test workflows locally in CONTRIBUTING.md
115. Document the affected calculation behavior in CONTRIBUTING.md
116. Add troubleshooting section for common workflow issues
117. Notify team about workflow migration completion

**CHECKPOINT 5**: Verify new workflows are stable for 48 hours, all CI checks pass, no rollback needed

---

### Phase 8: Cleanup and Documentation (Week 6)

118. Delete `.github/workflows/ci-legacy.yml` file
119. Remove backup files if any exist
120. Update `.github/test-events/README.md` with final testing procedures
121. Create `.github/actions/README.md` documenting all custom actions
122. Document input/output contracts for each custom action
123. Add usage examples for each custom action
124. Update repository README.md with CI/CD badge for new workflows
125. Create migration summary in git commit message
126. Tag release with workflow refactoring completion

---

### Phase 9: Deployment Workflows - Documentation (Week 6-7)

127. Create `.github/workflows/deploy-docs.yml` file
128. Configure trigger for push to main and workflow_dispatch
129. Set permissions to `contents: read` and `pages: write`
130. Add setup job with checkout and setup-monorepo (install-hugo=true)
131. Add build-docs job that runs `hugo build` in docs/ directory
132. Add deploy-pages job with `actions/deploy-pages` action
133. Configure custom domain CNAME in deploy-pages job
134. Test deploy-docs workflow with workflow_dispatch trigger
135. Verify documentation site deploys successfully
136. Update CONTRIBUTING.md with docs deployment information

---

### Phase 10: Deployment Workflows - Demo Apps (Week 7-8)

137. Create `.github/workflows/deploy-demos.yml` file
138. Configure trigger for push to main affecting apps/demos/\*\* paths
139. Add setup job with checkout and setup-monorepo
140. Create build-demos job that builds all demo apps
141. Add artifact upload for built demo apps
142. **PLACEHOLDER**: Create deploy-chess-demo job (vendor/host TBD)
143. **PLACEHOLDER**: Create deploy-clock-demo job (vendor/host TBD)
144. **PLACEHOLDER**: Create deploy-events-demo job (vendor/host TBD)
145. **PLACEHOLDER**: Create deploy-file-share-demo job (vendor/host TBD)
146. **PLACEHOLDER**: Create deploy-heartbeat-demo job (vendor/host TBD)
147. **PLACEHOLDER**: Create deploy-views-demo job (vendor/host TBD)
148. Add deploy-status job to summarize all deployments
149. Test deploy-demos workflow with workflow_dispatch

---

### Phase 11: Package Publishing - Features Plugin (Week 8)

150. Create `.github/workflows/publish-features.yml` file
151. Configure trigger for push to main with changes to `plugins/features/**`
152. Add manual workflow_dispatch trigger with version input
153. Set permissions to `contents: read` and `packages: write`
154. Add version-check job to determine if version changed in package.json
155. Create build job that compiles features plugin
156. Add test job to verify plugin works before publishing
157. **PLACEHOLDER**: Create publish-npm job for @hyperfrontend/features package
158. **PLACEHOLDER**: Add npm provenance attestation to publish-npm job
159. Configure npm token secret for publishing
160. Add publish-status job to confirm successful publish
161. Test publish-features workflow with dry-run flag

---

### Phase 12: Package Publishing - Window Messages (Week 8-9)

162. Create `.github/workflows/publish-window-messages.yml` file
163. Configure trigger for push to main with changes to `packages/window-messages/**`
164. Add manual workflow_dispatch trigger with version input
165. Set permissions to `contents: read` and `packages: write`
166. Add version-check job to determine if version changed
167. Create build-npm job that compiles window-messages for npm
168. Create build-standalone job that creates browser bundle with script tags
169. Add test job to verify both npm and standalone builds
170. **PLACEHOLDER**: Create publish-npm job for @hyperfrontend/window-messages
171. **PLACEHOLDER**: Create upload-cdn job to upload standalone script to CDN
172. Configure CDN credentials secret (CDN vendor TBD)
173. Add publish-status job to confirm both publish methods succeeded
174. Test publish-window-messages workflow with dry-run flag

---

### Phase 13: Release Automation (Week 9)

175. Create `.github/workflows/release.yml` file
176. Configure trigger for push to tags matching `v*.*.*` pattern
177. Add manual workflow_dispatch trigger for manual releases
178. Set permissions to `contents: write` for creating releases
179. Add version-extraction job to parse version from tag
180. Create changelog-generation job using conventional commits
181. Add build-all job that builds all packages and apps
182. Create draft-release job with `actions/create-release`
183. Add asset upload for built artifacts to release
184. Configure release notes with changelog content
185. Test release workflow with a test tag

---

### Phase 14: Advanced Optimization - Nx Cloud Setup (Future)

186. **PLACEHOLDER**: Sign up for Nx Cloud account
187. **PLACEHOLDER**: Generate Nx Cloud access token
188. **PLACEHOLDER**: Add `NX_CLOUD_ACCESS_TOKEN` to repository secrets
189. **PLACEHOLDER**: Update `nx.json` with Nx Cloud configuration
190. **PLACEHOLDER**: Enable remote caching in Nx Cloud dashboard
191. **PLACEHOLDER**: Enable distributed task execution
192. **PLACEHOLDER**: Test remote cache with PR workflow
193. **PLACEHOLDER**: Monitor cache hit rates in Nx Cloud dashboard
194. **PLACEHOLDER**: Configure cache retention policies
195. **PLACEHOLDER**: Update documentation with Nx Cloud setup

---

### Phase 15: Monitoring and Maintenance

196. Set up workflow failure notifications in repository settings
197. Configure workflow run retention policy (keep 90 days)
198. Create monthly review task for Dependabot PRs
199. Schedule quarterly review of workflow performance metrics
200. Document workflow maintenance procedures in `.github/WORKFLOWS.md`
201. Add workflow health dashboard badge to repository README
202. Create runbook for common workflow failures
203. Set up alerts for workflow duration exceeding thresholds

---

## Validation Checklist

After completing all phases, verify:

- [ ] All custom actions execute successfully
- [ ] CI-PR workflow runs only affected projects
- [ ] CI-Main workflow runs all projects
- [ ] Security scanning runs weekly and on PRs
- [ ] Dependabot creates weekly PRs for updates
- [ ] All third-party actions pinned to commit SHA
- [ ] Documentation deployed automatically on main push
- [ ] Demo apps deployment workflows exist (even if placeholders)
- [ ] Package publishing workflows exist for features and window-messages
- [ ] Local testing with act works for all workflows
- [ ] Branch protection requires new CI status check
- [ ] Cache hit rate >50% across workflows
- [ ] PR workflows complete in <10 minutes
- [ ] Main workflows complete in <15 minutes
- [ ] Zero high/critical security vulnerabilities
- [ ] Team trained on new workflow system

---

## Rollback Procedures

If critical issues arise at any checkpoint:

1. Re-enable `.github/workflows/ci-legacy.yml` by restoring trigger events
2. Update branch protection to require old CI status check
3. Disable new workflows by removing trigger events
4. Investigate issues offline in separate branch
5. Fix and retest before attempting migration again

---

## Notes

- **NPM Publish**: Most packages are currently private. Publishing steps are placeholders until packages are ready.
- **Demo Deployments**: Vendor/host determination pending. Deployment jobs are placeholders.
- **Nx Cloud**: Optional optimization for future consideration when CI times become an issue.
- **Testing**: Use `act` for local workflow testing to catch issues before pushing.
- **Checkpoints**: Use the 5 checkpoints to validate progress and catch issues early.
