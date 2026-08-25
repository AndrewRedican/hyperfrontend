# How to close a feature without losing unsaved work

You will make a close a negotiation rather than a `remove()`: the feature tells the host when it is holding work worth protecting, the host takes that into account before it starts a teardown, and the feature gets one last window on a live channel to flush.

The two sides of an embed disagree about who owns the close. The host owns the frame and can drop it at any moment; only the feature knows whether a draft, an armed timer, or an unsent edit is inside. Tear the frame out and that knowledge dies with it, silently, because removing an [`iframe`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe) fires nothing the feature can act on. The [`@hyperfrontend/features`](/docs/libraries/features) session carries both directions of that conversation. The snippets come from the Vue clock in this site's [demo gallery](/demos), whose armed alarms are the unsaved work and whose host console drives the close.

## 1. Report unsaved work from the feature

[`setDirty`](/docs/libraries/features/hostee#api-FeatureHandle) sits on the handle [`createFeature`](/docs/libraries/features/hostee#api-createFeature) returned when the feature started up. It is a declaration of current state, not an event, so call it wherever the answer changes and let it settle to the truth. Derive it from the state you already keep rather than tracking a second flag alongside:

<!-- snippet: report-dirty -->

Calling it from every mutation that can change the answer, including the one that clears the last of it, is what keeps the host's view honest. Sending `true` and forgetting to send `false` is the failure that turns every later close into a false alarm.

## 2. Watch the reports on the host

The host receives each declaration as a `dirty-state` event on its [`ShellHandle`](/docs/libraries/features/host#api-ShellHandle). Keep the latest value where your close path can read it:

<!-- snippet: watch-dirty -->

[`isDirty`](/docs/libraries/features/host#api-ShellHandle-prop-isDirty) on the shell holds the same answer if you would rather read it at the moment of the close than track it yourself. It resets when the channel closes, so a reopened session starts clean without you clearing anything.

## 3. Take unsaved work into account before closing

With the flag in hand, the close path can do whatever your product calls for: confirm, save first, or simply say so. What matters is that the decision happens before [`close`](/docs/libraries/features/host#api-ShellHandle) is called, because the close itself does not ask:

<!-- snippet: guard-close -->

Put your confirmation, your save, or your warning on that branch. What the branch cannot be is absent: `close` proceeds regardless of what the feature declared.

## 4. Subscribe to `closing` on both ends

[`close`](/docs/libraries/features/host#api-ShellHandle) is a request, not a removal. It announces `closing` to both ends while the channel is still delivering, and the teardown completes only once the feature has had its turn or the deadline expires. On the host, that notice is how you tell an orderly ending from a session that died:

<!-- snippet: watch-closing -->

In the feature, subscribe to the same event on your [`FeatureHandle`](/docs/libraries/features/hostee#api-FeatureHandle) and send the last thing you are holding from inside the handler. Messages sent there still arrive. Send them synchronously rather than from a promise the handler kicks off, because the window closes as soon as the exchange completes, and work scheduled for a later tick can miss it.

## 5. Declare a close request in the contract

A feature the host mounted in the [`dialog`](/docs/libraries/features/host#api-DisplayMode) display mode often carries its own close control. Route it through the host rather than having the feature disconnect itself: the host owns the dialog, so it is the side that can confirm first, save first, animate the dismissal, and then take the frame down. Give the feature a way to ask, as an ordinary [emitted action](/docs/libraries/features/host#api-ActionDescription) on the [contract](/docs/libraries/features/host#api-FeatureContract):

<!-- snippet: declare-close-request -->

## 6. Send it from the feature's close control

Send it only when the feature is actually in a mode where the request means something, and latch after the first send, because a pointer activation racing a keyboard one would otherwise send two:

<!-- snippet: request-close -->

## 7. Act on the request in the host

The request arrives as an ordinary contract message, so subscribe to it by name and decide there. That decision is the whole point of routing a close through the host: the same request can close the dialog outright, or run the confirmation from step 3 first.

<!-- snippet: honour-close-request -->

## Check it worked

Put the feature into a state it considers unsaved and watch a `dirty-state` arrive at the host with `dirty: true`; clear that state and watch `false` follow. Trigger a close while dirty and confirm your branch ran. Send a message from the feature's `closing` handler and confirm the host received it before `close`. Reopen the session and confirm `isDirty` starts `false` without you resetting it. Finally, activate the feature's own close control in dialog mode and confirm exactly one request reaches the host, and that the frame goes away only because the host acted on it.
