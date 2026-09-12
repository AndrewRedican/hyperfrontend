# encoding

File encoding detection and conversion utilities for safely handling text files with mixed BOM markers and binary content.

Detects UTF-8, UTF-16 LE/BE byte-order marks, identifies binary signatures (PNG, ZIP, PDF, etc.) for [`isTextFile`](https://www.hyperfrontend.dev/docs/libraries/project-scope/core/encoding/#api-isTextFile) checks, and converts buffers to UTF-8 strings with optional BOM stripping or addition.
