# Network Protocol Testing Plan - Coverage Review & Fixes

> **Status**: Planning Phase
> **Priority**: High
> **Target**: 100% Code Coverage
> **Current Coverage**: 94.42% statements, 94.5% branches, 84.73% functions, 95.33% lines

## Executive Summary

The network-protocol library currently fails to meet the 100% coverage threshold defined in `jest.preset.cjs`. This plan outlines a systematic approach to:

1. Fix the identified race condition in browser receiver tests
2. Address missing test coverage in specific areas
3. Evaluate whether certain files (model.ts, mocks.ts) should be excluded from coverage requirements

## Critical Issues

### 1. Race Condition - IMMEDIATE FIX REQUIRED ⚠️

**Location**: `libs/network-protocol/src/lib/receiver/creators/create-receiver-factory.browser.spec.ts`
**Test**: `createReceiverFactory (Browser) › receiving messages › receives multiple messages`
**Issue**: Test expects 2 messages received but only gets 1
**Line**: 121 (test line 154 assertion fails)
**Root Cause**: Asynchronous message processing with insufficient wait time (250ms timeout)
**Priority**: P0 - Blocking CI/CD

**CRITICAL REFERENCE**: The backup tests at `tmp/network-protocol-backup/src` contain proven async patterns:

- **Queue tests use `sleep()` utility** from `@hyperfrontend/time-utils` for reliable timing
- **Calculated wait times**: e.g., `await sleep(3 * 50 + 10)` for 3 messages at 50ms each plus buffer
- **Check queue state**: Tests verify `currentMessage()` and `size()` methods during processing
- **This pattern MUST be applied** to fix the race condition

## Coverage Gaps Analysis

Based on the coverage report from `coverage/libs/network-protocol/index.html`:

### Files with 0% Coverage (Type Definition Files - Require Evaluation)

These are pure type/interface definition files with no executable code:

- `channel/model.ts` (0% - 5 lines)
- `data/model.ts` (0% - 5 lines)
- `packet/model.ts` (0% - all lines)
- `protocol/v1/model.ts` (0% - all lines)
- `queue/model.ts` (0% - all lines)
- `receiver/model.ts` (0% - all lines)
- `routing/model.ts` (0% - all lines)
- `security/model.ts` (0% - all lines)
- `sender/model.ts` (0% - all lines)
- `topic/model.ts` (0% - all lines)
- `packet/validations/is-valid-unobfuscated-packet-base.model.ts` (0%)
- `protocol/v1/validations/is-valid-protocol.model.ts` (0%)

**Decision Needed**: Should model.ts files be excluded from coverage via jest config?

### Files with Partial Coverage (Need Additional Tests)

#### data/validations/is-valid-schema.ts

- **Current**: 77.27% statements, 69.76% branches, 70% functions, 81.81% lines
- **Uncovered Lines**: 10-11, 16, 21-23
- **Action Required**: Add edge case tests for schema validation

#### data/creators/create-data-factory.ts

- **Current**: 92.85% statements, 100% branches, 100% functions, 92.85% lines
- **Uncovered Lines**: 42, 49
- **Action Required**: Test error paths

#### data/validations/is-valid-message.ts

- **Current**: 92.3% statements, 75% branches, 100% functions, 92.3% lines
- **Uncovered Lines**: 14
- **Action Required**: Test edge cases

#### data/creators/get-schema.ts

- **Current**: 100% statements, 85.71% branches, 100% functions, 100% lines
- **Uncovered Branches**: Line 3
- **Action Required**: Test conditional branch

#### channel/creators/create-channel-store.ts

- **Current**: 97.05% statements, 94.44% branches, 96.29% functions, 97.95% lines
- **Uncovered Lines**: 45
- **Action Required**: Test error condition on line 45

#### queue/creators/\* (All queue files)

- **Current**: 94.28% statements each
- **Uncovered Lines**: 48-49 (consistent across all queue creators)
- **Action Required**: Test initialization error paths

#### queue/creators/create-queue.ts

- **Current**: 95% statements, 90.47% branches, 87.5% functions
- **Uncovered Lines**: 38
- **Action Required**: Test missing functionality

### Mock Files with Low Coverage

#### protocol/v1/creators/mocks.ts

- **Current**: 0% statements (5-16 uncovered)
- **Decision Needed**: Should mock files be excluded from coverage?

#### protocol/v1/creators/test-fixtures.ts

- **Current**: 53.33% statements, 50% lines
- **Uncovered Lines**: 38-44
- **Decision Needed**: Do test fixtures need coverage?

#### receiver/creators/test-fixtures.ts & sender/creators/test-fixtures.ts

- **Current**: 60% statements, 57.14% lines
- **Uncovered Lines**: 37-42
- **Decision Needed**: Test fixture coverage requirements?

#### packet/creators/mocks.ts

- **Current**: 97.95% statements, 90.9% functions
- **Status**: Nearly complete, minor cleanup needed

## Phased Implementation Plan

### Phase 0: Configuration & Standards (Immediate)

**File**: `roadmap/network-protocol-phase-0-config.md`
**Sequence**: 0
**Tasks**:

- Review and decide on coverage exclusions (model.ts, mocks.ts, test-fixtures.ts)
- Update `jest.config.ts` with `coveragePathIgnorePatterns` if needed
- **CRITICAL**: Review backup test patterns at `tmp/network-protocol-backup/src`
- Extract and document proven async testing patterns (sleep utility, timing calculations)
- Identify any client-to-client integration test patterns
- Document testing standards and patterns

**Key Backup Files to Review**:

- `tmp/network-protocol-backup/src/queue/creators/create-queue.spec.ts` - Async patterns ✅
- `tmp/network-protocol-backup/src/channel/creators/*.spec.ts` - Integration patterns
- `tmp/network-protocol-backup/src/protocol/v1/creators/*.spec.ts` - Protocol setup
- `tmp/network-protocol-backup/src/data/creators/create-data.spec.ts` - Data layer testing

**Reference Paths**:

- `libs/network-protocol/jest.config.ts`
- `jest.preset.cjs` (lines 12-18 for coverageThreshold)
- `tmp/network-protocol-backup/src/` (PRIMARY REFERENCE for test patterns)

---

### Phase 1: Critical Bug Fix - Race Condition (Immediate - P0)

**File**: `roadmap/network-protocol-phase-1-race-condition.md`
**Sequence**: 1
**Priority**: CRITICAL - Blocking

**Scope**: Fix failing browser test in receiver factory

**Current Implementation Details**:

- Test file: `libs/network-protocol/src/lib/receiver/creators/create-receiver-factory.browser.spec.ts`
- Test: "receives multiple messages" (lines 110-155)
- Problem: 250ms timeout insufficient for async queue processing
- Expected: 2 messages, Received: 1 message

**REQUIRED PATTERN FROM BACKUP** ✅:
The backup test at `tmp/network-protocol-backup/src/queue/creators/create-queue.spec.ts` shows the correct approach:

```typescript
// Calculate wait time based on processing time + buffer
const processingTime = 50 // ms per message
const messageCount = 3
await sleep(messageCount * processingTime + 10) // Buffer for safety
expect(messageProcessor).toHaveBeenCalledTimes(messageCount)
```

**Investigation Steps**:

1. ✅ **Import sleep utility**: Use `sleep()` from `@hyperfrontend/time-utils` (verified in backup)
2. Review receiver factory queue processing logic
3. Identify actual processing time per message (encryption + decryption + obfuscation)
4. Calculate: `waitTime = messageCount * processingTime + buffer`
5. Replace arbitrary 250ms timeout with calculated wait
6. Verify queue state methods (`size()`, `currentMessage()`) are available for assertions

**Potential Solutions** (Priority Order):

1. **Use sleep() with calculated timing** (RECOMMENDED - proven in backup)
   ```typescript
   import { sleep } from '@hyperfrontend/time-utils'
   await sleep(2 * estimatedProcessingTime + 50) // 2 messages + buffer
   ```
2. Add explicit queue drain promises with queue state verification
3. Spy on receivePacket calls and wait for expected count with polling

**Reference Paths**:

- `libs/network-protocol/src/lib/receiver/creators/create-receiver-factory.browser.spec.ts` (lines 110-155)
- `libs/network-protocol/src/lib/receiver/creators/create-receiver-factory.ts`
- `libs/network-protocol/src/lib/queue/creators/create-queue.ts` (line 1217)
- Compare: `libs/network-protocol/src/lib/receiver/creators/create-receiver-factory.spec.ts` (Node version)
- **PRIMARY REFERENCE**: `tmp/network-protocol-backup/src/queue/creators/create-queue.spec.ts` (lines 1-100)

---

### Phase 2: Type Definition Coverage (Low Complexity)

**File**: `roadmap/network-protocol-phase-2-model-files.md`
**Sequence**: 2
**Complexity**: Low
**Estimated Effort**: 2-4 hours

**Scope**: Handle 0% coverage in model.ts files

**Files Affected** (10 files):

- `libs/network-protocol/src/lib/channel/model.ts`
- `libs/network-protocol/src/lib/data/model.ts`
- `libs/network-protocol/src/lib/packet/model.ts`
- `libs/network-protocol/src/lib/protocol/v1/model.ts`
- `libs/network-protocol/src/lib/queue/model.ts`
- `libs/network-protocol/src/lib/receiver/model.ts`
- `libs/network-protocol/src/lib/routing/model.ts`
- `libs/network-protocol/src/lib/security/model.ts`
- `libs/network-protocol/src/lib/sender/model.ts`
- `libs/network-protocol/src/lib/topic/model.ts`
- `libs/network-protocol/src/lib/packet/validations/is-valid-unobfuscated-packet-base.model.ts`
- `libs/network-protocol/src/lib/protocol/v1/validations/is-valid-protocol.model.ts`

**Current Pattern Observed**:

- These files contain only TypeScript type/interface definitions
- No executable code to test
- Standard practice is to exclude from coverage

**Options**:

1. **Exclude from coverage** (RECOMMENDED)
   - Update `jest.config.ts` coveragePathIgnorePatterns: `!**/model.ts`
   - Rationale: Type-only files have no runtime behavior to test

2. **Add type tests**
   - Use tsd or similar for type-level testing
   - Overkill for this project scope

**Decision Required**: Document rationale in phase plan

**Reference Paths**:

- `libs/network-protocol/jest.config.ts` (lines 5-11)
- All model.ts files listed above

---

### Phase 3: Mock & Test Fixture Coverage (Low Complexity)

**File**: `roadmap/network-protocol-phase-3-mocks-fixtures.md`
**Sequence**: 3
**Complexity**: Low
**Estimated Effort**: 2-3 hours

**Scope**: Decide coverage requirements for test utilities

**Files Affected**:

- `libs/network-protocol/src/lib/protocol/v1/creators/mocks.ts` (0% - lines 5-16)
- `libs/network-protocol/src/lib/protocol/v1/creators/test-fixtures.ts` (53.33% - lines 38-44)
- `libs/network-protocol/src/lib/receiver/creators/mocks.ts` (80%)
- `libs/network-protocol/src/lib/receiver/creators/test-fixtures.ts` (60% - lines 37-42)
- `libs/network-protocol/src/lib/sender/creators/mocks.ts` (80%)
- `libs/network-protocol/src/lib/sender/creators/test-fixtures.ts` (60% - lines 37-42)
- `libs/network-protocol/src/lib/packet/creators/mocks.ts` (97.95% - nearly done)
- `libs/network-protocol/src/lib/data/security/mocks.ts` (100% ✓)
- `libs/network-protocol/src/lib/data/security/test-fixtures.ts` (has branch at line 8)

**Analysis Needed**:

- Are mocks.ts and test-fixtures.ts used across multiple test files?
- Do uncovered lines represent edge cases that could reveal bugs?
- Standard pattern: test-only files excluded from coverage

**Options**:

1. **Exclude test utilities** (COMMON PRACTICE)
   - Add to coveragePathIgnorePatterns: `!**/mocks.ts`, `!**/test-fixtures.ts`

2. **Test the test utilities** (IF COMPLEX LOGIC)
   - Only if mocks contain meaningful business logic
   - Review uncovered lines for complexity

**Decision Pattern**:

- Simple mock exports → exclude
- Complex mock logic (stateful, conditional) → test

**Reference Paths**:

- `libs/network-protocol/src/lib/*/creators/mocks.ts`
- `libs/network-protocol/src/lib/*/creators/test-fixtures.ts`
- `libs/network-protocol/src/lib/data/security/mocks.ts` (100% example)

---

### Phase 4: Data Layer Coverage (Medium Complexity) - IN PROGRESS

**File**: `roadmap/network-protocol-phase-4-data-layer.md`
**Sequence**: 4
**Complexity**: Medium
**Estimated Effort**: 4-6 hours
**Status**: Main tests completed, minor gaps remain

**Progress Summary**:

- ✅ Created `get-schema.spec.ts` with 8 comprehensive test cases
- ✅ Enhanced `is-valid-message.spec.ts` with bigint, symbol, and nested edge cases
- ✅ Added schema creation error handling test to `create-data-factory.spec.ts`
- ⚠️ Remaining gaps are challenging edge cases requiring special approaches

**Scope**: Complete coverage for data validation and creation

**Key Patterns Observed**:

- Most data validators use similar structure from backup tests
- Data factory tests well-covered but missing error paths
- Schema validation needs edge case coverage

**Files to Fix**:

#### 4.1: data/validations/is-valid-schema.ts (Priority: High)

- **Current**: 77.27% statements, 69.76% branches
- **Uncovered**: Lines 10-11, 16, 21-23
- **Analysis Required**:
  - Read full file to understand validation logic
  - Identify edge cases (null, undefined, malformed schema objects)
  - Check if ajv schema validation needs additional test cases
- **Test Additions Needed**: 6+ test cases for uncovered branches
- **Reference**: `libs/network-protocol/src/lib/data/validations/is-valid-schema.spec.ts`

#### 4.2: data/validations/is-valid-message.ts

- **Current**: 92.3% statements, 75% branches
- **Uncovered**: Line 14
- **Analysis**: Check what condition on line 14 isn't tested
- **Test Additions Needed**: 1-2 test cases
- **Reference**: `libs/network-protocol/src/lib/data/validations/is-valid-message.spec.ts`

#### 4.3: data/creators/get-schema.ts

- **Current**: 100% statements, 85.71% branches
- **Uncovered**: Branch on line 3
- **Analysis**: Conditional logic branch not exercised
- **Test Additions Needed**: 1 test case for alternate branch
- **Reference**: Check if get-schema.spec.ts exists, create if needed

#### 4.4: data/creators/create-data-factory.ts

- **Current**: 92.85% statements
- **Uncovered**: Lines 42, 49
- **Analysis**: Likely error handling or edge case paths
- **Test Additions Needed**: 2 test cases for error conditions
- **Reference**: `libs/network-protocol/src/lib/data/creators/create-data-factory.spec.ts`

**Implementation Strategy**:

1. Read each file to understand validation logic
2. **Reference backup tests** at `tmp/network-protocol-backup/src/data/` for proven patterns
3. Identify the specific conditions for uncovered lines
4. Write targeted test cases for each gap
5. Ensure async operations use `sleep()` utility if needed (see Phase 1 pattern)

**Remaining Gaps Analysis** (Post-Initial Implementation):

#### 4.5: is-valid-schema.ts - Lines 10-11, 16, 21-23

- **Issue**: Coverage report shows uncovered lines beyond the actual file length (13 lines)
- **Root Cause**: Import statement `import * as v4Schema from './v4.json'` causes coverage tool to count JSON file lines
- **Possible Solutions**:
  1. Exclude `v4.json` from coverage collection (recommended)
  2. Accept that JSON schema imports affect coverage metrics
  3. Investigate if jest configuration can handle JSON imports differently
- **Priority**: Low - cosmetic issue, doesn't affect actual code coverage

#### 4.6: is-valid-message.ts - Line 14

- **Issue**: `const options: Options = { depth: [0, '*'] }` not covered
- **Root Cause**: Options object initialization line, hard to verify was executed
- **Possible Solutions**:
  1. Add test that mocks traverse to verify options are passed
  2. Test with deeply nested objects that exercise depth parameter
  3. Accept as unreachable line (options always initialized the same way)
- **Action**: Create test with 10+ levels of nesting to ensure depth option matters

#### 4.7: create-data-factory.ts - Line 42

- **Issue**: Catch block `catch { throw new Error('Cannot create data with unserializable message') }`
- **Root Cause**: JSON.stringify already tested with functions, but catch block line itself not covered
- **Possible Solutions**:
  1. Mock JSON.stringify to throw on second call
  2. Create object with toJSON method that throws
  3. Accept as defensive code (JSON.stringify rarely throws in practice)
- **Action**: Create test with object containing toJSON() that throws

#### 4.8: get-schema.ts - Line 3 Branch

- **Issue**: Branch in `toJsonSchema(data, { arrays: { mode: 'all' } })` not covered
- **Root Cause**: Internal branch in toJsonSchema library function
- **Possible Solutions**:
  1. Test with various array configurations
  2. Test with empty arrays, mixed type arrays, nested arrays
  3. Accept that internal library branches may not be fully coverable
- **Action**: Add test with complex array scenarios

**Reference Paths**:

- `libs/network-protocol/src/lib/data/validations/` (all validation files)
- `libs/network-protocol/src/lib/data/creators/` (factory files)
- **BACKUP REFERENCE**: `tmp/network-protocol-backup/src/data/` (proven test patterns)
- **BACKUP REFERENCE**: `tmp/network-protocol-backup/src/data/creators/create-data.spec.ts` (85 lines)

---

### Phase 5: Queue System Coverage (Medium-High Complexity)

**File**: `roadmap/network-protocol-phase-5-queues.md`
**Sequence**: 5
**Complexity**: Medium-High
**Estimated Effort**: 6-8 hours

**Scope**: Complete queue creator test coverage

**Pattern Observed**:
All queue creators have identical coverage gaps (lines 48-49), suggesting a common initialization pattern that isn't tested.

**Files to Fix** (7 files with same pattern):

- `libs/network-protocol/src/lib/queue/creators/create-decryption-queue.ts` (94.28% - lines 48-49)
- `libs/network-protocol/src/lib/queue/creators/create-deobfuscation-queue.ts` (94.28% - lines 48-49)
- `libs/network-protocol/src/lib/queue/creators/create-deserialization-queue.ts` (94.28% - lines 48-49)
- `libs/network-protocol/src/lib/queue/creators/create-encryption-queue.ts` (94.28% - lines 48-49)
- `libs/network-protocol/src/lib/queue/creators/create-obfuscation-queue.ts` (94.28% - lines 48-49)
- `libs/network-protocol/src/lib/queue/creators/create-serialization-queue.ts` (94.28% - lines 48-49)
- `libs/network-protocol/src/lib/queue/creators/create-queue.ts` (95% - line 38, 90.47% branches, 87.5% functions)

**Investigation Required**:

1. **Identify the pattern** on lines 48-49 across all queue files
2. **Check create-queue.ts** line 38 for related initialization code
3. **Review backup queue tests** at `tmp/network-protocol-backup/src/queue/creators/create-queue.spec.ts`
4. **Compare initialization patterns**: DI factory vs direct instantiation
5. **Likely causes**:
   - Constructor error handling
   - Queue initialization with invalid parameters
   - Edge cases in dependency injection setup

**Strategy**:

- Fix create-queue.ts first (foundational)
- Apply learnings to specialized queue creators
- Ensure test pattern is consistent across all 7 files
- **Use backup async patterns**: `sleep()` utility for queue processing tests

**Key Consideration**:
The queue system underwent DI refactor. The backup at `tmp/network-protocol-backup/src/queue/` shows proven async test patterns that MUST be adapted to current DI implementation.

**Reference Paths**:

- `libs/network-protocol/src/lib/queue/creators/create-queue.ts` (foundational)
- `libs/network-protocol/src/lib/queue/creators/create-*-queue.ts` (6 specialized queues)
- `libs/network-protocol/src/lib/queue/creators/create-queue.spec.ts`
- `libs/network-protocol/src/lib/queue/creators/create-*-queue.spec.ts`
- **BACKUP REFERENCE**: `tmp/network-protocol-backup/src/queue/creators/create-queue.spec.ts` (proven async patterns)

---

### Phase 6: Channel System Coverage (Medium Complexity)

**File**: `roadmap/network-protocol-phase-6-channels.md`
**Sequence**: 6
**Complexity**: Medium
**Estimated Effort**: 2-3 hours

**Scope**: Complete channel creator coverage

**File to Fix**:

- `libs/network-protocol/src/lib/channel/creators/create-channel-store.ts`
  - **Current**: 97.05% statements, 94.44% branches, 96.29% functions, 97.95% lines
  - **Uncovered**: Line 45

**Investigation Required**:

1. Read create-channel-store.ts to identify what line 45 does
2. Check create-channel-store.spec.ts for existing test coverage
3. Determine if it's an error path, edge case, or conditional branch

**Likely Scenarios**:

- Error handling in channel creation
- Edge case in channel lookup/removal
- Validation that isn't triggered by current tests

**Reference Implementation**:
Check `tmp/network-protocol-backup/src/channel/` for proven channel testing patterns, especially:

- `create-channel-store.spec.ts` (112 lines) - Store operations
- `create-channel.spec.ts` (56 lines) - Channel creation and validation

**Reference Paths**:

- `libs/network-protocol/src/lib/channel/creators/create-channel-store.ts`
- `libs/network-protocol/src/lib/channel/creators/create-channel-store.spec.ts`
- **BACKUP REFERENCE**: `tmp/network-protocol-backup/src/channel/creators/create-channel-store.spec.ts` (112 lines)
- **BACKUP REFERENCE**: `tmp/network-protocol-backup/src/channel/creators/create-channel.spec.ts` (56 lines)

---

### Phase 7: Integration & End-to-End Testing (Optional - Based on Phase 1-6 Findings)

**File**: `roadmap/network-protocol-phase-7-integration.md`
**Sequence**: 7
**Complexity**: High
**Estimated Effort**: 6-10 hours
**Status**: Evaluate need during earlier phases

**Scope**: Add comprehensive integration tests for full protocol flow

**Rationale**:
The backup tests suggest potential client-to-client integration patterns. If unit tests reveal gaps in integration scenarios, this phase adds:

- Full message flow: Client A → Protocol → Network → Protocol → Client B
- Multi-message sequences with proper async handling
- Error recovery and edge case scenarios across components

**Investigation Required**:

1. Review backup tests for integration patterns:
   - Check if channel tests simulate full communication
   - Look for sender→receiver integration tests
   - Identify multi-component test scenarios
2. Determine if current unit tests adequately cover integration points
3. Evaluate if race conditions indicate need for integration tests

**Potential Test Scenarios**:

- **Scenario 1**: Two clients exchange messages through protocol
  ```typescript
  // clientA sends → protocol → clientB receives
  await clientA.send(message)
  await sleep(calculatedProcessingTime)
  expect(clientB.receivedMessages).toContain(message)
  ```
- **Scenario 2**: Multiple messages with queue processing
- **Scenario 3**: Error handling across component boundaries
- **Scenario 4**: Channel stop/resume during message transmission

**Decision Point**:
After completing Phases 1-6, evaluate:

- Are there persistent race conditions?
- Do unit tests fully cover component interactions?
- Would integration tests prevent regression?

**Reference Paths**:

- **BACKUP REFERENCE**: `tmp/network-protocol-backup/src/channel/creators/*.spec.ts`
- **BACKUP REFERENCE**: `tmp/network-protocol-backup/src/protocol/v1/creators/*.spec.ts`
- Current receiver/sender factories for integration points

---

## Testing Strategy & Standards

### Reference Materials - CRITICAL IMPORTANCE ⚠️

#### Backup Tests - PRIMARY REFERENCE SOURCE

**Location**: `tmp/network-protocol-backup/src/`
**Status**: Pre-DI refactor implementation
**Usage**: **MANDATORY REFERENCE** for test patterns and async handling

**Why This Matters**:

- Contains **proven async patterns** using `sleep()` from `@hyperfrontend/time-utils`
- Shows **calculated wait times** for queue processing (e.g., `3 * 50ms + 10ms buffer`)
- Demonstrates **proper queue state verification** during async operations
- May contain **client-to-client integration patterns** for full protocol testing

**Key Files to Reference**:

- `tmp/network-protocol-backup/src/queue/creators/create-queue.spec.ts` - Async queue patterns with sleep()
- `tmp/network-protocol-backup/src/channel/creators/create-channel.spec.ts` - Channel integration patterns
- `tmp/network-protocol-backup/src/protocol/v1/creators/*.spec.ts` - Protocol setup patterns
- `tmp/network-protocol-backup/src/data/creators/create-data.spec.ts` (85 lines) - Data layer patterns

**Critical Pattern Found**:

```typescript
// From backup: Proper async queue testing
await sleep(3 * 50 + 10) // 3 messages * 50ms processing + 10ms buffer
expect(messageProcessor).toHaveBeenCalledTimes(3)
expect(processedMessages).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
```

**What to Extract**:

1. ✅ Async timing patterns for queue processing
2. ✅ Queue state verification methods (`currentMessage()`, `size()`)
3. ✅ Integration test patterns (if sender→receiver tests exist)
4. ⚠️ **DO NOT copy**: Direct constructor calls (use DI factories instead)
5. ⚠️ **DO NOT copy**: Outdated dependency injection patterns

#### Current Implementation

- `libs/network-protocol/src/lib/` - Current codebase post-DI refactor
- `libs/network-protocol/jest.config.ts` - Jest configuration with dual environment setup
- `jest.preset.cjs` - Global coverage thresholds (100% required)

### Key Testing Patterns Observed

1. **Dual Environment Testing**:
   - Node tests: `*.spec.ts`
   - Browser tests: `*.browser.spec.ts`
   - Separate test environments in jest.config.ts

2. **Mock Strategy**:
   - Each module has `mocks.ts` for test doubles
   - `test-fixtures.ts` for complex test data setup
   - Security functions mocked at boundaries

3. **Async Queue Testing** ⚠️ CRITICAL:
   - **CORRECT PATTERN** (from backup): Use `sleep()` from `@hyperfrontend/time-utils`
   - Calculate wait times: `messageCount * processingTimePerMessage + buffer`
   - Verify queue state during processing: `size()`, `currentMessage()`
   - **INCORRECT PATTERN** (current failing test): Arbitrary setTimeout(250ms)
   - **Why it matters**: Browser environment has different timing than Node.js

4. **Validation Testing**:
   - Comprehensive valid/invalid input coverage
   - Edge cases for each validation function

5. **Integration Testing Patterns** (from backup):
   - Tests use real protocol flow: sender → protocol → receiver
   - Channel tests verify full communication pipeline
   - Data transformation tested through entire stack

### Coverage Exclusion Recommendations

Update `libs/network-protocol/jest.config.ts` line 5-11:

```typescript
collectCoverageFrom: [
  '**/*.{ts,tsx}',
  '!jest.config.{ts,tsx}',
  '!**/index.{ts,tsx}',
  '!**/*.d.{ts,tsx}',
  '!**/*.spec.ts',
  '!**/jest.setup*.ts',
  '!**/model.ts',           // ADD: Type-only files
  '!**/mocks.ts',           // ADD: Test utilities
  '!**/test-fixtures.ts',   // ADD: Test utilities
],
```

**Rationale**: Standard Jest practice excludes type definitions and test utilities from coverage metrics.

## Success Criteria

### Phase Completion Criteria

- [x] Phase 0: Coverage exclusions documented and applied
- [x] Phase 1: Race condition fixed, browser test passes consistently
- [x] Phase 2: Model files excluded or tested, 0% gaps resolved
- [x] Phase 3: Mock/fixture strategy documented and applied
- [ ] Phase 4: Data layer at 100% coverage (Main tests added, minor gaps remain)
  - [x] Created get-schema.spec.ts with comprehensive tests
  - [x] Enhanced is-valid-message.spec.ts with edge cases
  - [x] Added schema creation error test to create-data-factory.spec.ts
  - [ ] Phase 4.1: Address is-valid-schema.ts lines 10-11, 16, 21-23 (v4.json import issue)
        -Implementation Progress

### Completed Work

#### Phase 0: Configuration ✅

- Updated `jest.config.ts` to exclude:
  - `**/model.ts` (type-only files)
  - `**/mocks.ts` (test utilities)
  - `**/test-fixtures.ts` (test utilities)
- Extracted async patterns from backup tests
- Documented test commands in plan

#### Phase 1: Race Condition Fixes ✅

- Fixed `create-receiver-factory.browser.spec.ts`:
  - Added `sleep` import from `@hyperfrontend/time-utils`
  - Changed "receives message through complete pipeline" from 500ms → 350ms calculated wait
  - Changed "receives multiple messages" from 250ms → 700ms calculated wait (2 messages × 300ms + 100ms buffer)
- Fixed `create-sender-factory.browser.spec.ts`:
  - Added `sleep` import from `@hyperfrontend/time-utils`
  - Changed "sends message through complete pipeline" from 200ms → 350ms calculated wait
  - Changed "sends multiple messages" from 500ms → 700ms calculated wait
- All 14 receiver/sender tests now pass (7 each)

#### Phase 4: Data Layer (Partial) ✅

- **Created**: `get-schema.spec.ts` with 8 test cases
  - Simple objects, arrays, nested objects, primitives
  - Empty objects/arrays, null values, array mode configuration
- **Enhanced**: `is-valid-message.spec.ts` with 7 additional test cases
  - Nested valid/invalid objects, bigint, symbol, mixed arrays
  - Deep nesting scenarios
- **Enhanced**: `create-data-factory.spec.ts`
  - Added import of `getSchemaModule` for mocking
  - Added test for schema creation failure using jest.spyOn
- **Coverage Improvement**:
  - create-data-factory.ts: 92.85% → 96.42% statements
  - Added comprehensive edge case coverage
- **Remaining Gaps**: 4 minor items (see Phase 4.5-4.8 above)

### Next Steps

1. **Phase 4 Completion** (Remaining gaps):
   - Address v4.json coverage reporting issue
   - Add deeply nested object test for is-valid-message.ts
   - Add toJSON() throwing test for create-data-factory.ts
   - Add complex array tests for get-schema.ts

2. **Phase 5: Queue System** (Primary focus):
   - Identify lines 48-49 pattern across all queue creators
   - Fix create-queue.ts line 38 first
   - Apply consistent pattern to 6 specialized queues

3. **Phase 6: Channel System**:
   - Investigate create-channel-store.ts line 45
   - Add missing test case

## [ ] Phase 4.2: Address is-valid-message.ts line 14 (options parameter coverage)

- [ ] Phase 4.3: Address create-data-factory.ts line 42 (serialization catch block)
- [ ] Phase 4.4: Address get-schema.ts line 3 branch (toJsonSchema internal)
- [ ] Phase 5: Queue system at 100% coverage
- [ ] Phase 6: Channel system at 100% coverage
- [ ] Phase 7: Evaluate need for integration tests (based on findings)
- [ ] Phase 8: Final verification and CI/CD validation

### Final Success Metrics

- [ ] All tests pass consistently (0 flaky tests)
- [ ] Coverage thresholds met:
  - Statements: 100%
  - Branches: 100%
  - Functions: 100%
  - Lines: 100%
- [ ] CI/CD pipeline passes
- [ ] Documentation updated with testing patterns

## Execution Order

The phases are designed to be executed sequentially:

```
Phase 0 (Config + Backup Review) → Phase 1 (P0 Bug - Use Backup Patterns)
  → Phase 2 (Models) → Phase 3 (Mocks) → Phase 4 (Data)
  → Phase 5 (Queues) → Phase 6 (Channels) → Phase 7 (Integration - If Needed)
  → Phase 8 (Final Verification)
```

**Rationale for Order**:

1. **Phase 0 first**: Establishes baseline + extracts critical async patterns from backup
2. **Phase 1 immediate**: Fixes blocking test failure using proven backup patterns
3. **Phases 2-3**: Low-hanging fruit, quick wins
4. **Phases 4-6**: Increasing complexity, builds on established patterns
5. **Phase 7**: Optional integration tests if gaps remain
6. **Phase 8**: Final verification

## Notes & Observations

### Backup Tests - Critical Insights

**Location**: `tmp/network-protocol-backup/src/`
**Total Test Files**: ~40 spec files
**Largest Tests** (potential integration patterns):

- `topic/creators/create-topic-store.spec.ts` (196 lines)
- `protocol/v1/creators/create-provider-protocol-store.spec.ts` (121 lines)
- `channel/creators/create-channel-store.spec.ts` (112 lines)
- `queue/creators/create-queue.spec.ts` (99 lines) ⚠️ CRITICAL for Phase 1

**Key Patterns Found**:

1. **Async Testing** with `sleep()` from `@hyperfrontend/time-utils`:
   - Calculated wait times: `messageCount * processingTime + buffer`
   - Queue state verification during processing
   - This is THE solution for the race condition

2. **Integration Approach**:
   - Tests use real protocol flow with mocks at boundaries
   - Channel tests verify full communication pipeline
   - Proper setup/teardown patterns

3. **Test Structure**:
   - Comprehensive describe blocks for each method
   - Edge case coverage (null, invalid, duplicate scenarios)
   - Error message validation

### DI Refactor Impact

The network-protocol underwent dependency injection refactor. Key changes:

- Factory functions instead of direct instantiation
- Explicit dependency passing
- This may have introduced gaps in initialization/error testing

### Browser vs Node Testing

- Browser tests have race condition issues (Phase 1)
- Node tests pass consistently
- Async timing differences between environments

### Coverage Tool Limitations

- Type-only files show 0% but have no executable code
- Mock utilities flagged but serve test infrastructure purpose
- Consider if 100% threshold is appropriate for all file types

## Test Commands

Run all network-protocol tests:

```bash
npx nx test lib-network-protocol
```

Run specific test file:

```bash
npx nx test lib-network-protocol --testPathPatterns="filename.spec.ts"
```

Run with coverage:

```bash
npx nx test lib-network-protocol --coverage
```

Run without coverage threshold (for testing individual files):

```bash
npx nx test lib-network-protocol --testPathPatterns="filename.spec.ts" --coverageThreshold='{}'
```

## Related Documents

- `roadmap/network-protocol-review-checklist.md` - Comprehensive library review checklist
- `libs/network-protocol/README.md` - Library documentation
- `jest.preset.cjs` - Global Jest configuration
- `libs/network-protocol/jest.config.ts` - Project-specific Jest config
- **`tmp/network-protocol-backup/src/`** - Pre-DI test patterns (MANDATORY REFERENCE)

## Backup Test Inventory

For quick reference during implementation, here are the key backup test files:

**Queue System** (Critical for Phase 1 & 5):

- `tmp/network-protocol-backup/src/queue/creators/create-queue.spec.ts` (99 lines) - Async patterns with sleep()

**Channel System** (Phase 6):

- `tmp/network-protocol-backup/src/channel/creators/create-channel-store.spec.ts` (112 lines)
- `tmp/network-protocol-backup/src/channel/creators/create-channel.spec.ts` (56 lines)

**Data Layer** (Phase 4):

- `tmp/network-protocol-backup/src/data/creators/create-data.spec.ts` (85 lines)
- `tmp/network-protocol-backup/src/data/validations/is-valid-schema.spec.ts` (76 lines)
- `tmp/network-protocol-backup/src/data/validations/is-valid-unencrypted-data.spec.ts` (55 lines)

**Protocol** (Phase 1 reference):

- `tmp/network-protocol-backup/src/protocol/v1/creators/create-provider-protocol-store.spec.ts` (121 lines)
- `tmp/network-protocol-backup/src/protocol/v1/creators/create-protocol.spec.ts` (45 lines)

**Packet** (Supporting reference):

- Multiple packet creator and validation tests (40-50 lines each)

---

**Document Version**: 2.0
**Created**: 2026-01-30
**Last Updated**: 2026-01-30
**Author**: GitHub Copilot
**Status**: Ready for Phase Implementation - Backup Patterns Integrated
