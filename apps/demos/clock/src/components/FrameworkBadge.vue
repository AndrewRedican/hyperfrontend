<!--
  A discreet corner badge identifying the framework this hostee is built
  with, so visitors recognise the stage as an embedded page of a different
  framework than its host. Rendered by the feature — the badge travels with
  the page wherever it is embedded. The pill carries its own translucent
  backdrop because the clock's page background is transparent and the host
  behind it is unknown.
-->
<template>
  <p class="framework-badge" title="This clock is a Vue app running in its own embedded page">
    <svg viewBox="0 0 256 221" role="img" aria-label="Vue logo" focusable="false">
      <path fill="#41b883" d="M204.8 0H256L128 220.8 0 0h51.2L128 133.12 204.8 0Z" />
      <path fill="#35495e" d="M204.8 0 128 133.12 51.2 0h46.72L128 51.2 158.08 0h46.72Z" />
    </svg>
    <span>Vue</span>
  </p>
</template>

<style scoped>
/* why: Discreet framework identity in the hostee's corner — noticeable on approach, quiet otherwise, themed to the coin's slate. */
.framework-badge {
  position: absolute;
  right: 10px;
  bottom: 10px;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  /* why: The page background is transparent and the host behind it is unknown, so the pill carries enough of its own slate to keep the label legible on light and dark backdrops alike. */
  background: rgba(44, 51, 60, 0.72);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(232, 238, 246, 0.16);
  color: #e8eef6;
  font-size: 0.72rem;
  font-family: system-ui, sans-serif;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  opacity: 0.7;
  transition: opacity 250ms ease;
}

.framework-badge:hover {
  opacity: 0.95;
}

.framework-badge svg {
  width: 14px;
  height: 12px;
}
</style>
