# @hyperfrontend/app

Nx plugin providing executors for hyperfrontend application projects with self-contained dependencies.

## Purpose

This plugin enables a hybrid monorepo architecture where application projects maintain their own `node_modules` directories, separate from the root workspace dependencies. This pattern is essential for:

- Demo applications that showcase hyperfrontend with various frameworks
- Frontend applications with framework-specific dependencies
- Projects that consume published `@hyperfrontend/*` packages from npm

## Executors

### install

Installs dependencies in a self-contained application project.

```json
{
  "install": {
    "executor": "@hyperfrontend/app:install",
    "options": {
      "ci": false,
      "frozen": false
    }
  }
}
```

| Option   | Type    | Default | Description                                        |
| -------- | ------- | ------- | -------------------------------------------------- |
| `ci`     | boolean | false   | Use `npm ci` instead of `npm install`              |
| `frozen` | boolean | false   | Use `--frozen-lockfile` to fail on lockfile update |

### build

Builds an application project using its local package.json scripts.

```json
{
  "build": {
    "executor": "@hyperfrontend/app:build",
    "dependsOn": ["install"],
    "options": {
      "command": "npm run build"
    }
  }
}
```

| Option       | Type   | Default         | Description                           |
| ------------ | ------ | --------------- | ------------------------------------- |
| `command`    | string | `npm run build` | Custom build command to run           |
| `outputPath` | string | -               | Output directory for Nx cache outputs |

### serve

Serves an application project in development mode.

```json
{
  "serve": {
    "executor": "@hyperfrontend/app:serve",
    "dependsOn": ["install"],
    "options": {
      "command": "npm run dev",
      "port": 3000
    }
  }
}
```

| Option    | Type   | Default       | Description                     |
| --------- | ------ | ------------- | ------------------------------- |
| `command` | string | `npm run dev` | Custom serve command to run     |
| `port`    | number | -             | Port for the development server |

## Example Application project.json

```json
{
  "name": "docs-site",
  "projectType": "application",
  "tags": ["type:app", "scope:standalone"],
  "targets": {
    "install": {
      "executor": "@hyperfrontend/app:install",
      "options": {}
    },
    "build": {
      "executor": "@hyperfrontend/app:build",
      "dependsOn": ["install"],
      "outputs": ["{projectRoot}/.next"],
      "options": {
        "command": "npm run build"
      }
    },
    "serve": {
      "executor": "@hyperfrontend/app:serve",
      "dependsOn": ["install"],
      "options": {
        "command": "npm run dev",
        "port": 3000
      }
    }
  }
}
```
