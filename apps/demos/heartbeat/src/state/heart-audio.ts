import { createHeartbeatAudio } from '../audio/heartbeat-audio'

/** The app-wide heartbeat sound engine; silent until a user action enables it. */
export const heartAudio = createHeartbeatAudio()
