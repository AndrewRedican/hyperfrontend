export function isValidSubscriptions(subscriptions: unknown): boolean {
  return subscriptions instanceof WeakMap
}
