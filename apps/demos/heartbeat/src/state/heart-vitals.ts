import { createMeasuredBpm } from '../rhythm/measured-bpm'

/** The app-wide measured-rate accumulator; every observed beat lands here. */
export const heartVitals = createMeasuredBpm()
