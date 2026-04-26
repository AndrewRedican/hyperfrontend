# mobile

Mobile-device detection helper.

`isMobileDevice()` returns `true` when the current runtime appears to be a mobile browser based on user-agent and feature signals. Use it to gate behavior that only makes sense on touch-first devices (gesture listeners, larger hit-targets, mobile-only UI) without depending on a full UA-parsing library.
