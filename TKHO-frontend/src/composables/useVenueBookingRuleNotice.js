import { computed, ref } from 'vue'
import { getPublicBookingNotices, getPrompts } from '@/api/promptManagement'
import { extractNoticeBannerSummary } from '@/utils/noticeBannerSummary'
import { getPromptContentByKey, hasPromptHtmlContent } from '@/utils/promptList'
import { SILENT_ERROR } from '@/utils/requestOptions'

export const VENUE_BOOKING_RULE_UPDATE_NOTICE_KEY = 'venue_alert_message'

export function useVenueBookingRuleNotice () {
  const venueRuleNoticeRaw = ref('')
  const venueRuleNoticeLoading = ref(false)

  const venueRuleNoticeContent = computed(() => venueRuleNoticeRaw.value)

  const hasVenueRuleNotice = computed(
    () => !venueRuleNoticeLoading.value && hasPromptHtmlContent(venueRuleNoticeRaw.value)
  )

  const venueRuleNoticeBannerText = computed(() => extractNoticeBannerSummary(venueRuleNoticeRaw.value))

  const loadVenueRuleNotice = async () => {
    venueRuleNoticeLoading.value = true
    try {
      let content = ''
      try {
        const publicData = await getPublicBookingNotices()
        content = getPromptContentByKey(publicData, VENUE_BOOKING_RULE_UPDATE_NOTICE_KEY)
      } catch {
        /* 回退鉴权接口 */
      }
      if (!content) {
        const data = await getPrompts({ category: 'system_fixed' }, SILENT_ERROR)
        content = getPromptContentByKey(data, VENUE_BOOKING_RULE_UPDATE_NOTICE_KEY)
      }
      venueRuleNoticeRaw.value = content
    } catch {
      venueRuleNoticeRaw.value = ''
    } finally {
      venueRuleNoticeLoading.value = false
    }
  }

  return {
    venueRuleNoticeContent,
    venueRuleNoticeBannerText,
    venueRuleNoticeLoading,
    hasVenueRuleNotice,
    loadVenueRuleNotice
  }
}
