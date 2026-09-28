<template>
  <Teleport to="body">
    <button
      v-if="showHint"
      type="button"
      class="display-fs-hint"
      aria-label="Enter fullscreen"
      @click="onEnter"
    >
      <span class="display-fs-hint__card">
        <span class="display-fs-hint__en">Tap to enter fullscreen</span>
        <span class="display-fs-hint__zh">點擊進入全屏顯示</span>
      </span>
    </button>
  </Teleport>
</template>

<script setup>
import { useDisplayBrowserFullscreen } from '@/composables/useDisplayBrowserFullscreen'

const { showHint, enterFullscreen } = useDisplayBrowserFullscreen()

async function onEnter () {
  await enterFullscreen()
}
</script>

<style scoped>
.display-fs-hint {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  margin: 0;
  padding: 0;
  border: 0;
  background: rgba(0, 0, 0, 0.45);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-tap-highlight-color: transparent;
}

.display-fs-hint__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  padding: 1.1rem 1.6rem;
  border-radius: 0.75rem;
  background: rgba(17, 24, 39, 0.92);
  color: #f9fafb;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
  pointer-events: none;
}

.display-fs-hint__en {
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.display-fs-hint__zh {
  font-size: 0.95rem;
  font-weight: 600;
  opacity: 0.92;
}
</style>
