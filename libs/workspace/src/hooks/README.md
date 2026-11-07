# hooks

The resolution hook that loads a workspace's TypeScript from source: the path aliases of `tsconfig.base.json`, and extensionless relative imports completed the way the compiler does.

Importing the entry installs the hook for the workspace above the working directory, so one flag is all a script needs:

```bash
node --import @hyperfrontend/workspace/hooks tools/scripts/report.ts
```

The command line installs the hook itself for the root it finds, which is how an executor or generator a workspace writes in TypeScript loads without any flag. [`installAliases`](https://www.hyperfrontend.dev/docs/libraries/workspace/hooks/#api-installAliases) adds another workspace root at run time, and [`installFrom`](https://www.hyperfrontend.dev/docs/libraries/workspace/hooks/#api-installFrom) finds the root above a directory first.

The hook imports nothing but Node's own modules, so it works before the aliases it installs exist.
