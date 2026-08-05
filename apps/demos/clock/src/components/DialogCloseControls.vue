<!--
  The dialog-mode close chrome: a circular ✕ button with an `esc` hint beside
  it. Rendered only while a host presents the feature as a dialog. The button
  emits a `close-request` through the contract — the host owns the dialog and
  performs the actual close. Escape needs no listener here: the SDK already
  turns an in-frame Escape into its dismiss signal for the host.
-->
<script setup lang="ts">
defineEmits<{ 'close-request': [] }>()
</script>

<template>
  <div class="dialog-chrome">
    <span class="dialog-esc-hint" aria-hidden="true">esc</span>
    <button type="button" class="dialog-close" aria-label="Close dialog" @click="$emit('close-request')">
      <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
        <path d="M2.5 2.5 9.5 9.5 M9.5 2.5 2.5 9.5" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
/* why: Dialog chrome floats over the stage's top-right corner; the page background is transparent, so the pills carry their own slate like the framework badge. */
.dialog-chrome {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 2;
}

.dialog-esc-hint {
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid rgba(232, 238, 246, 0.16);
  background: rgba(44, 51, 60, 0.72);
  backdrop-filter: blur(4px);
  color: #e8eef6;
  font-size: 0.66rem;
  font-family: system-ui, sans-serif;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  opacity: 0.8;
}

.dialog-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border-radius: 50%;
  border: 1px solid rgba(232, 238, 246, 0.24);
  background: rgba(44, 51, 60, 0.78);
  backdrop-filter: blur(4px);
  color: #e8eef6;
  cursor: pointer;
  transition:
    background 200ms ease,
    border-color 200ms ease;
}

.dialog-close svg {
  width: 12px;
  height: 12px;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  fill: none;
}

.dialog-close:hover {
  background: rgba(71, 85, 105, 0.9);
  border-color: rgba(232, 238, 246, 0.5);
}

.dialog-close:focus-visible {
  outline: 2px solid #93c5fd;
  outline-offset: 3px;
}
</style>
