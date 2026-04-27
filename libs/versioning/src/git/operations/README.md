# operations

Typed wrappers around `git` shell commands — log, tag, commit, staging, status, and diff — returning structured data instead of raw text.

The commit family (`commit`, `amendCommit`, `amendCommitNoEdit`, `createEmptyCommit`) drives `git commit` with safe argument escaping (`escapeFilePath`, `escapeAuthor`). The tag family covers creation (`createTag`), querying (`listTags`), and lookup (`getTag`). Diff helpers (`getChangedFilesBetween`, `getChangedFilesBetweenWithStatus`, `getCommitWithFiles`) return typed `FileChange[]` and `GitCommitWithFiles` shapes. Status (`getStatus`, returning `RepositoryStatus` with `FileStatusEntry[]`) and staging (`stage`, `discardChanges`) round out the everyday git surface. `GitOperationState` captures retry/idempotency reasons for steps that can be safely re-run.
