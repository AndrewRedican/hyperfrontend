# models

Workspace data models: projects, workspace config, and project-level query helpers.

`Project` is the per-package shape (name, version, path, dependencies, declared changelog) carried throughout the workspace operations; `createProject` is the factory. `Workspace`, `WorkspaceConfig`, and `WorkspaceType` describe the workspace as a whole. The project-level predicates (`isPublishable`, `isPrivate`, `hasChangelog`, `hasInternalDependencies`, `hasInternalDependents`) and accessors (`getDependencyCount`) cover the common questions consumers ask of a `Project` without reaching into its raw fields.
