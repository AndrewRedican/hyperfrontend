<script setup lang="ts">
/**
 * The whole visible app: a frame, and nothing in it yet.
 *
 * The project boots, Vue mounts, and the koi is rendered here once the shared
 * model is wired in.
 *
 * This is the one browser-facing module in the app. The other six koi replace
 * exactly this file with their own framework's idiom, and share everything else.
 */
</script>

<template>
  <div class="koi-frame"></div>
</template>

<style scoped>
.koi-frame {
  position: absolute;
  inset: 0;
}
</style>
