/**
 * Lifecycle-aware component with initialization, ready, starting, stopping, and active callbacks.
 *
 * @module @hyperfrontend/state-machine/lifecycle-aware-component
 */
export type {
  InitializingChangeCallback,
  ReadyChangeCallback,
  StartingChangeCallback,
  StoppingChangeCallback,
  ActiveChangeCallback,
} from './lifecycle-aware-component.model'
export { LifecycleAwareComponent } from './lifecycle-aware-component'
