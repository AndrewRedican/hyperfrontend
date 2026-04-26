# models

Plain-data git models for commits, tags, and refs, with factories and small predicates.

`GitCommit`, `GitRef`, and `GitTag` are the structured shapes consumed by every other git module. Factories (`createGitCommit`, `createGitRef`, `createLightweightTag`, `createAnnotatedTag`) produce instances from raw fields. Predicates (`isSameCommit`, `isMergeCommit`, `isRootCommit`, `isBranchRef`, `isTagRef`, `isRemoteRef`, `isHeadRef`) and accessors (`getShortHash`, `extractScope`, `extractType`) cover the common questions consumers ask of these models without having to re-derive the answers from the raw git output.
