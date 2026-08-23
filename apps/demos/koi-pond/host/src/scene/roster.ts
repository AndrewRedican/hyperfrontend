/**
 * The shoal panel: one control surface for the koi in this pond.
 *
 * Hovering a fish reveals which framework renders it and where its app lives.
 * That is a pointer gesture over a moving target inside a frame no assistive
 * technology can hit-test, so the same identity is published as an ordinary
 * list the keyboard can walk and a screen reader can read. Focusing a row is
 * the keyboard's hover: the host sends those koi the same `hover` notice a
 * pointer would, and each fish draws its own identity exactly as it does for a
 * mouse.
 *
 * The list is also where the shoal is grown and thinned. Every framework keeps
 * a row whether or not one of its koi is swimming, so adding a fish is the same
 * gesture as reading the roster; each living koi carries its own control back
 * out again, and focusing that control lights exactly the fish it would remove,
 * so nothing is ever dismissed blind. The device's ceiling is stated rather
 * than merely enforced: at the cap the add controls stand down and name the
 * tier that decided it, which is the difference between a pond that refuses and
 * a pond that explains.
 *
 * The interaction overlay's control belongs here too. Turning it on is what
 * makes the composition visible, which is the whole point of the demo made
 * literal; keeping it beside the roster puts every way of driving the scene in
 * one place a visitor has to find once.
 *
 * A narrow pond collapses the panel to a pill rather than dropping it. A phone
 * showing the pond as the whole experience is the case with the least room to
 * spend on chrome and the most need of it, because none of these gestures has a
 * pointer equivalent a thumb can reach.
 */
import type { KoiFramework } from '@hyperfrontend/demo-koi-lib'
import type { KoiInstanceId } from './instance-id'
import type { ShoalState } from './pond'
import { KOI_FRAMEWORKS, koiLabel } from '@hyperfrontend/demo-koi-lib'

/** Where the pond's source lives, linked from the panel for anyone who wants to read the trick. */
const SOURCE_URL = 'https://github.com/AndrewRedican/hyperfrontend/tree/main/apps/demos/koi-pond'

/** How narrow a pond has to be before the panel trades its rows for a pill, in CSS pixels. */
const PILL_BELOW_PX = 680

/** What the collapse control opens, named so it can point at it. */
const BODY_ID = 'koi-shoal-body'

/** The glyph on the interactions control: a koi's sensing cone sweeping ahead of it. */
const CONE_GLYPH =
  '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" width="13" height="13"><circle cx="4" cy="8" r="1.6" fill="currentColor"/><path d="M5.6 8 13 3.6M5.6 8 13 12.4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none" opacity="0.55"/><path d="M11.2 5.2a3.6 3.6 0 0 1 0 5.6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none"/></svg>'

/** The glyph on the collapse control; the stylesheet turns it to face the state it moves to. */
const CHEVRON_GLYPH =
  '<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false" width="10" height="10"><path d="M2.6 4.4 6 7.8l3.4-3.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>'

/** What the panel asks the pond to do on a visitor's behalf. */
export interface ShoalPanelHooks {
  /**
   * Resolves a koi's app URL, which its row links to.
   *
   * @param framework - The framework whose app to link.
   * @returns The app's URL.
   */
  fishUrl(framework: KoiFramework): string
  /**
   * A visitor has moved onto some koi without a pointer.
   *
   * A framework row names every answering koi of that framework; one koi's own
   * control names only itself; leaving the panel names none.
   *
   * @param instances - The koi to light, which may be empty.
   */
  identify(instances: readonly KoiInstanceId[]): void
  /**
   * A visitor asked for another koi of a framework.
   *
   * @param framework - The framework to grow.
   */
  add(framework: KoiFramework): void
  /**
   * A visitor asked for one koi to leave.
   *
   * @param instance - The koi to remove.
   */
  remove(instance: KoiInstanceId): void
  /**
   * A visitor flipped the interaction overlay.
   *
   * @param on - Whether the overlay was asked for.
   */
  interactions(on: boolean): void
}

/** The shoal panel, once it is in the document. */
export interface ShoalPanel {
  /**
   * Rewrites the rows from the living shoal and the ceiling over it.
   *
   * @param state - The roster, the device tier, and the cap that tier grants.
   */
  setShoal(state: ShoalState): void
  /**
   * Marks which koi are answering, so the panel never offers a fish that is not there.
   *
   * @param present - Every instance whose session is open.
   */
  setPresent(present: ReadonlySet<KoiInstanceId>): void
  /**
   * Reflects who is lit, so pointer and keyboard agree about the same fish.
   *
   * @param hovered - Every instance currently told the visitor is on it.
   */
  setHovered(hovered: ReadonlySet<KoiInstanceId>): void
  /**
   * Reflects the interaction overlay's state on its control.
   *
   * @param on - Whether the overlay is drawing.
   */
  setInteractions(on: boolean): void
  /**
   * Tells the panel how wide the pond is, which is what decides the pill.
   *
   * @param width - The pond root's width in CSS pixels.
   */
  setFrameWidth(width: number): void
}

/** One framework's row, and the handles the panel rewrites as that framework's koi come and go. */
interface FrameworkRow {
  /** The row itself, carrying the framework's presence and hover state. */
  item: HTMLLIElement
  /** The framework's name, linked to its app; focusing it lights every koi of the framework. */
  link: HTMLAnchorElement
  /** The count badge, hidden while the framework has no koi. */
  tally: HTMLElement
  /** The digits inside the badge. */
  tallyValue: HTMLElement
  /** The control that asks for another koi of this framework. */
  add: HTMLButtonElement
  /** The list of this framework's living koi. */
  instances: HTMLUListElement
  /** One entry per living koi, keyed by instance so a rewrite keeps the elements it already has. */
  koi: Map<KoiInstanceId, { item: HTMLLIElement; button: HTMLButtonElement }>
}

/**
 * Builds the shoal panel and wires every control to the pond.
 *
 * @param root - The pond root the panel is placed over.
 * @param shoal - The shoal as it stands when the panel opens.
 * @param hooks - What the panel asks the pond to do.
 * @returns The panel.
 *
 * @example Giving the shoal a control surface
 * ```typescript
 * const panel = createShoalPanel(root, scene.shoalState(), {
 *   fishUrl: fishHomeUrl,
 *   identify: (instances) => setHover(instances),
 *   add: (framework) => addKoi(framework),
 *   remove: (instance) => removeKoi(instance),
 *   interactions: (on) => scene.setInteractions(on),
 * })
 * ```
 */
export function createShoalPanel(root: HTMLElement, shoal: ShoalState, hooks: ShoalPanelHooks): ShoalPanel {
  let present: ReadonlySet<KoiInstanceId> = new Set()
  let hovered: ReadonlySet<KoiInstanceId> = new Set()
  let narrow = false
  let interactionsOn = false

  const panel = document.createElement('nav')
  panel.className = 'koi-shoal'
  panel.setAttribute('aria-label', 'Koi in this pond')
  panel.dataset['narrow'] = 'false'
  panel.dataset['collapsed'] = 'false'

  // why: The panel is chrome floating over the water — a press on it must read the panel, never strike the pond showing behind it.
  const contain = (event: Event): void => {
    event.stopPropagation()
  }
  panel.addEventListener('pointerdown', contain)
  panel.addEventListener('click', contain)

  const heading = document.createElement('h2')
  heading.className = 'koi-shoal-heading'

  // why: The heading is the collapse control, so the pill a narrow pond falls back to is the same element rather than a second thing to keep in step with the first.
  const pill = document.createElement('button')
  pill.type = 'button'
  pill.className = 'koi-shoal-pill'
  pill.setAttribute('aria-expanded', 'true')
  pill.setAttribute('aria-controls', BODY_ID)

  const pillDot = document.createElement('span')
  pillDot.className = 'koi-shoal-dot'
  pillDot.setAttribute('aria-hidden', 'true')

  const summary = document.createElement('span')
  summary.className = 'koi-shoal-summary'

  const chevron = document.createElement('span')
  chevron.className = 'koi-shoal-chevron'
  chevron.innerHTML = CHEVRON_GLYPH

  pill.append(pillDot, summary, chevron)
  heading.append(pill)

  const body = document.createElement('div')
  body.className = 'koi-shoal-body'
  body.id = BODY_ID

  const list = document.createElement('ul')
  list.className = 'koi-shoal-rows'
  body.append(list)

  const note = document.createElement('p')
  note.className = 'koi-shoal-note'
  body.append(note)

  const interactions = document.createElement('button')
  interactions.type = 'button'
  interactions.className = 'koi-shoal-interactions'
  interactions.setAttribute('aria-pressed', 'false')
  // why: The label names the capability and never changes with state; `aria-pressed` and the lit treatment are what say whether it is on, so the control keeps one identity a visitor can look for twice.
  interactions.innerHTML = `${CONE_GLYPH}<span>View interactions</span>`
  body.append(interactions)

  // note: The whole demo exists to be read — the panel carries the one link out to the code that builds it.
  const source = document.createElement('a')
  source.className = 'koi-shoal-source'
  source.href = SOURCE_URL
  source.target = '_blank'
  source.rel = 'noopener noreferrer'
  source.textContent = 'Source on GitHub ↗'
  body.append(source)

  panel.append(heading, body)

  /**
   * A framework's koi, in the order they were seeded.
   *
   * @param framework - The framework to read.
   * @returns Its living koi, lowest ordinal first.
   */
  const membersOf = (framework: KoiFramework): ShoalState['roster'] =>
    shoal.roster.filter((member) => member.framework === framework).sort((first, second) => first.ordinal - second.ordinal)

  /**
   * Which of a framework's koi are answering right now.
   *
   * @param framework - The framework to read.
   * @returns The instances a visitor could actually be shown.
   */
  const answeringOf = (framework: KoiFramework): KoiInstanceId[] =>
    membersOf(framework)
      .map((member) => member.id)
      .filter((id) => present.has(id))

  const rows = new Map<KoiFramework, FrameworkRow>()
  for (const framework of KOI_FRAMEWORKS) {
    const label = koiLabel(framework)

    const item = document.createElement('li')
    item.className = 'koi-shoal-row'
    item.dataset['fish'] = framework
    item.dataset['connected'] = 'false'
    item.dataset['hovered'] = 'false'

    const line = document.createElement('div')
    line.className = 'koi-shoal-line'

    const dot = document.createElement('span')
    dot.className = 'koi-shoal-dot'
    dot.setAttribute('aria-hidden', 'true')

    const link = document.createElement('a')
    link.className = 'koi-shoal-name'
    link.href = hooks.fishUrl(framework)
    link.textContent = label
    link.dataset['fish'] = framework
    link.tabIndex = -1

    const tallyValue = document.createElement('span')
    const tallySuffix = document.createElement('span')
    tallySuffix.className = 'koi-visually-hidden'
    tallySuffix.textContent = ' in the pond'
    const tally = document.createElement('span')
    tally.className = 'koi-shoal-tally'
    tally.hidden = true
    tally.append(tallyValue, tallySuffix)

    const add = document.createElement('button')
    add.type = 'button'
    add.className = 'koi-shoal-add'
    add.dataset['fish'] = framework
    add.textContent = '+'
    add.setAttribute('aria-label', `Add a ${label} koi`)

    const instances = document.createElement('ul')
    instances.className = 'koi-shoal-instances'
    instances.setAttribute('aria-label', `${label} koi`)
    instances.hidden = true

    // why: Focus is the keyboard's hover — the same notice a pointer would trigger goes to the same fish, and each fish draws its own identity. A framework's row speaks for all of its koi at once, which is how a visitor finds out which fish in the water are the React ones.
    for (const control of [link, add]) {
      control.addEventListener('focus', () => {
        hooks.identify(answeringOf(framework))
      })
      control.addEventListener('blur', () => {
        hooks.identify([])
      })
    }

    add.addEventListener('click', () => {
      hooks.add(framework)
    })

    line.append(dot, link, tally, add)
    item.append(line, instances)
    list.append(item)
    rows.set(framework, { item, link, tally, tallyValue, add, instances, koi: new Map() })
  }

  /**
   * Builds one koi's own control: the thing that lights it and lets it go.
   *
   * @param framework - The framework rendering it.
   * @param id - The instance the control speaks for.
   * @param ordinal - Which of its framework's koi it is.
   * @returns The list entry and the control inside it.
   */
  const buildKoi = (framework: KoiFramework, id: KoiInstanceId, ordinal: number): { item: HTMLLIElement; button: HTMLButtonElement } => {
    const item = document.createElement('li')
    item.dataset['instance'] = id
    item.dataset['connected'] = 'false'
    item.dataset['hovered'] = 'false'

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'koi-shoal-instance'
    button.dataset['fish'] = framework
    button.dataset['instance'] = id
    button.setAttribute('aria-label', `Remove ${koiLabel(framework)} koi ${ordinal + 1}`)

    const number = document.createElement('span')
    number.textContent = String(ordinal + 1)
    const cross = document.createElement('span')
    cross.className = 'koi-shoal-cross'
    cross.setAttribute('aria-hidden', 'true')
    cross.textContent = '×'
    button.append(number, cross)

    // why: Focusing the control that would remove a koi lights exactly that koi, so a keyboard visitor sees which fish they are about to send away before they send it.
    button.addEventListener('focus', () => {
      hooks.identify([id])
    })
    button.addEventListener('blur', () => {
      hooks.identify([])
    })
    button.addEventListener('click', () => {
      hooks.remove(id)
    })

    item.append(button)
    return { item, button }
  }

  /** Marks every row and every koi with whether its session is answering. */
  const applyPresence = (): void => {
    for (const [framework, row] of rows) {
      const answering = answeringOf(framework)
      row.item.dataset['connected'] = answering.length > 0 ? 'true' : 'false'
      // why: A framework with no koi in the water has no identity to reveal, so its name leaves the tab order rather than standing there as a dead target; its add control is how the row stays reachable.
      row.link.tabIndex = answering.length > 0 ? 0 : -1
      for (const [id, koi] of row.koi) {
        koi.item.dataset['connected'] = present.has(id) ? 'true' : 'false'
      }
    }
    pillDot.dataset['connected'] = shoal.roster.length > 0 && present.size === shoal.roster.length ? 'true' : 'false'
  }

  /** Marks every row and every koi with whether the visitor is on it. */
  const applyHover = (): void => {
    for (const row of rows.values()) {
      let any = false
      for (const [id, koi] of row.koi) {
        const lit = hovered.has(id)
        koi.item.dataset['hovered'] = lit ? 'true' : 'false'
        any = any || lit
      }
      row.item.dataset['hovered'] = any ? 'true' : 'false'
    }
  }

  /**
   * Puts focus somewhere the visitor can carry on from when the control holding it left with its koi.
   *
   * @param lost - Whatever had focus before the rows were rewritten.
   */
  const restoreFocus = (lost: Element | null): void => {
    if (!(lost instanceof HTMLElement)) {
      return
    }
    // why: A control can be stranded two ways — it leaves with the koi it spoke for, or it is still there and has stopped answering because that press was the one that reached the cap. A browser drops focus to the document either way, which ends a keyboard visitor's journey mid-gesture.
    const stranded = !lost.isConnected || (lost instanceof HTMLButtonElement && lost.disabled)
    // why: Only this panel's own controls carry a framework, so nothing else that lost the document can have focus pulled into the panel.
    const framework = stranded ? lost.dataset['fish'] : undefined
    const row = framework === undefined ? undefined : rows.get(<KoiFramework>framework)
    if (row === undefined) {
      return
    }
    const newest = membersOf(<KoiFramework>framework).at(-1)
    const koi = newest === undefined ? undefined : row.koi.get(newest.id)
    // why: The row the gesture happened in is the nearest place to carry on from: its add control while it still answers, and otherwise the koi that press just brought into the pond, which is also how that koi is sent back out.
    const next = !row.add.disabled ? row.add : koi !== undefined && !koi.button.disabled ? koi.button : row.link
    next.focus()
  }

  /** Rewrites every row from the living shoal, keeping whatever elements it already has. */
  const render = (): void => {
    const lost = document.activeElement
    const full = shoal.roster.length >= shoal.cap
    const capReason = `A ${shoal.tier}-tier device seats ${shoal.cap} koi.`
    const last = shoal.roster.length <= 1

    for (const [framework, row] of rows) {
      const members = membersOf(framework)
      row.tallyValue.textContent = String(members.length)
      row.tally.hidden = members.length === 0
      row.add.disabled = full
      // why: A refusal that only happens is a pond behaving arbitrarily; the tier that decided the ceiling is named on the very control it stands down.
      if (full) {
        row.add.title = capReason
      } else {
        row.add.removeAttribute('title')
      }

      const wanted = new Set(members.map((member) => member.id))
      for (const [id, koi] of row.koi) {
        if (!wanted.has(id)) {
          koi.item.remove()
          row.koi.delete(id)
        }
      }
      for (const member of members) {
        let koi = row.koi.get(member.id)
        if (koi === undefined) {
          koi = buildKoi(framework, member.id, member.ordinal)
          row.koi.set(member.id, koi)
        }
        koi.button.disabled = last
        // why: The pond is never empty, and the panel says so on the control rather than letting a press land on nothing.
        if (last) {
          koi.button.title = 'The pond is never empty.'
        } else {
          koi.button.removeAttribute('title')
        }
        // why: Appending an element already in the list moves it, so the koi stay in seeded order without any of them being rebuilt under a visitor's focus.
        row.instances.append(koi.item)
      }
      row.instances.hidden = members.length === 0
    }

    summary.textContent = `${shoal.roster.length} of ${shoal.cap} koi`
    note.textContent = full ? capReason : `Room for ${shoal.cap - shoal.roster.length} more.`
    applyPresence()
    applyHover()
    restoreFocus(lost)
  }

  /**
   * Opens or closes the body, which is the whole panel once the pond is narrow.
   *
   * @param collapsed - Whether to show the pill alone.
   */
  const setCollapsed = (collapsed: boolean): void => {
    panel.dataset['collapsed'] = collapsed ? 'true' : 'false'
    pill.setAttribute('aria-expanded', collapsed ? 'false' : 'true')
  }

  pill.addEventListener('click', () => {
    setCollapsed(panel.dataset['collapsed'] !== 'true')
  })

  interactions.addEventListener('click', () => {
    hooks.interactions(!interactionsOn)
  })

  root.append(panel)
  render()

  return {
    setShoal(state) {
      shoal = state
      render()
    },
    setPresent(next) {
      present = next
      applyPresence()
    },
    setHovered(next) {
      hovered = next
      applyHover()
    },
    setInteractions(on) {
      interactionsOn = on
      interactions.setAttribute('aria-pressed', on ? 'true' : 'false')
    },
    setFrameWidth(width) {
      // why: A pond that has not been laid out yet reports nothing, and nothing is not evidence of a narrow pond.
      const next = width > 0 && width < PILL_BELOW_PX
      if (next === narrow) {
        return
      }
      narrow = next
      panel.dataset['narrow'] = next ? 'true' : 'false'
      // why: A narrow pond opens as a pill so the water is not buried under its own controls; a pond with room for the panel is never left holding one.
      setCollapsed(next)
    },
  }
}
