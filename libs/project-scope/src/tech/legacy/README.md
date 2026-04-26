# legacy

Legacy-framework detectors for projects still on pre-modern stacks.

Covers AngularJS (1.x), Backbone, Ember, and jQuery. Each `<framework>Detector` follows the shared `LegacyFrameworkDetector` contract; `detectLegacyFrameworks` runs them all and returns the aggregate `LegacyFrameworkDetection[]`. Useful for migration-planning tools that need to flag projects still depending on these frameworks before recommending modernization paths.
