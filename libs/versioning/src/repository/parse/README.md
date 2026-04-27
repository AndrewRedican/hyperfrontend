# parse

Parsers for repository URLs and `package.json` repository declarations.

`parseRepositoryUrl` recognizes the common URL shapes (HTTPS, SSH, `git+https://`, scoped paths) and returns a `ParsedRepository` carrying platform, owner, and repo. `createRepositoryConfigFromUrl` is the convenience wrapper that goes straight from a URL to a usable `RepositoryConfig`. `inferRepositoryFromPackageJson` and `inferRepositoryFromPackageJsonObject` read the `repository` field of a `package.json` (whether string or object form) and produce a config; `extractRepositoryUrl` is the lower-level helper that just returns the URL string.
