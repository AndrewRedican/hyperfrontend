import { createRhythmEngine } from '../rhythm/rhythm-engine'

/** The app's single rhythm engine, shared by the React UI and the contract wiring. */
export const heartRhythm = createRhythmEngine()
