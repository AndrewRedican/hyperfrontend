# event

Synthetic mouse-event emission and gesture-listener helpers.

[`clickAtPosition`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/event/#api-clickAtPosition) dispatches a synthetic click at given page coordinates, useful for programmatic interactions and tests. [`createGestureListener`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/event/#api-createGestureListener) builds a unified pointer-down / pointer-move / pointer-up handler chain that abstracts over mouse, touch, and pen events, calling a single [`Callback`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/event/#api-Callback) shape regardless of input type.
