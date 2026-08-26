<template>
  <div class="venue-card-images">
    <div v-if="loading" class="venue-card-images__loading">Loading...</div>
    <template v-else-if="pages.length">
      <div class="venue-card-images__viewport">
        <div class="venue-card__grid">
          <button
            v-for="(item, idx) in currentPage"
            :key="`${pageIndex}-${item.src}-${idx}`"
            type="button"
            class="venue-card__image"
            :aria-label="`View larger: ${item.alt || 'venue image'}`"
            @click="openPreview(item)"
          >
            <ApiProtectedImg :src="item.src" :alt="item.alt" />
            <div class="venue-card__overlay"></div>
          </button>
        </div>

        <button
          v-if="pages.length > 1"
          type="button"
          class="venue-card-images__nav venue-card-images__nav--prev"
          :disabled="pageIndex === 0"
          aria-label="Previous images"
          @click="goPrev"
        >
          ‹
        </button>
        <button
          v-if="pages.length > 1"
          type="button"
          class="venue-card-images__nav venue-card-images__nav--next"
          :disabled="pageIndex >= pages.length - 1"
          aria-label="Next images"
          @click="goNext"
        >
          ›
        </button>

        <div
          class="venue-card-images__pager"
          :class="{ 'venue-card-images__pager--hidden': pages.length <= 1 }"
          role="tablist"
          :aria-label="pages.length > 1 ? 'Image pages' : undefined"
          :aria-hidden="pages.length <= 1"
        >
          <template v-if="pages.length > 1">
            <button
              v-for="(_, i) in pages"
              :key="i"
              type="button"
              class="venue-card-images__dot"
              :class="{ 'venue-card-images__dot--active': i === pageIndex }"
              :aria-label="`Page ${i + 1} of ${pages.length}`"
              :aria-selected="i === pageIndex"
              @click="pageIndex = i"
            />
          </template>
        </div>
      </div>
    </template>
    <div v-else class="venue-card-images__empty">No images available</div>

    <BookingStyleModal
      v-model="previewVisible"
      :title="previewTitle"
      max-width="960px"
      dialog-width="94%"
    >
      <div class="venue-image-preview" :class="{ 'venue-image-preview--gallery': flatItems.length > 1 }">
        <button
          v-if="flatItems.length > 1"
          type="button"
          class="venue-image-preview__nav venue-image-preview__nav--prev"
          :disabled="previewIndex <= 0"
          aria-label="Previous image"
          @click="previewGoPrev"
        >
          ‹
        </button>

        <div class="venue-image-preview__stage">
          <p v-if="previewLoading" class="venue-image-preview__status">Loading...</p>
          <img
            v-else-if="previewUrl"
            :src="previewUrl"
            :alt="previewVenueName || 'Venue image'"
            class="venue-image-preview__img"
          />
          <p v-else class="venue-image-preview__status">Unable to load image.</p>
          <p v-if="flatItems.length > 1" class="venue-image-preview__counter">
            {{ previewIndex + 1 }} / {{ flatItems.length }}
          </p>
        </div>

        <button
          v-if="flatItems.length > 1"
          type="button"
          class="venue-image-preview__nav venue-image-preview__nav--next"
          :disabled="previewIndex >= flatItems.length - 1"
          aria-label="Next image"
          @click="previewGoNext"
        >
          ›
        </button>
      </div>
    </BookingStyleModal>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import ApiProtectedImg from '@/components/ApiProtectedImg.vue'
import BookingStyleModal from '@/components/BookingStyleModal.vue'
import { loadProtectedAssetUrl } from '@/utils/apiAsset'
import { chunkVenueImages } from '@/utils/venueImagePages'

const props = defineProps({
  items: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const pageIndex = ref(0)
const previewVisible = ref(false)
const previewLoading = ref(false)
const previewUrl = ref('')
const previewVenueName = ref('')
const previewIndex = ref(0)

const pages = computed(() => chunkVenueImages(props.items))
const flatItems = computed(() => (Array.isArray(props.items) ? props.items : []).filter((item) => item?.src))
const currentPage = computed(() => pages.value[pageIndex.value] || [])
const previewTitle = computed(() => previewVenueName.value || 'Image Preview')

watch(
  () => props.items,
  () => {
    pageIndex.value = 0
  }
)

watch(pages, (next) => {
  if (pageIndex.value > next.length - 1) {
    pageIndex.value = Math.max(0, next.length - 1)
  }
})

watch(previewVisible, (open) => {
  if (!open) {
    previewUrl.value = ''
    previewVenueName.value = ''
    previewLoading.value = false
  }
})

function goPrev () {
  if (pageIndex.value > 0) pageIndex.value -= 1
}

function goNext () {
  if (pageIndex.value < pages.value.length - 1) pageIndex.value += 1
}

function resolveVenueName (item) {
  return String(item?.name || item?.alt || '').trim()
}

async function loadPreviewAt (index) {
  const item = flatItems.value[index]
  const src = String(item?.src || '').trim()
  if (!src) return
  previewIndex.value = index
  previewVenueName.value = resolveVenueName(item)
  previewLoading.value = true
  previewUrl.value = ''
  try {
    previewUrl.value = await loadProtectedAssetUrl(src)
  } catch {
    previewUrl.value = ''
  } finally {
    previewLoading.value = false
  }
}

async function openPreview (item) {
  const src = String(item?.src || '').trim()
  if (!src) return
  const index = flatItems.value.findIndex((entry) => entry?.src === src)
  previewVisible.value = true
  await loadPreviewAt(index >= 0 ? index : 0)
}

function previewGoPrev () {
  if (previewIndex.value <= 0) return
  void loadPreviewAt(previewIndex.value - 1)
}

function previewGoNext () {
  if (previewIndex.value >= flatItems.value.length - 1) return
  void loadPreviewAt(previewIndex.value + 1)
}
</script>

<style scoped>
.venue-card-images {
  --venue-pager-slot: 0.45rem;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  margin-bottom: clamp(8px, 1vh, 10px);
}

.venue-card-images__viewport {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 0;
}

.venue-card-images__nav {
  position: absolute;
  top: 50%;
  z-index: 2;
  width: 1.75rem;
  height: 2.5rem;
  border: 1px solid #bbf7d0;
  border-radius: 6px;
  background: rgba(236, 253, 243, 0.92);
  color: #166534;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  transform: translateY(-50%);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
  transition: background-color 0.2s ease, opacity 0.2s ease;
}

.venue-card-images__nav--prev {
  left: 0.35rem;
}

.venue-card-images__nav--next {
  right: 0.35rem;
}

.venue-card-images__nav:hover:not(:disabled) {
  background: #dcfce7;
}

.venue-card-images__nav:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.venue-card__grid {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  row-gap: clamp(8px, 1vh, 10px);
  column-gap: clamp(8px, 1vh, 10px);
  align-content: start;
  padding-top: clamp(6px, 0.65vh, 10px);
  flex-shrink: 0;
}

.venue-card__image {
  aspect-ratio: 4 / 3;
  border: none;
  padding: 0;
  border-radius: clamp(0.4rem, 0.8vh, 0.6rem);
  overflow: hidden;
  position: relative;
  background: #f3f4f6;
  cursor: zoom-in;
}

.venue-card__image:focus-visible {
  outline: 2px solid #00723a;
  outline-offset: 2px;
}

.venue-card__image :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  pointer-events: none;
}

.venue-card__overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.3));
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
}

.venue-card__image:hover .venue-card__overlay {
  opacity: 1;
}

/* 固定占位：贴底、高度尽量小；无圆点时仍占位以保持左右卡片等高 */
.venue-card-images__pager {
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.35rem;
  margin-top: auto;
  padding-top: 0.1rem;
  min-height: var(--venue-pager-slot);
  box-sizing: border-box;
}

.venue-card-images__pager--hidden {
  visibility: hidden;
  pointer-events: none;
}

.venue-card-images__dot {
  width: 7px;
  height: 7px;
  padding: 0;
  border: none;
  border-radius: 9999px;
  background: #d1d5db;
  cursor: pointer;
}

.venue-card-images__dot--active {
  background: #00723a;
}

.venue-card-images__loading,
.venue-card-images__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  font-size: 0.875rem;
  min-height: 8rem;
}

.venue-card-images__loading::after,
.venue-card-images__empty::after {
  content: '';
  display: block;
  flex-shrink: 0;
  width: 100%;
  margin-top: auto;
  height: var(--venue-pager-slot);
}

.venue-image-preview {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

.venue-image-preview--gallery {
  padding: 0 2.75rem;
}

.venue-image-preview__stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  width: 100%;
  min-width: 0;
}

.venue-image-preview__img {
  display: block;
  width: 100%;
  max-height: min(72vh, 760px);
  object-fit: contain;
  border-radius: 8px;
  background: #f3f4f6;
}

.venue-image-preview__status {
  margin: 0;
  color: #6b7280;
  font-size: 0.9375rem;
}

.venue-image-preview__counter {
  margin: 0;
  font-size: 0.875rem;
  color: #6b7280;
}

.venue-image-preview__nav {
  position: absolute;
  top: 50%;
  z-index: 2;
  width: 2.25rem;
  height: 2.75rem;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  background: rgba(236, 253, 243, 0.95);
  color: #166534;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  transform: translateY(-50%);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.venue-image-preview__nav--prev {
  left: 0;
}

.venue-image-preview__nav--next {
  right: 0;
}

.venue-image-preview__nav:hover:not(:disabled) {
  background: #dcfce7;
}

.venue-image-preview__nav:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
</style>
