# move

Relocates a project under another directory and brings its names, aliases and references along. By default the project and package take the new directory's name; the e2e project that tests the library is renamed with it and stays where it is.

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
