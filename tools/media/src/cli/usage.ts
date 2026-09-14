/** What the tool prints when asked for help, or when the command line makes no sense. */
export const USAGE = `media <command> [options]

Commands
  record          Record every scene, or one named by --scene
  shot            Take a single screenshot without authoring a scene
  preview         Draw chosen moments of a scripted scene onto one contact sheet
  check           Verify committed assets against their scenes, without a browser
  doctor          Report which browsers and encoders are available here

Common options
  --config <path>     Configuration file (default: media.config.ts beside the cwd)
  --json              Print machine-readable output instead of a table
  --verbose           Log what the recorder is doing

record options
  --scene <slug>      Record only this scene
  --encoder <name>    Force an encoder: auto, ffmpeg or sharp
  --skip-build        Do not run each scene's build command
  --keep-tmp          Leave intermediates on disk for inspection

shot options
  --url <url>         Page to open (required)
  --out <path>        File to write (required)
  --viewport <WxH>    Viewport size (default: 1280x800)
  --wait <selector>   Wait for this selector before capturing
  --settle <ms>       Wait this long after the selector appears (default: 0)
  --timeout <ms>      How long to wait for the selector (default: 60000)
  --selector <sel>    Capture this element instead of the viewport
  --full-page         Capture the whole scrollable page
  --omit-background   Keep the page's own transparency instead of white
  --format <fmt>      png, webp or jpeg (default: png)
  --quality <n>       Quality for webp and jpeg (default: 90); under 100, a png is palette-quantised
  --width <n>         Resize the capture to this width
  --console           Write the page's console output beside the image

preview options
  --scene <slug>      The scripted scene to draw (required)
  --out <path>        PNG to write (required)
  --at <ms,...|every:N>  Moments to draw, or N spread evenly to the end (default: 0)
  --theme <name>      portable, dark or light (default: portable)
  --background <css>  Colour behind a transparent frame (default: #ffffff)

check options
  --scene <slug>      Check only this scene
`
