# Network Protocol Dependency Injection - Implementation Todo

## Phase 20.5: Fix Mock Files and tmp/ Directory ✅ COMPLETE

**Mock File Strategy**: Tests need simple test doubles, not full implementations

- [x] Refactor `src/lib/packet/creators/mocks.ts` - remove imports from non-existent paths
- [x] Option A (Recommended): Replace with simple test doubles like `mockEncrypt = async () => new Uint8Array([1,2,3])`
- [x] Option B: Update tests to import from browser/node entry points directly (not in shared mocks)
- [x] Update `src/lib/data/security/mocks.ts` if needed
- [x] Update `src/lib/data/creators/mocks.ts` if needed
- [x] Verify `src/lib/sender/creators/mocks.ts` works
- [x] Verify `src/lib/receiver/creators/mocks.ts` works

**tmp/ Directory Cleanup** (Do last - as final review comparison):

- [x] Move `libs/network-protocol/tmp` to `/workspaces/hyperfrontend/tmp/network-protocol-backup`
- [x] Verify tmp/ tests no longer run with test suite
- [x] Keep as backup during verification phase

**Summary**: All 154 tests passing. Mock files simplified to use test doubles instead of factory implementations.

## Phase 21: Create Test Infrastructure ✅ COMPLETE

- [x] Create `libs/network-protocol/jest.setup.browser.ts` if it doesn't exist
- [x] Configure browser test setup with necessary polyfills
- [x] Open `libs/network-protocol/jest.config.ts`
- [x] Backup existing jest configuration (copy to comment)
- [x] Add projects array configuration
- [x] Configure first project with displayName `network-protocol/node`
- [x] Set testEnvironment to `node` for first project
- [x] Set testMatch to `**/*.spec.ts` for first project
- [x] Set testPathIgnorePatterns to `browser\\.spec\\.ts$` for first project
- [x] Configure second project with displayName `network-protocol/browser`
- [x] Set testEnvironment to `jsdom` for second project
- [x] Set testMatch to `**/*.browser.spec.ts` for second project
- [x] Set setupFilesAfterEnv to `<rootDir>/jest.setup.browser.ts` for second project
- [x] **Fix root cause**: Created `@hyperfrontend/cryptography/common` entry point for platform-agnostic utilities
- [x] **Fix root cause**: Updated `is-valid-schema-hash.ts` to import from `/common` instead of `/browser`

**Summary**: Dual-environment test infrastructure ready. All 154 existing tests passing. Node tests run in Node environment, browser-specific tests will use jsdom.

## Phase 22: Create Test Fixtures ✅ COMPLETE

- [x] Create `src/lib/data/security/test-fixtures.ts`
- [x] Define `encryptionTestCases` array with multiple test scenarios
- [x] Add test case for simple object encryption
- [x] Add test case for nested object encryption
- [x] Add test case for array data encryption
- [x] Add test case for empty object encryption
- [x] Export all test case arrays from test-fixtures.ts
- [x] Create `src/lib/packet/creators/test-fixtures.ts`
- [x] Define packet serialization test cases
- [x] Create `src/lib/packet/security/encryption/test-fixtures.ts`
- [x] Define packet encryption test cases
- [x] Create `src/lib/packet/security/obfuscation/test-fixtures.ts`
- [x] Define packet obfuscation test cases with different refresh rates

**Summary**: All test fixture files created with comprehensive test cases shared between Node.js and browser test suites.

## Phase 23: Create Node Tests for Data Security ✅ COMPLETE

- [x] Create `src/lib/data/security/create-encrypter.spec.ts`
- [x] Import `encrypt` from `@hyperfrontend/cryptography/node`
- [x] Import `createDataEncrypter` from `./create-encrypter`
- [x] Import test fixtures from `./test-fixtures`
- [x] Write describe block for `createDataEncrypter (Node.js)`
- [x] Wire `encryptData` using node encrypt function
- [x] Write test using each test fixture from shared test cases
- [x] Verify output is Uint8Array with length > 0
- [x] Write test for invalid data input (null, undefined, non-object)
- [x] Write test for invalid password (empty string, non-string)
- [x] Write test for unserializable data (circular references)
- [x] Create `src/lib/data/security/create-decrypter.spec.ts`
- [x] Import `decrypt` from `@hyperfrontend/cryptography/node`
- [x] Import `createDataDecrypter` from `./create-decrypter`
- [x] Write describe block for `createDataDecrypter (Node.js)`
- [x] Wire `decryptData` using node decrypt function
- [x] Write round-trip test: encrypt then decrypt and verify original data
- [x] Write test for invalid encrypted data input
- [x] Write test for invalid password on decryption
- [x] Write test for corrupted encrypted data

**Summary**: Node.js tests created with comprehensive coverage including round-trip encryption/decryption and error handling.

## Phase 24: Create Browser Tests for Data Security ✅ COMPLETE

- [x] Create `src/lib/data/security/create-encrypter.browser.spec.ts`
- [x] Import `encrypt` from `@hyperfrontend/cryptography/browser`
- [x] Import `createDataEncrypter` from `./create-encrypter`
- [x] Import shared test fixtures
- [x] Write describe block for `createDataEncrypter (Browser)`
- [x] Wire `encryptData` using browser encrypt function
- [x] Write tests matching Node.js test structure
- [x] Verify browser and node produce functionally equivalent results
- [x] Create `src/lib/data/security/create-decrypter.browser.spec.ts`
- [x] Import `decrypt` from `@hyperfrontend/cryptography/browser`
- [x] Import `createDataDecrypter` from `./create-decrypter`
- [x] Write describe block for `createDataDecrypter (Browser)`
- [x] Wire `decryptData` using browser decrypt function
- [x] Write round-trip test matching Node.js structure
- [x] Write all validation error tests

**Summary**: Browser tests created matching Node.js test structure. Tests are 99% identical (only imports differ). All 178 tests passing. Fixed array validation in `createDataEncrypter` to accept both 'object' and 'array' types.

## Phase 25: Create Node Tests for Data Creators ✅ COMPLETE

- [x] Create `src/lib/data/creators/test-fixtures.ts`
- [x] Define data creator test cases with valid UUIDs
- [x] Create `src/lib/data/creators/create-data-factory.spec.ts`
- [x] Import `createHash` from `@hyperfrontend/cryptography/node`
- [x] Import `createDataFactory` from `./create-data-factory`
- [x] Write describe block for `createDataFactory (Node.js)`
- [x] Wire `createData` using node createHash function
- [x] Write test for creating data with valid payload and schemaHash
- [x] Write test verifying payloadHash is generated correctly
- [x] Write test verifying returned object is frozen
- [x] Write test for invalid payload (null, undefined, non-object)
- [x] Write test for invalid schemaHash (null, undefined, non-string)
- [x] Write test verifying same payload produces same payloadHash

**Summary**: Node.js tests created with comprehensive coverage including schema hash generation, frozen objects, and error handling.

## Phase 26: Create Browser Tests for Data Creators ✅ COMPLETE

- [x] Create `src/lib/data/creators/create-data-factory.browser.spec.ts`
- [x] Import `createHash` from `@hyperfrontend/cryptography/browser`
- [x] Import `createDataFactory` from `./create-data-factory`
- [x] Write describe block for `createDataFactory (Browser)`
- [x] Wire `createData` using browser createHash function
- [x] Write all tests matching Node.js test structure
- [x] Verify browser and node hashes are compatible

**Summary**: Browser tests created matching Node.js test structure. Tests are 99% identical (only imports differ). All 197 tests passing. Fixed message validation to exclude null values from test fixtures.

## Phase 27: Create Node Tests for Packet Creators

- [ ] Create `src/lib/packet/creators/create-serialized-encrypted-packet-creator.spec.ts`
- [ ] Import `uint8ArrayToBase64` from `@hyperfrontend/string-utils/node`
- [ ] Import `createSerializedEncryptedPacketCreator` from `./create-serialized-encrypted-packet-creator`
- [ ] Wire creator using node string conversion function
- [ ] Write test for valid unserialized packet conversion
- [ ] Write test verifying data field is base64 string after serialization
- [ ] Write test for invalid packet input
- [ ] Create `src/lib/packet/creators/create-deserialized-encrypted-packet-creator.spec.ts`
- [ ] Import `base64ToUint8Array` from `@hyperfrontend/string-utils/node`
- [ ] Import `createDeserializedEncryptedPacketCreator` from `./create-deserialized-encrypted-packet-creator`
- [ ] Wire creator using node string conversion function
- [ ] Write round-trip test: serialize then deserialize
- [ ] Write test for invalid packet input
- [ ] Write test for invalid base64 string

## Phase 28: Create Browser Tests for Packet Creators

- [ ] Create `src/lib/packet/creators/create-serialized-encrypted-packet-creator.browser.spec.ts`
- [ ] Import `uint8ArrayToBase64` from `@hyperfrontend/string-utils/browser`
- [ ] Write tests matching Node.js structure using browser implementations
- [ ] Create `src/lib/packet/creators/create-deserialized-encrypted-packet-creator.browser.spec.ts`
- [ ] Import `base64ToUint8Array` from `@hyperfrontend/string-utils/browser`
- [ ] Write round-trip tests matching Node.js structure

## Phase 29: Create Node Tests for Packet Encryption

- [ ] Create `src/lib/packet/security/encryption/create-encrypter.spec.ts`
- [ ] Import `encrypt` from `@hyperfrontend/cryptography/node`
- [ ] Import `createPacketEncrypter` from `./create-encrypter`
- [ ] Wire packet encrypter using node encrypt function
- [ ] Write test for valid serialized encrypted packet encryption
- [ ] Write test verifying output is Uint8Array
- [ ] Write test for invalid packet input
- [ ] Write test for invalid password
- [ ] Create `src/lib/packet/security/encryption/create-decrypter.spec.ts`
- [ ] Import `decrypt` from `@hyperfrontend/cryptography/node`
- [ ] Import `createPacketDecrypter` from `./create-decrypter`
- [ ] Wire packet decrypter using node decrypt function
- [ ] Write round-trip test: encrypt packet then decrypt
- [ ] Write test for invalid encrypted data
- [ ] Write test for invalid password
- [ ] Write test for corrupted encrypted packet

## Phase 30: Create Browser Tests for Packet Encryption

- [ ] Create `src/lib/packet/security/encryption/create-encrypter.browser.spec.ts`
- [ ] Import `encrypt` from `@hyperfrontend/cryptography/browser`
- [ ] Write tests matching Node.js structure using browser encryption
- [ ] Create `src/lib/packet/security/encryption/create-decrypter.browser.spec.ts`
- [ ] Import `decrypt` from `@hyperfrontend/cryptography/browser`
- [ ] Write round-trip tests matching Node.js structure

## Phase 31: Create Node Tests for Packet Obfuscation

- [ ] Create `src/lib/packet/security/obfuscation/create-obfuscator.spec.ts`
- [ ] Import `encrypt`, `getTimeBasedPassword` from `@hyperfrontend/cryptography/node`
- [ ] Import `createPacketObfuscator` from `./create-obfuscator`
- [ ] Wire obfuscator with node implementations and test refresh rate
- [ ] Write test for valid packet obfuscation
- [ ] Write test verifying output is Uint8Array
- [ ] Write test for invalid packet input
- [ ] Write test verifying time-based password is used correctly
- [ ] Create `src/lib/packet/security/obfuscation/create-deobfuscator.spec.ts`
- [ ] Import `decrypt`, `getTimeBasedPasswords` from `@hyperfrontend/cryptography/node`
- [ ] Import `createPacketDeobfuscator` from `./create-deobfuscator`
- [ ] Wire deobfuscator with node implementations and test refresh rate
- [ ] Write round-trip test: obfuscate then deobfuscate immediately
- [ ] Write test for deobfuscation with time interval change
- [ ] Write test for invalid obfuscated data
- [ ] Write test for expired obfuscation (outside valid interval range)

## Phase 32: Create Browser Tests for Packet Obfuscation

- [ ] Create `src/lib/packet/security/obfuscation/create-obfuscator.browser.spec.ts`
- [ ] Import from `@hyperfrontend/cryptography/browser`
- [ ] Write tests matching Node.js structure using browser implementations
- [ ] Create `src/lib/packet/security/obfuscation/create-deobfuscator.browser.spec.ts`
- [ ] Import from `@hyperfrontend/cryptography/browser`
- [ ] Write round-trip and time interval tests matching Node.js structure

## Phase 33: Create Tests for Sender and Receiver

- [ ] Create `src/lib/sender/creators/create-sender-factory.spec.ts` (Node.js)
- [ ] Import packet creator from node/packet
- [ ] Write tests for sender with injected packet creator
- [ ] Verify sender creates properly serialized packets
- [ ] Create `src/lib/sender/creators/create-sender-factory.browser.spec.ts`
- [ ] Import packet creator from browser/packet
- [ ] Write matching tests for browser environment
- [ ] Create `src/lib/receiver/creators/create-receiver-factory.spec.ts` (Node.js)
- [ ] Import packet creator from node/packet
- [ ] Write tests for receiver with injected packet creator
- [ ] Verify receiver deserializes packets correctly
- [ ] Create `src/lib/receiver/creators/create-receiver-factory.browser.spec.ts`
- [ ] Import packet creator from browser/packet
- [ ] Write matching tests for browser environment

## Phase 34: Create Tests for Protocol V1

- [ ] Create `src/lib/protocol/v1/create-protocol-factory.spec.ts` (Node.js)
- [ ] Import all packet security functions from node/packet
- [ ] Wire protocol factory with node implementations
- [ ] Write test for protocol creation with valid parameters
- [ ] Write test for protocol encryption/decryption flow
- [ ] Write test for protocol obfuscation/deobfuscation flow
- [ ] Write integration test combining all security layers
- [ ] Create `src/lib/protocol/v1/create-protocol-factory.browser.spec.ts`
- [ ] Import all packet security functions from browser/packet
- [ ] Write matching tests for browser environment
- [ ] Verify browser and node protocols are interoperable

## Phase 35: Documentation and Cleanup

- [ ] Clean up any remaining TODOs in code
- [ ] Remove tmp/ backup directory after full verification
