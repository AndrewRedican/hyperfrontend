/**
 * Provider-agnostic consent model for optional measurement.
 *
 * Three categories: `necessary` (always on — it covers only the storage the
 * site needs to function, including remembering this very preference),
 * `analytics`, and `advertising`. Optional categories default to denied
 * everywhere — the model is deliberately global and conservative, because no
 * reliable region-resolution mechanism exists and browser locale is not a
 * legal jurisdiction. Persistence is a single localStorage key holding the
 * choice and when it was made — the minimum needed to remember a decision.
 * Nothing in this module knows about Google; tag vendors adapt on top.
 */
import { createDate } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/** The consent categories the site distinguishes. */
export type ConsentCategory = 'necessary' | 'analytics' | 'advertising'

/** A visitor's choice over the optional categories. */
export interface ConsentChoices {
  /** Whether analytics measurement may run. */
  analytics: boolean
  /** Whether advertising measurement may run. */
  advertising: boolean
}

/** The persisted decision: the choices plus when they were made. */
export interface StoredConsent extends ConsentChoices {
  /** Schema version of the persisted value. */
  version: 1
  /** ISO timestamp of the decision, for auditability and future expiry policies. */
  decidedAt: string
}

/** The single localStorage key holding the consent decision. */
export const CONSENT_STORAGE_KEY = 'hf-consent'

/** The storage slice the store needs — `localStorage`-shaped, injectable for tests. */
export interface ConsentStorage {
  /** Reads a stored value. */
  getItem(key: string): string | null
  /** Writes a stored value. */
  setItem(key: string, value: string): void
  /** Removes a stored value. */
  removeItem(key: string): void
}

/**
 * Parses and validates a persisted consent value.
 *
 * @param raw - The raw string from storage, or `null`.
 * @returns The stored decision, or `null` when absent or malformed.
 */
export function parseStoredConsent(raw: string | null): StoredConsent | null {
  if (raw === null) {
    return null
  }
  let candidate: unknown
  try {
    candidate = parse(raw)
  } catch {
    return null
  }
  if (typeof candidate !== 'object' || candidate === null) {
    return null
  }
  const record = candidate as Record<string, unknown>
  if (
    record['version'] !== 1 ||
    typeof record['analytics'] !== 'boolean' ||
    typeof record['advertising'] !== 'boolean' ||
    typeof record['decidedAt'] !== 'string'
  ) {
    return null
  }
  return {
    version: 1,
    analytics: record['analytics'],
    advertising: record['advertising'],
    decidedAt: record['decidedAt'],
  }
}

/** The consent store: reads, records, and broadcasts the visitor's decision. */
export interface ConsentStore {
  /** Returns the stored decision, or `null` while none has been made. */
  getDecision(): StoredConsent | null
  /** Reports whether the visitor has decided at all. */
  hasDecision(): boolean
  /**
   * Reports whether a category is currently granted. `necessary` is always
   * granted; optional categories are denied until a decision grants them.
   *
   * @param category - The category to check.
   * @returns `true` when the category may operate.
   */
  isGranted(category: ConsentCategory): boolean
  /**
   * Records a decision over the optional categories.
   *
   * @param choices - The visitor's choices.
   * @returns The stored decision.
   */
  decide(choices: ConsentChoices): StoredConsent
  /** Withdraws optional consent: records a decision denying both optional categories. */
  withdrawOptional(): StoredConsent
  /**
   * Subscribes to decision changes.
   *
   * @param listener - Invoked after every recorded decision.
   * @returns A function that removes the subscription.
   */
  subscribe(listener: () => void): () => void
}

/**
 * Creates a consent store over a storage backend.
 *
 * @param storage - The persistence backend, or `null` to keep decisions in memory only (SSR, tests).
 * @param now - Clock source for `decidedAt`; defaults to `Date`.
 * @returns The {@link ConsentStore}.
 */
export function createConsentStore(storage: ConsentStorage | null, now: () => string = () => createDate().toISOString()): ConsentStore {
  let decision: StoredConsent | null = parseStoredConsent(storage?.getItem(CONSENT_STORAGE_KEY) ?? null)
  const listeners = createSet<() => void>()

  const record = (choices: ConsentChoices): StoredConsent => {
    decision = { version: 1, analytics: choices.analytics, advertising: choices.advertising, decidedAt: now() }
    try {
      storage?.setItem(CONSENT_STORAGE_KEY, stringify(decision))
    } catch {
      // why: A full or blocked storage must not break the page — the decision still applies for this visit.
    }
    for (const listener of listeners) {
      listener()
    }
    return decision
  }

  return {
    getDecision: () => decision,
    hasDecision: () => decision !== null,
    isGranted(category) {
      if (category === 'necessary') {
        return true
      }
      return decision === null ? false : decision[category]
    },
    decide: (choices) => record(choices),
    withdrawOptional: () => record({ analytics: false, advertising: false }),
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/**
 * Resolves the browser's localStorage, tolerating storage-denied contexts.
 *
 * @returns The storage backend, or `null` outside the browser or when access throws.
 */
function browserStorage(): ConsentStorage | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** The site-wide consent store, bound to the browser's localStorage. */
export const consentStore = createConsentStore(browserStorage())
