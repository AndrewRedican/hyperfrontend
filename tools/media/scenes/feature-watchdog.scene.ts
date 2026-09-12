import { panelStage } from '../src/panel/stage'
import { defineScriptedScene } from '../src/scene/define-scene'

/**
 * Identical silence, judged three different ways.
 *
 * This is the hardest claim in the SDK's documentation to make in prose,
 * because the whole point is that nothing observable changes. A feature that
 * has stopped answering and a feature whose tab is in the background produce
 * exactly the same thing on the wire, which is nothing, and the watchdog is
 * the code that refuses to treat them the same.
 *
 * So the frame is a tape of what actually happened beside the verdict at each
 * moment, and the verdict is the only thing that moves. Three ticks of silence
 * while both pages are visible reach `suspect`. Three ticks of silence while
 * either page is hidden reach nothing at all, because the watchdog is not
 * counting: a throttled timer's quiet is not evidence. And coming back to the
 * tab does not restore `healthy`, which is the part every reader expects and
 * the part that would let a frame the browser killed in the background be
 * readmitted to the scene on every return. It grants a fresh budget and says
 * nothing. The next beat says healthy; its absence says suspect.
 *
 * Verified line by line against `libs/features/src/host/heartbeat.ts`: the
 * states are `healthy | unobservable | suspect | gone`, `BEAT_INTERVAL_MS` is
 * 1000, `MISS_THRESHOLD` is 3, the tick returns early while unobservable,
 * `setObservable(true)` resets `missed` without transitioning, and `beat()`
 * only speaks `healthy` when the pair is observable.
 */
export default defineScriptedScene({
  slug: 'feature-watchdog',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'compact',
  hue: 217,
  stage: panelStage,
  holdMs: 1_700,
  gif: { colours: 56, lossy: 72, maxBytes: 1_000_000 },
  stills: [{ name: 'poster', atMs: 8_900, format: 'webp', quality: 82, maxBytes: 90_000 }],
  config: {
    heading: 'The same silence, three times, meaning three different things.',
    caption: 'Returning to the tab grants a fresh budget, not a verdict. Only a beat says healthy.',
    restMs: 1_600,
    panels: [
      {
        title: 'what the host saw',
        kind: 'result',
        tail: true,
        weight: 1.25,
        rows: [
          { text: 'open', atMs: 300, marker: '·', tone: 'muted' },
          { text: '__hf:beat', atMs: 900, marker: '←', tone: 'success' },
          { text: '__hf:beat', atMs: 1_500, marker: '←', tone: 'success' },
          { text: 'tick, no beat', atMs: 2_300, marker: '·', tone: 'warning' },
          { text: 'tick, no beat', atMs: 2_900, marker: '·', tone: 'warning' },
          { text: 'tick, no beat', atMs: 3_500, marker: '·', tone: 'danger' },
          { text: '__hf:beat', atMs: 4_400, marker: '←', tone: 'success' },
          { text: '__hf:visibility  hidden', atMs: 5_300, marker: '←', tone: 'accent' },
          { text: 'tick (not counted)', atMs: 5_900, marker: '·', tone: 'muted' },
          { text: 'tick (not counted)', atMs: 6_400, marker: '·', tone: 'muted' },
          { text: 'tick (not counted)', atMs: 6_900, marker: '·', tone: 'muted' },
          { text: '__hf:visibility  visible', atMs: 7_600, marker: '←', tone: 'accent' },
          { text: 'tick, no beat', atMs: 8_300, marker: '·', tone: 'warning' },
          { text: 'tick, no beat', atMs: 8_900, marker: '·', tone: 'warning' },
          { text: 'tick, no beat', atMs: 9_500, marker: '·', tone: 'danger' },
        ],
      },
      {
        title: 'shell.on(status)',
        kind: 'result',
        align: 'center',
        rows: [
          { text: "state: 'healthy'", atMs: 300, untilMs: 3_500, marker: '›', tone: 'success', emphasis: true },
          { text: 'the handshake is evidence', atMs: 300, untilMs: 2_300, tone: 'muted' },
          { text: 'missedBeats: 1', atMs: 2_300, untilMs: 2_900, tone: 'muted' },
          { text: 'missedBeats: 2', atMs: 2_900, untilMs: 3_500, tone: 'muted' },

          { text: "state: 'suspect'", atMs: 3_500, untilMs: 4_400, marker: '›', tone: 'danger', emphasis: true },
          { text: 'missedBeats: 3, both visible', atMs: 3_500, untilMs: 4_400, tone: 'muted' },

          { text: "state: 'healthy'", atMs: 4_400, untilMs: 5_300, marker: '›', tone: 'success', emphasis: true },
          { text: 'one beat ends the episode', atMs: 4_400, untilMs: 5_300, tone: 'muted' },

          { text: "state: 'unobservable'", atMs: 5_300, untilMs: 9_500, marker: '›', tone: 'warning', emphasis: true },
          { text: 'the tab is hidden, so the', atMs: 5_300, untilMs: 7_600, tone: 'muted' },
          { text: 'watchdog stops counting', atMs: 5_300, untilMs: 7_600, tone: 'muted' },
          { text: 'watching resumed, budget reset,', atMs: 7_600, untilMs: 8_300, tone: 'muted' },
          { text: 'still nothing heard', atMs: 7_600, untilMs: 8_300, tone: 'muted' },

          { text: 'missedBeats: 1', atMs: 8_300, untilMs: 8_900, tone: 'muted' },
          { text: 'missedBeats: 2', atMs: 8_900, untilMs: 9_500, tone: 'muted' },
          { text: "state: 'suspect'", atMs: 9_500, marker: '›', tone: 'danger', emphasis: true },
          { text: 'now the silence means something', atMs: 9_500, tone: 'muted' },
        ],
      },
    ],
  },
})
