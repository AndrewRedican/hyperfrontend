# url

Compare-URL generation for the supported repository platforms.

`createCompareUrl(options)` produces the platform-specific diff URL between two refs (tags, commits, or branches): `https://github.com/<owner>/<repo>/compare/<from>...<to>` for GitHub, the equivalent path for GitLab, Bitbucket, and Azure DevOps. `CreateCompareUrlOptions` covers the typical inputs: repository config plus the from/to refs.
