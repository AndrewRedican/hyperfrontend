# package

`package.json` reading, dependency inspection, and version-check helpers.

`readPackageJson` and `readPackageJsonIfExists` parse `package.json` into a typed `PackageJson` shape. `findNearestPackageJson` walks up from a starting path to locate the closest manifest. `getDependencies`, `getDevDependencies`, `getPeerDependencies`, `getProductionDependencies`, and `getAllDependencies` slice the manifest into typed maps; `hasDependency`, `hasInstalledPackage`, and `getDependencyVersion` answer presence and version-range questions. `getWorkspaces` / `hasWorkspaces` surface monorepo workspace declarations from npm, Yarn, or pnpm.
