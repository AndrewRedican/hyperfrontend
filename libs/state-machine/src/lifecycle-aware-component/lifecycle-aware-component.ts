/* eslint-disable @typescript-eslint/no-explicit-any */
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

  public get initializing(): boolean {
    return !!this._initializing
  }

  public get ready(): boolean {
    return !!this._ready
  }

  public get starting(): boolean {
    return !!this._starting
  }

  public get stopping(): boolean {
    return !!this._stopping
  }

  public get active(): boolean {
    return !!this._active
  }

  protected setInitializing(initializing: boolean): void {
    if (this.initializing === initializing) {
      return
    }
    this._initializing = initializing
    this.initializingCallstack.call(false, this.initializing)
  }

  protected setReady(ready: boolean): void {
    if (this.ready === ready) {
      return
    }
    this._ready = ready
    this.readyCallstack.call(false, this.ready)
  }

  protected setStarting(starting: boolean): void {
    if (this.starting === starting) {
      return
    }
    this._starting = starting
    this.startingCallstack.call(false, this.starting)
  }

  protected setStopping(stopping: boolean): void {
    if (this.stopping === stopping) {
      return
    }
    this._stopping = stopping
    this.stoppingCallstack.call(false, this.stopping)
  }

  protected setActive(active: boolean): void {
    if (this.active === active) {
      return
    }
    this._active = active
    this.activeCallstack.call(false, this.active)
  }

  public onInitializingStatusChange(callback: InitializingChangeCallback): typeof this {
    this.initializingCallstack.add(callback)
    if (this.initializing) {
      this.initializingCallstack.call(false, this.initializing)
    }
    return this
  }

  public onReadyStatusChange(callback: ReadyChangeCallback): typeof this {
    this.readyCallstack.add(callback)
    if (this.ready) {
      this.readyCallstack.call(false, this.ready)
    }
    return this
  }

  public onStartStatusChange(callback: StartingChangeCallback): typeof this {
    this.startingCallstack.add(callback)
    if (this.starting) {
      this.startingCallstack.call(false, this.starting)
    }
    return this
  }

  public onStopStatusChange(callback: StoppingChangeCallback): typeof this {
    this.stoppingCallstack.add(callback)
    if (this.stopping) {
      this.stoppingCallstack.call(false, this.stopping)
    }
    return this
  }

  public onActiveStatusChange(callback: ActiveChangeCallback): typeof this {
    this.activeCallstack.add(callback)
    if (this.active) {
      this.activeCallstack.call(false, this.active)
    }
    return this
  }

  public clear(): void {
    this.activeCallstack.clear()
    this.startingCallstack.clear()
    this.stoppingCallstack.clear()
    this.readyCallstack.clear()
    this.initializingCallstack.clear()
  }

  protected abstract init: Process<any>

  public abstract start: Process<any>

  public abstract stop: Process<any>
}
