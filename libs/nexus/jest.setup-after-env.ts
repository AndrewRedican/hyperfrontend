// Mock random-generators
let globalMockUuidCounter = 0
jest.mock('@hyperfrontend/random-generator-utils', () => ({
  uuidV4: () => {
    globalMockUuidCounter++
    // Use counter in the last 12 characters: each call increments the last digits
    const counterHex = globalMockUuidCounter.toString(16).padStart(12, '0')
    return `12345678-1234-1234-1234-${counterHex}`
  },
  isUuidV4: (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
}))

// Mock immutable-api
jest.mock('@hyperfrontend/immutable-api-utils', () => ({
  locked: () => (target: object, propertyKey: string, descriptor: PropertyDescriptor) => descriptor,
  lockedProps: (target: Record<string, unknown>, properties: [string, unknown][]) => {
    properties.forEach(([key, value]) => {
      target[key] = value
    })
  },
  freeze: (target: object) => target,
}))
