# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0](https://github.com/AndrewRedican/hyperfrontend/compare/9e6cdcc777484b3f38ca87cfea42d4cb758075a6...913a9758a28d729d423e394f97caa651c42b2da9) - 2026-10-24

### Features

- deliver a late ResizeObserver notification with resizeLate
- add the browser entry for linked windows and a driven ResizeObserver
- add the process entry for terminal, stdio and child process stand-ins
- add the fs entry for self-cleaning temporary directories and fixture trees
- add clearMocks, resetMocks and restoreMocks to the test config
- add waitFor, waitUntil, flushPromises, sleep and createDeferred
- add createMock for typed, automatically mocked objects
- add jest.replaceProperty, jest.stubEnv and jest.stubGlobal

### Bug Fixes

- reset a mock to the implementation it was created with
- type a fake child's pid as possibly undefined, as Node does

## 0.1.0 - 2026-10-15

### Features

- promote the test runtime to the publishable @hyperfrontend/testing package

### Bug Fixes

- read the alias file in one step instead of checking it first
