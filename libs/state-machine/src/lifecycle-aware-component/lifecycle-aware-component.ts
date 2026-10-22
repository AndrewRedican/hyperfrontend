/* lint-disable typescript/no-explicit-any */
import type {
  InitializingChangeCallback,
  ReadyChangeCallback,
  StartingChangeCallback,
  StoppingChangeCallback,
  ActiveChangeCallback,
  Process,
} from './lifecycle-aware-component.model'
import { callStack } from '../call-stack/call-stack'

/**
 * Abstract base class for components that need lifecycle state management.
 * Tracks initializing, ready, starting, stopping, and active states.
 *
 * @example Extending LifecycleAwareComponent
 * ```typescript
 * class MyService extends LifecycleAwareComponent {
 *   async doInit() { this.setInitializing(true) }
 *   async doStart() { this.setActive(true) }
 * }
 * ```
 */
export abstract class LifecycleAwareComponent {
  private _initializing = false
  private _ready = false
  private _starting = false
  private _stopping = false
  private _active = false
  private readonly initializingCallstack = callStack<InitializingChangeCallback>()
  private readonly readyCallstack = callStack<ReadyChangeCallback>()
  private readonly startingCallstack = callStack<StartingChangeCallback>()
  private readonly stoppingCallstack = callStack<StoppingChangeCallback>()
  private readonly activeCallstack = callStack<ActiveChangeCallback>()

  /**
   * Whether the component is still being initialized.
   *
   * @returns `true` while initialization is under way, `false` before it begins and once it finishes
   */
  public get initializing(): boolean {
    return !!this._initializing
  }

  /**
   * Whether the component has finished initializing and can be started.
   *
   * @returns `true` once `setReady(true)` has been called and not reversed since
   */
  public get ready(): boolean {
    return !!this._ready
  }

  /**
   * Whether the component is in the middle of starting.
   *
   * @returns `true` from the start being requested until the subclass reports it complete
   */
  public get starting(): boolean {
    return !!this._starting
  }

  /**
   * Whether the component is in the middle of stopping.
   *
   * @returns `true` from the stop being requested until the subclass reports it complete
   */
  public get stopping(): boolean {
    return !!this._stopping
  }

  /**
   * Whether the component has started and is running.
   *
   * @returns `true` once a start completes, `false` again once the component stops
   */
  public get active(): boolean {
    return !!this._active
  }

  /**
   * Records whether initialization is under way and notifies the initializing callbacks.
   *
   * Setting the value the flag already holds changes nothing and notifies nobody, so the
   * callbacks fire only on a real transition.
   *
   * @param initializing - The new value of the flag
   */
  protected setInitializing(initializing: boolean): void {
    if (this.initializing === initializing) {
      return
    }
    this._initializing = initializing
    this.initializingCallstack.call(false, this.initializing)
  }

  /**
   * Records whether the component is ready to start and notifies the ready callbacks.
   *
   * Setting the value the flag already holds changes nothing and notifies nobody.
   *
   * @param ready - The new value of the flag
   */
  protected setReady(ready: boolean): void {
    if (this.ready === ready) {
      return
    }
    this._ready = ready
    this.readyCallstack.call(false, this.ready)
  }

  /**
   * Records whether a start is under way and notifies the starting callbacks.
   *
   * Setting the value the flag already holds changes nothing and notifies nobody.
   *
   * @param starting - The new value of the flag
   */
  protected setStarting(starting: boolean): void {
    if (this.starting === starting) {
      return
    }
    this._starting = starting
    this.startingCallstack.call(false, this.starting)
  }

  /**
   * Records whether a stop is under way and notifies the stopping callbacks.
   *
   * Setting the value the flag already holds changes nothing and notifies nobody.
   *
   * @param stopping - The new value of the flag
   */
  protected setStopping(stopping: boolean): void {
    if (this.stopping === stopping) {
      return
    }
    this._stopping = stopping
    this.stoppingCallstack.call(false, this.stopping)
  }

  /**
   * Records whether the component is running and notifies the active callbacks.
   *
   * Setting the value the flag already holds changes nothing and notifies nobody.
   *
   * @param active - The new value of the flag
   */
  protected setActive(active: boolean): void {
    if (this.active === active) {
      return
    }
    this._active = active
    this.activeCallstack.call(false, this.active)
  }

  /**
   * Registers a callback for changes to the initializing flag.
   *
   * If the component is initializing at the time, the callback is invoked at once with
   * `true`, so a late subscriber learns the current phase instead of waiting for the next
   * change. A callback already registered is not added a second time.
   *
   * @param callback - Called with the flag's new value on every change
   * @returns This component, so registrations can be chained
   */
  public onInitializingStatusChange(callback: InitializingChangeCallback): typeof this {
    this.initializingCallstack.add(callback)
    if (this.initializing) {
      callback(this.initializing)
    }
    return this
  }

  /**
   * Registers a callback for changes to the ready flag.
   *
   * If the component is already ready, the callback is invoked at once with `true`. A
   * callback already registered is not added a second time.
   *
   * @param callback - Called with the flag's new value on every change
   * @returns This component, so registrations can be chained
   */
  public onReadyStatusChange(callback: ReadyChangeCallback): typeof this {
    this.readyCallstack.add(callback)
    if (this.ready) {
      callback(this.ready)
    }
    return this
  }

  /**
   * Registers a callback for changes to the starting flag.
   *
   * If a start is under way at the time, the callback is invoked at once with `true`. A
   * callback already registered is not added a second time.
   *
   * @param callback - Called with the flag's new value on every change
   * @returns This component, so registrations can be chained
   */
  public onStartStatusChange(callback: StartingChangeCallback): typeof this {
    this.startingCallstack.add(callback)
    if (this.starting) {
      callback(this.starting)
    }
    return this
  }

  /**
   * Registers a callback for changes to the stopping flag.
   *
   * If a stop is under way at the time, the callback is invoked at once with `true`. A
   * callback already registered is not added a second time.
   *
   * @param callback - Called with the flag's new value on every change
   * @returns This component, so registrations can be chained
   */
  public onStopStatusChange(callback: StoppingChangeCallback): typeof this {
    this.stoppingCallstack.add(callback)
    if (this.stopping) {
      callback(this.stopping)
    }
    return this
  }

  /**
   * Registers a callback for changes to the active flag.
   *
   * If the component is already running, the callback is invoked at once with `true`. A
   * callback already registered is not added a second time.
   *
   * @param callback - Called with the flag's new value on every change
   * @returns This component, so registrations can be chained
   */
  public onActiveStatusChange(callback: ActiveChangeCallback): typeof this {
    this.activeCallstack.add(callback)
    if (this.active) {
      callback(this.active)
    }
    return this
  }

  /**
   * Removes every registered status callback across all five flags.
   *
   * The flags themselves keep their values; only the subscriptions go, so a component can
   * be reused without carrying listeners from its previous owner.
   */
  public clear(): void {
    this.activeCallstack.clear()
    this.startingCallstack.clear()
    this.stoppingCallstack.clear()
    this.readyCallstack.clear()
    this.initializingCallstack.clear()
  }

  /**
   * Brings the component to the ready phase.
   *
   * An implementation raises `initializing` while it works and `ready` when it finishes, and
   * resolves to the status the run ended with: `success`, `fail` or `skipped`. The base class
   * never calls it, so the subclass decides when initialization happens.
   */
  protected abstract init: Process<any>

  /**
   * Starts the component once it is ready.
   *
   * An implementation raises `starting` while it works and `active` once running, and resolves
   * to the status the run ended with: `success`, `fail` or `skipped`. The base class only
   * tracks the flags.
   */
  public abstract start: Process<any>

  /**
   * Stops a running component.
   *
   * An implementation raises `stopping` while it works and lowers `active` once stopped, and
   * resolves to the status the run ended with: `success`, `fail` or `skipped`. The base class
   * only tracks the flags.
   */
  public abstract stop: Process<any>
}
