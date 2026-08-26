import { ref } from 'vue'
import { getVenueManagementVenues } from '@/api/venueManagement'
import { getMockVenueList } from '@/mocks/mockData'
import { getCachedOrFetch } from '@/utils/apiCache'
import { SILENT_ERROR } from '@/utils/requestOptions'

export const VENUE_TAB_CONFERENCE = 'conference_discussion'
export const VENUE_TAB_OTHER = 'other_venues'

const VENUE_LIST_CACHE_KEY = 'venue-management-venues'
const VENUE_LIST_CACHE_TTL_MS = 5 * 60 * 1000

function normalizeVenueList (data) {
  return Array.isArray(data) ? data : []
}

function isActiveVenue (venue) {
  return String(venue?.status || 'active').toLowerCase() === 'active'
}

/** 按 tab 收集有上传图片的场地（每场地一张） */
export function collectVenueImagesByTab (venues, tab) {
  return normalizeVenueList(venues)
    .filter((v) => isActiveVenue(v) && v.tab === tab)
    .filter((v) => String(v.image || '').trim())
    .map((v) => ({
      src: v.image,
      name: v.name || v.nameZh || 'Venue',
      alt: v.name || v.nameZh || 'Venue'
    }))
}

export function useVenueBookingImages () {
  const venuesLoading = ref(false)
  const conferenceImages = ref([])
  const otherVenueImages = ref([])

  const loadVenueBookingImages = async () => {
    venuesLoading.value = true
    try {
      let list = []
      try {
        const data = await getCachedOrFetch(
          VENUE_LIST_CACHE_KEY,
          VENUE_LIST_CACHE_TTL_MS,
          () => getVenueManagementVenues(SILENT_ERROR)
        )
        list = normalizeVenueList(data)
      } catch {
        list = getMockVenueList()
      }
      conferenceImages.value = collectVenueImagesByTab(list, VENUE_TAB_CONFERENCE)
      otherVenueImages.value = collectVenueImagesByTab(list, VENUE_TAB_OTHER)
    } catch {
      conferenceImages.value = []
      otherVenueImages.value = []
    } finally {
      venuesLoading.value = false
    }
  }

  return {
    venuesLoading,
    conferenceImages,
    otherVenueImages,
    loadVenueBookingImages
  }
}
