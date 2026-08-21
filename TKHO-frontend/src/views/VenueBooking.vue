<template>
  <div class="booking-page">
    <AppHeader />

    <div v-if="hasVenueRuleNotice && !showTopTip" class="top-tip-toggle-wrapper">
      <button
        type="button"
        class="top-tip-toggle-btn"
        aria-label="Show alert message"
        title="Show alert message"
        @click="showTopTip = true"
      ></button>
    </div>

    <!-- Main container: viewport minus header and bottom space -->
    <main class="booking-main" :class="{ 'tip-collapsed-gap': hasVenueRuleNotice && !showTopTip }">
      <div v-if="hasVenueRuleNotice && showTopTip" class="booking-window-tip">
        <span>Alert Message:</span>
        <button type="button" class="read-more-link" @click="noticeDialogVisible = true">Click here to read more</button>
        <button type="button" class="tip-close-btn" aria-label="Hide alert message" @click="showTopTip = false">
          &times;
        </button>
      </div>
      <div class="booking-content">
        <h2 class="booking-title">What venue would you like to book?</h2>

        <div class="cards-container">
          <!-- Conference room card -->
          <section class="venue-card">
            <!-- Fixed title height to avoid layout shift -->
            <div class="venue-card__title-wrapper">
              <h3 class="venue-card__title">Conference Rooms and Discussion Room</h3>
            </div>
            <VenueBookingCardImages
              :items="conferenceImages"
              :loading="venuesLoading"
            />
            <el-button type="primary" class="venue-card__button" @click="goToConference">
              Book Now →
            </el-button>
          </section>

          <!-- Other venue card -->
          <section class="venue-card">
            <!-- Fixed title height to avoid layout shift -->
            <div class="venue-card__title-wrapper">
              <h3 class="venue-card__title">Other Venues</h3>
            </div>
            <VenueBookingCardImages
              :items="otherVenueImages"
              :loading="venuesLoading"
            />
            <el-button type="primary" class="venue-card__button" @click="goToOtherVenues">
              Book Now →
            </el-button>
          </section>
        </div>
      </div>
    </main>

    <BookingStyleModal
      v-if="hasVenueRuleNotice"
      v-model="noticeDialogVisible"
      title="Alert Message"
      max-width="820px"
      custom-class="important-note-modal"
    >
      <div v-if="venueRuleNoticeLoading" class="venue-rule-notice-content">Loading...</div>
      <div
        v-else-if="venueRuleNoticeContent"
        class="venue-rule-notice-content rich-content"
        v-html="venueRuleNoticeContent"
      ></div>
      <div v-else class="venue-rule-notice-content venue-rule-notice-empty">No content available.</div>
    </BookingStyleModal>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import AppHeader from '../components/AppHeader.vue'
import BookingStyleModal from '../components/BookingStyleModal.vue'
import VenueBookingCardImages from '@/components/VenueBookingCardImages.vue'
import { useVenueBookingImages } from '@/composables/useVenueBookingImages'
import { useVenueBookingRuleNotice } from '@/composables/useVenueBookingRuleNotice'
import { useUserStore } from '@/stores/user'
import { markVenueCalendarBookNowFilter } from '@/utils/venueCalendarRoomFilter'
import {
  loadImportantNoteTipExpanded,
  saveImportantNoteTipExpanded
} from '@/utils/importantNoteTip'
import '@/styles/rich-content.css'

const router = useRouter()
const userStore = useUserStore()
const { userInfo } = storeToRefs(userStore)
const noticeDialogVisible = ref(false)
const tipUserKey = () => userInfo.value?.id ?? null
const showTopTip = ref(loadImportantNoteTipExpanded('venue', tipUserKey()))
watch(showTopTip, (expanded) => {
  saveImportantNoteTipExpanded('venue', tipUserKey(), expanded)
})
const {
  venueRuleNoticeContent,
  venueRuleNoticeLoading,
  hasVenueRuleNotice,
  loadVenueRuleNotice
} = useVenueBookingRuleNotice()

const {
  venuesLoading,
  conferenceImages,
  otherVenueImages,
  loadVenueBookingImages
} = useVenueBookingImages()

onMounted(() => {
  loadVenueRuleNotice()
  loadVenueBookingImages()
})

const goToConference = () => {
  markVenueCalendarBookNowFilter('conference')
  router.push({ name: 'VenueCalendarView', query: { roomType: 'conference' } })
}
const goToOtherVenues = () => {
  markVenueCalendarBookNowFilter('other')
  router.push({ name: 'VenueCalendarView', query: { roomType: 'other' } })
}
</script>


<style scoped>
/* Page shell */
.booking-page {
  height: var(--zoom-vh);
  overflow: hidden;
  background: linear-gradient(135deg, #f8ecdd 0%, #f5e6d3 50%, #f8ecdd 100%);
  padding-top: 64px; /* Keep same header spacing as EVBooking */
  box-sizing: border-box;
  position: relative;
}

/* Main area: viewport minus header and bottom space */
.booking-main {
  /* height: calc(100vh - 60px - 20px); 60px header, 20px bottom spacing */
  padding: 0.5rem 1rem 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}

.booking-main.tip-collapsed-gap {
  margin-top: 6px;
}

.booking-window-tip {
  margin: 0 0 0.25rem;
  width: 100%;
  background: #f4b898;
  border: 1px solid #f5c4a0;
  color: #fe0302;
  border-radius: 8px;
  padding: 0.45rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 700;
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}

.read-more-link {
  border: none;
  background: transparent;
  color: #fe0302;
  font-size: inherit;
  font-weight: 700;
  padding: 0;
  cursor: pointer;
  text-decoration: underline;
}

.read-more-link:hover {
  color: #d10201;
}

.tip-close-btn {
  margin-left: auto;
  width: 22px;
  height: 22px;
  border: 1px solid #f5c4a0;
  border-radius: 9999px;
  background: #fcd9c0;
  color: #fe0302;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.tip-close-btn:hover {
  background: #f5c4a0;
  border-color: #ef9a6a;
}

.top-tip-toggle-wrapper {
  position: relative;
  height: 0;
  z-index: 30;
}

.top-tip-toggle-btn {
  position: absolute;
  left: 50%;
  top: 0;
  transform: translateX(-50%);
  width: 34px;
  height: 18px;
  border: 1px solid #ea580c;
  border-top: none;
  border-radius: 0 0 16px 16px;
  background: linear-gradient(180deg, #fb923c 0%, #f97316 100%);
  cursor: pointer;
  transition: background-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
  box-shadow: 0 2px 8px rgba(234, 88, 12, 0.28);
  display: flex;
  align-items: center;
  justify-content: center;
}

.top-tip-toggle-btn::before {
  content: '';
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 7px solid #ffffff;
  opacity: 0.95;
}

.top-tip-toggle-btn:hover {
  background: linear-gradient(180deg, #f97316 0%, #ea580c 100%);
  transform: translateX(-50%) translateY(1px);
  box-shadow: 0 3px 10px rgba(234, 88, 12, 0.35);
}

.top-tip-toggle-btn:focus-visible {
  outline: 2px solid #fdba74;
  outline-offset: 2px;
}

/* Content container: max width and centered */
.booking-content {
  width: 100%;
  max-width: 90vw;
  margin: 6vh auto 0;
}

/* Title: responsive font and compact spacing */
.booking-title {
  font-size: clamp(1.5rem, min(6vh, 4vw), 2.5rem);
  color: #1a1a1a;
  text-align: center;
  margin-bottom: 6vh; /* Reduce title/card spacing */
  font-weight: bold;
}

/* Cards container: responsive layout */
.cards-container {
  display: flex;
  flex-direction: column;
  gap: 1.2vh;
}
@media (min-width: 768px) and (max-width: 1099px) {
  .cards-container {
    flex-direction: row;
    gap: 1.5vw;
    justify-content: center;
  }
}

@media (min-width: 1100px) and (max-width: 1599px) {
  .cards-container {
    flex-direction: row;
    gap: 1.5vw;
    justify-content: center;
  }
}

@media (min-width: 1600px) and (max-width: 2239px) {
  .cards-container {
    flex-direction: row;
    gap: 1.5vw;
    justify-content: center;
  }
}

@media (min-width: 2240px) {
  .cards-container {
    flex-direction: row;
    gap: 1.5vw;
    justify-content: center;
  }
}

/* Card: responsive size and compact padding */
.venue-card {
  background: #fff;
  border-radius: clamp(0.8rem, 1.2vh, 1.5rem);
  padding: clamp(1.2rem, 2.5vh, 2rem);
  width: 100%;
  min-width: 300px;
  max-width: clamp(300px, 36vw, 500px);
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: clamp(380px, 65vh, 550px);
}

/* Title wrapper */
.venue-card__title-wrapper {
  height: clamp(2rem, 8vh, 3.5rem);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: clamp(0.5rem, 1vh, 1rem);
}

/* Card title: responsive text sizing */
.venue-card__title {
  font-size: clamp(1rem, min(4vh, 2.2vw), 1.8rem);
  line-height: 1.1; /* 这里调行间距 */
  color: #00723a;
  text-align: center;
  margin: 0;
  font-weight: bold;
  line-clamp: 2;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* CTA button */
.venue-card__button {
  height: clamp(2rem, 5vh, 2.8rem);
  background: linear-gradient(135deg, #00723a, #005a2f) !important;
  border: none !important;
  color: #fff !important;
  font-size: clamp(0.9rem, min(2.5vh, 1.4vw), 1.2rem) !important;
  font-weight: bold;
  border-radius: clamp(0.6rem, 1vh, 1rem) !important;
}

</style>
