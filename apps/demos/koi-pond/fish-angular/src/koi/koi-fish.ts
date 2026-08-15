/**
 * The Angular koi: the canvas the 3D fish renders into, and its identity card.
 *
 * The component itself is deliberately almost static. Its template is the two
 * nodes the koi lives on — the canvas its body is drawn to, and the card a
 * visitor's hold reveals — and its one lifecycle hook hands both to the
 * renderer that animates them. Everything that moves per frame is written
 * through the imperative stage, outside change detection; the application runs
 * zoneless and this component renders exactly once in a koi's life.
 *
 * Nothing is painted on `body` or on the app root — the hostee SDK resets both
 * to transparent, and anything painted there would blank the pond behind this
 * frame for every koi below it. The canvas clears to transparent; only the
 * fish itself has colour.
 *
 * This is the one browser-facing part of the app. The other seven koi replace
 * it with their own framework's idiom, and share everything else.
 */
import type { AfterViewInit, ElementRef, OnDestroy } from '@angular/core'
import type { KoiProfile } from '@hyperfrontend/demo-koi-lib'
import { ChangeDetectionStrategy, Component, input, viewChild } from '@angular/core'
import { FRAMEWORK_SITES } from '@hyperfrontend/demo-koi-lib'

/** The card's committed nodes, handed to the imperative renderer as one piece. */
export interface KoiCardHandles {
  /** The card element the renderer reveals and parks. */
  card: HTMLDivElement
  /** The app URL anchor, whose rectangle the outline reports. */
  app: HTMLAnchorElement
  /** The framework-site anchor, whose rectangle the outline reports. */
  site: HTMLAnchorElement
  /** The behaviour row. */
  state: HTMLElement
  /** The runtime row. */
  runtime: HTMLElement
  /** The memory row. */
  memory: HTMLElement
  /** The last-event row, hidden until an event exists. */
  event: HTMLElement
}

/** Hands the mounted nodes to the imperative renderer; returns their teardown. */
export type KoiMount = (canvas: HTMLCanvasElement, handles: KoiCardHandles) => () => void

/**
 * One koi's canvas and identity card.
 */
@Component({
  selector: 'koi-fish',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <canvas class="koi-canvas" aria-hidden="true" #canvas></canvas>
    <div class="koi-card" hidden #card>
      <span class="koi-card-name">
        <span class="koi-card-title" [style.color]="profile().palette.accent">{{ profile().label }}</span>
        <!-- why: The variety rides beside the framework name — the pattern is the koi's own identity, and it costs one word to say this sanke is the Angular app. -->
        <span class="koi-card-variety">{{ profile().palette.pattern }}</span>
      </span>
      <span class="koi-card-line koi-card-state" #state></span>
      <!-- why: The links are real anchors for semantics and styling, but this frame never receives the pointer — the host reads their rectangles off the outline report and floats the anchors that actually open them. -->
      <a class="koi-card-url" [href]="url()" target="_blank" rel="noopener noreferrer" #app>{{ url() }}</a>
      <span class="koi-card-line koi-card-runtime" #runtime></span>
      <span class="koi-card-line koi-card-memory" #memory></span>
      <span class="koi-card-line koi-card-event" hidden #event></span>
      <a class="koi-card-site" [href]="site()" target="_blank" rel="noopener noreferrer" #siteAnchor>{{ profile().label }} website ↗</a>
    </div>
  `,
})
export class KoiFish implements AfterViewInit, OnDestroy {
  /** Everything about this koi that never changes. */
  readonly profile = input.required<KoiProfile>()
  /** The URL of the app rendering it, shown on the card. */
  readonly url = input.required<string>()
  /** Hands the mounted nodes to the imperative renderer. */
  readonly mount = input.required<KoiMount>()

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas')
  private readonly cardRef = viewChild.required<ElementRef<HTMLDivElement>>('card')
  private readonly appRef = viewChild.required<ElementRef<HTMLAnchorElement>>('app')
  private readonly siteRef = viewChild.required<ElementRef<HTMLAnchorElement>>('siteAnchor')
  private readonly stateRef = viewChild.required<ElementRef<HTMLElement>>('state')
  private readonly runtimeRef = viewChild.required<ElementRef<HTMLElement>>('runtime')
  private readonly memoryRef = viewChild.required<ElementRef<HTMLElement>>('memory')
  private readonly eventRef = viewChild.required<ElementRef<HTMLElement>>('event')

  private teardown: (() => void) | null = null

  /** The framework's official site, linked from the card's last line. */
  site(): string {
    return FRAMEWORK_SITES[this.profile().framework]
  }

  ngAfterViewInit(): void {
    // why: The GPU scene needs a real canvas node, so it is built here — after Angular has committed the view — and torn down by whatever cleanup the renderer hands back.
    this.teardown = this.mount()(this.canvasRef().nativeElement, {
      card: this.cardRef().nativeElement,
      app: this.appRef().nativeElement,
      site: this.siteRef().nativeElement,
      state: this.stateRef().nativeElement,
      runtime: this.runtimeRef().nativeElement,
      memory: this.memoryRef().nativeElement,
      event: this.eventRef().nativeElement,
    })
  }

  ngOnDestroy(): void {
    this.teardown?.()
    this.teardown = null
  }
}
