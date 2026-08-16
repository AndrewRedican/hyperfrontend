/**
 * Usage text printed for `--help` and on an unknown command.
 *
 * Documents the four commands and the shared flag surface so the headless
 * (`--ci`) path is discoverable without reading the docs.
 */
export const USAGE = `@hyperfrontend/features — build, embed, and orchestrate micro-frontend features

Usage: hf <command> [options]

Commands:
  init     Scaffold the feature glue module and wire it into your app
  build    Generate the feature's shell package, bundle it, and pack a tarball
  dev      Start the app servers and debug UI, serving until Ctrl-C
  serve    Serve a built site for production, with compression and header rules

Options:
  --name <name>         Feature name
  --version <version>   Feature version
  --contract <path>     Path to the *.contract.{json,ts,js} file
  --entry <path>        Entry file to wire the glue import into (init)
  --url <url>           URL the shell loads the feature from (build)
  --protocol <none|v1|v2>  Security envelope enforced at build time
  --allow-open          Acknowledge an explicit '--protocol none' and build an open, unauthenticated shell (build)
  --out <dir>           Output directory for the built shell (build)
  --apps <path>         Path to the dev-server apps array (dev)
  --port <number>       Port the dev-server debug UI (dev; overrides the config's debug.port) or the static server (serve) listens on; serve falls back to $PORT
  --root <dir>          Directory served as the site root (serve)
  --host <interface>    Interface the static server binds; every interface when omitted (serve)
  --config <path>       Path to the whole feature.config.* / hf-dev.config.* / hf-serve.config.* file
  --cwd <dir>           Working-directory override
  --ci, --yes           Run headlessly; error on any unresolved required key
  --dry-run             Preview file changes without writing them
  -h, --help            Print this help
`
