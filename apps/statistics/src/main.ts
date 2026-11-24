/**
 * Serves the npm download history of the published packages, collected from npm on a schedule.
 *
 * @module service-statistics
 */

import { runService } from '@hyperfrontend/server'
import { service } from './service'

void runService(service)
