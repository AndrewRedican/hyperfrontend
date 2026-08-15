import type { KoiCardDetails } from '../card.js'
import { describe, expect, it } from 'vitest'
import { describeKoiCard } from '../card.js'

/** A held koi cruising mid-pond with everything measurable. */
const DETAILS: KoiCardDetails = {
  held: false,
  phase: 'relaxed',
  speedBL: 0.42,
  neighbours: 2,
  hosted: true,
  origin: 'same-origin',
  uptimeS: 192,
  fps: 59.6,
  memoryBytes: 18.4 * 1024 * 1024,
  memoryState: 'measured',
  lastEvent: { kind: 'disturbance', ageS: 1.23 },
}

describe('describeKoiCard', () => {
  it('tells the behaviour in card words', () => {
    expect(describeKoiCard(DETAILS).state).toBe('Cruising · 0.4 L/s · 2 neighbours')
  })

  it('counts a lone neighbour in the singular', () => {
    expect(describeKoiCard({ ...DETAILS, neighbours: 1 }).state).toContain('1 neighbour')
    expect(describeKoiCard({ ...DETAILS, neighbours: 1 }).state).not.toContain('neighbours')
  })

  it('tells the runtime story with origin, uptime and rate', () => {
    expect(describeKoiCard(DETAILS).runtime).toBe('Embedded · same-origin · up 3m 12s · 60 fps')
  })

  it('leaves origin and rate out when they are unknown', () => {
    expect(describeKoiCard({ ...DETAILS, hosted: false, origin: null, fps: null }).runtime).toBe('Standalone · up 3m 12s')
  })

  it('rounds measured memory to a modest claim', () => {
    expect(describeKoiCard(DETAILS).memory).toBe('Memory · ~18.4 MB')
  })

  it('is honest when the browser cannot attribute memory', () => {
    expect(describeKoiCard({ ...DETAILS, memoryBytes: null, memoryState: 'unavailable' }).memory).toBe('Memory · unavailable')
  })

  it('shows the measurement still settling', () => {
    expect(describeKoiCard({ ...DETAILS, memoryBytes: null, memoryState: 'pending' }).memory).toBe('Memory · measuring…')
  })

  it('ages the last event and calls the freshest now', () => {
    expect(describeKoiCard(DETAILS).event).toBe('Last event · disturbance · 1.2s ago')
    expect(describeKoiCard({ ...DETAILS, lastEvent: { kind: 'place', ageS: 0.2 } }).event).toBe('Last event · place · now')
  })

  it('holds the event line back until something has happened', () => {
    expect(describeKoiCard({ ...DETAILS, lastEvent: null }).event).toBeNull()
  })

  it('tells a held koi as held rather than a stale phase', () => {
    expect(describeKoiCard({ ...DETAILS, held: true }).state).toBe('Held · sculling · 2 neighbours')
  })

  it('names every phase a body can read in', () => {
    expect(describeKoiCard({ ...DETAILS, phase: 'escape' }).state).toContain('Fleeing')
    expect(describeKoiCard({ ...DETAILS, phase: 'turning' }).state).toContain('Turning')
    expect(describeKoiCard({ ...DETAILS, phase: 'depth-transition' }).state).toContain('Changing depth')
  })
})
