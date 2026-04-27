# audio

Audio-context initialization helper for browser audio.

`setupAudio` resolves a single shared `AudioContext` instance, lazily creating one on first call and reusing it on subsequent calls so applications don't end up with multiple contexts competing for the audio device. Useful as the entry point in any browser code that needs to play sounds, decode audio buffers, or schedule audio nodes.
