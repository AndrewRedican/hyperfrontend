# licenses

Opt-in third-party license collection.

`collectThirdPartyLicenses(projectRoot, workspaceRoot, externals)` scans the workspace `node_modules` for each external dependency, parses its `package.json`, locates a `LICENSE` file with case-insensitive matching, and infers the SPDX identifier — falling back to the `license` field when content-based detection is inconclusive. `generateThirdPartyLicensesContent` renders the collection as a markdown table; `writeThirdPartyLicensesFile` emits the file at the dist root. The license-URL builder lives in `license-url.ts` and supports GitHub, GitLab, and Bitbucket; other platforms resolve to `null`.
