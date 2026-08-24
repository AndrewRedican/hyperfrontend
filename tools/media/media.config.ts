import { defineConfig } from './src/config/define-config'

export default defineConfig({
  rootDir: '../..',
  sceneDir: 'tools/media/scenes',
  outputDir: 'assets/media',
  tmpDir: 'tools/media/tmp',
  publicBaseUrl: 'https://www.hyperfrontend.dev/media/',
  encoder: {
    prefer: 'auto',
  },
  browser: {
    // why: no GPU in the container, so every pixel is drawn by a software rasteriser
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
    readyTimeoutMs: 90_000,
  },
  defaults: {
    // why: continuous full-frame motion defeats inter-frame compression, so these
    // why: sit well below the library defaults to keep committed assets small
    gif: {
      fps: 6,
      colours: 64,
      lossy: 80,
      loop: 0,
      maxBytes: 2_000_000,
    },
  },
})
