# event

Synthetic mouse-event emission and gesture-listener helpers.

`clickAtPosition` dispatches a synthetic click at given page coordinates — useful for programmatic interactions and tests. `createGestureListener` builds a unified pointer-down / pointer-move / pointer-up handler chain that abstracts over mouse, touch, and pen events, calling a single `Callback` shape regardless of input type.
