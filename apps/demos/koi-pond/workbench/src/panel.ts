/**
 * A minimal control panel, built here rather than pulled in.
 *
 * The workbench needs perhaps sixty live controls in eight groups, all reading
 * and writing straight through to the koi. That is a couple of hundred lines of
 * DOM against a dependency, a bundle and a styling fight — and this way every
 * control is a plain accessor pair, so adding one when the koi grows a new knob
 * is a single line.
 *
 * Nothing here reaches into the koi library. Controls are handed getters and
 * setters by the caller, which is what keeps the panel from leaking into
 * production code.
 */

/** One live control in the panel. */
export type Control =
  | {
      /** A number dragged on a range input. */
      kind: 'slider'
      /** What the control is called. */
      label: string
      /** Lowest value it offers. */
      min: number
      /** Highest value it offers. */
      max: number
      /** How finely it moves. */
      step: number
      /** Reads the current value. */
      get: () => number
      /** Writes a new value. */
      set: (value: number) => void
    }
  | {
      /** A colour picked from a swatch. */
      kind: 'colour'
      /** What the control is called. */
      label: string
      /** Reads the current `#rrggbb`. */
      get: () => string
      /** Writes a new `#rrggbb`. */
      set: (value: string) => void
    }
  | {
      /** One choice from a fixed list. */
      kind: 'select'
      /** What the control is called. */
      label: string
      /** The choices on offer. */
      options: readonly string[]
      /** Reads the current choice. */
      get: () => string
      /** Writes a new choice. */
      set: (value: string) => void
    }
  | {
      /** An on-off switch. */
      kind: 'toggle'
      /** What the control is called. */
      label: string
      /** Reads whether it is on. */
      get: () => boolean
      /** Turns it on or off. */
      set: (value: boolean) => void
    }
  | {
      /** A one-shot action. */
      kind: 'button'
      /** What the control is called. */
      label: string
      /** What pressing it does. */
      run: () => void
    }

/** A named group of controls. */
export interface ControlGroup {
  /** What the group is called. */
  title: string
  /** Whether it starts folded away. */
  folded?: boolean
  /** The controls it holds. */
  controls: readonly Control[]
}

/** The rendered panel. */
export interface ControlPanel {
  /** The element to place in the page. */
  readonly element: HTMLElement
  /** Re-reads every control's value, after something else changed them. */
  refresh(): void
}

/**
 * Renders one control and returns the function that re-reads it.
 *
 * @param control - The control to render.
 * @param row - The row to render into.
 * @param onChange - Called after any control writes, so siblings can re-read.
 * @returns A function that pulls the control's value back out of its source.
 */
function renderControl(control: Control, row: HTMLElement, onChange: () => void): () => void {
  if (control.kind === 'button') {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'wb-button'
    button.textContent = control.label
    button.addEventListener('click', () => {
      control.run()
      onChange()
    })
    row.append(button)
    return () => undefined
  }

  const label = document.createElement('label')
  label.className = 'wb-label'
  label.textContent = control.label
  row.append(label)

  if (control.kind === 'slider') {
    const input = document.createElement('input')
    input.type = 'range'
    input.min = String(control.min)
    input.max = String(control.max)
    input.step = String(control.step)
    const readout = document.createElement('output')
    readout.className = 'wb-readout'
    const show = (value: number): void => {
      readout.textContent = control.step >= 1 ? value.toFixed(0) : value.toFixed(control.step >= 0.01 ? 2 : 3)
    }
    input.addEventListener('input', () => {
      control.set(input.valueAsNumber)
      show(input.valueAsNumber)
      onChange()
    })
    row.append(input, readout)
    return () => {
      input.value = String(control.get())
      show(control.get())
    }
  }

  if (control.kind === 'colour') {
    const input = document.createElement('input')
    input.type = 'color'
    input.addEventListener('input', () => {
      control.set(input.value)
      onChange()
    })
    row.append(input)
    return () => {
      input.value = control.get()
    }
  }

  if (control.kind === 'select') {
    const select = document.createElement('select')
    for (const option of control.options) {
      const item = document.createElement('option')
      item.value = option
      item.textContent = option
      select.append(item)
    }
    select.addEventListener('change', () => {
      control.set(select.value)
      onChange()
    })
    row.append(select)
    return () => {
      select.value = control.get()
    }
  }

  const input = document.createElement('input')
  input.type = 'checkbox'
  input.addEventListener('change', () => {
    control.set(input.checked)
    onChange()
  })
  row.append(input)
  return () => {
    input.checked = control.get()
  }
}

/**
 * Builds the panel from a list of groups.
 *
 * @param groups - The groups to render, in order.
 * @returns The panel, already showing every control's current value.
 *
 * @example Wiring one knob
 * ```typescript
 * const panel = createControlPanel([
 *   { title: 'Geometry', controls: [{ kind: 'slider', label: 'Body width', min: 0.6, max: 1.6, step: 0.01, get: () => koi.config.physical.width, set: (v) => koi.setPhysical({ width: v }) }] },
 * ])
 * ```
 */
export function createControlPanel(groups: readonly ControlGroup[]): ControlPanel {
  const element = document.createElement('aside')
  element.className = 'wb-panel'
  const readers: (() => void)[] = []
  const refresh = (): void => {
    for (const read of readers) {
      read()
    }
  }

  for (const group of groups) {
    const section = document.createElement('details')
    section.className = 'wb-group'
    section.open = group.folded !== true
    const summary = document.createElement('summary')
    summary.textContent = group.title
    section.append(summary)

    for (const control of group.controls) {
      const row = document.createElement('div')
      row.className = `wb-row wb-row-${control.kind}`
      readers.push(renderControl(control, row, refresh))
      section.append(row)
    }

    element.append(section)
  }

  refresh()
  return { element, refresh }
}
