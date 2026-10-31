# licenses

Third-party license collection.

`collectThirdPartyLicenses(workspaceRoot, externals)` scans the workspace node_modules for each named dependency, parses its `package.json`, locates a LICENSE file with case-insensitive matching, and infers the SPDX identifier, falling back to the [`license`](https://www.hyperfrontend.dev/docs/libraries/builder/models/#api-PackageJson-prop-license) field when content-based detection is inconclusive. Every entry carries the verbatim license, licence, copying and notice files of its package.

[`collectBundledThirdPartyLicenses`](https://www.hyperfrontend.dev/docs/libraries/builder/package/licenses/#api-collectBundledThirdPartyLicenses) produces the same entries for every third-party package a build inlines. It walks the declared dependencies from the project, through workspace packages, stopping at external names, and resolves each package from the one that requires it, so a nested install is read rather than the hoisted copy.

[`generateThirdPartyLicensesContent`](https://www.hyperfrontend.dev/docs/libraries/builder/package/licenses/#api-generateThirdPartyLicensesContent) renders the collection as a markdown table followed by the license texts; [`writeThirdPartyLicensesFile`](https://www.hyperfrontend.dev/docs/libraries/builder/package/licenses/#api-writeThirdPartyLicensesFile) emits the file at the dist root. The license-URL builder lives in `license-url.ts` and supports GitHub, GitLab, and Bitbucket; other platforms resolve to `null`.
