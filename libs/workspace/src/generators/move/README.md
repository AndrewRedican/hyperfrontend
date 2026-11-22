# move

Relocates a project under another directory and brings its names, aliases and references along. By default the project and package take the new directory's name; the e2e projects that test the library are renamed with it and stay where they are.

```bash
npx hf generate move my-utils --destination=libs/utils
npx hf generate move my-utils \
  --destination=packages --newName=utils --updateName=false
```

| Option          | What it sets                                                                                                |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| `--project`     | The project to move (also the first positional argument)                                                    |
| `--destination` | The directory it moves under, relative to the root                                                          |
| `--newName`     | The directory's new name; defaults to the current one                                                       |
| `--projectName` | The project's new name when the names are updated; defaults to the directory's name                         |
| `--packageName` | The package's new name when the names are updated; defaults to the directory's name under the current scope |
| `--updateName`  | Whether the project and package names follow the new location; defaults to true                             |
| `--skipFormat`  | Leave the written files unformatted                                                                         |

When the names follow, the project is renamed in the configurations that refer to it as the rename generator renames it: the implicit dependencies, the tasks other targets run after, and the inputs that read from it, in every project and in `hf.json`. A name another project already holds is refused, and so is a package name another project's package states or `tsconfig.base.json` already holds an alias under; the names the projects that test the library would take are checked the same way.

A destination that already exists is refused, and so is one inside the project's own directory, where the copy would be deleted with the directory it was copied from. Nothing is written when a move is refused.

A file the move has nothing to change in is copied, or left, as it is written, and is not formatted: a source file, a manifest whose names stay, a tsconfig whose paths to the root are as long from the new directory as from the old, and the configuration of a project that does not refer to the moved one.
