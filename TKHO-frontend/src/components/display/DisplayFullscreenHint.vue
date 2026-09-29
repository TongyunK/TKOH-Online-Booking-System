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
  padding: 1.5rem;
  border: 0;
  background: rgba(15, 23, 42, 0.88);
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
  justify-content: center;
  gap: 0.55rem;
  min-width: min(78vw, 360px);
  padding: 1.45rem 2rem;
  border-radius: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.55);
  background: rgba(255, 255, 255, 0.96);
  color: #0f172a;
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.06),
    0 18px 40px rgba(15, 23, 42, 0.28);
  pointer-events: none;
}

.display-fs-hint__en {
  font-size: clamp(1.2rem, 3.8vw, 1.55rem);
  font-weight: 750;
  letter-spacing: 0.01em;
  line-height: 1.25;
  text-align: center;
  color: #0f172a;
}

.display-fs-hint__zh {
  font-size: clamp(1.05rem, 3.3vw, 1.3rem);
  font-weight: 650;
  line-height: 1.3;
  text-align: center;
  color: #334155;
}
</style>
