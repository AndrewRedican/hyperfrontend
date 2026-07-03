/**
 * Usage text printed for `--help` and on an unknown command.
 *
 * Documents the three commands and the shared flag surface so the headless
 * (`--ci`) path is discoverable without reading the docs.
 */
export const USAGE = `@hyperfrontend/features — build, embed, and orchestrate micro-frontend features

Usage: hf <command> [options]

Commands:
  init     Scaffold the feature glue module and wire it into your app
  build    Generate the host connector, bundle it, and pack a tarball
  dev      Start the app servers and debug UI, serving until Ctrl-C

Options:
  --name <name>         Feature name
  --version <version>   Feature version
  --contract <path>     Path to the *.contract.{json,ts,js} file
  --entry <path>        Entry file to wire the glue import into (init)
  --url <url>           URL the connector loads the feature from (build)
  --protocol <none|v1|v2>  Security envelope enforced at build time
  --out <dir>           Output directory for the built connector (build)
  --apps <path>         Path to the dev-server apps array (dev)
  --port <number>       Port the dev-server debug UI listens on (dev)
  --config <path>       Path to the whole feature.config.* / hf-dev.config.* file
  --cwd <dir>           Working-directory override
  --ci, --yes           Run headlessly; error on any unresolved required key
  --dry-run             Preview file changes without writing them
  -h, --help            Print this help
`
