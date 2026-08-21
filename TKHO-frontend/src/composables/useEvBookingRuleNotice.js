import { computed, ref } from 'vue'
import { getPublicBookingNotices, getPrompts } from '@/api/promptManagement'
import { extractNoticeBannerSummary } from '@/utils/noticeBannerSummary'
import { getPromptContentByKey, hasPromptHtmlContent } from '@/utils/promptList'
import { SILENT_ERROR } from '@/utils/requestOptions'

export const EV_BOOKING_RULE_UPDATE_NOTICE_KEY = 'ev_alert_message'

export function useEvBookingRuleNotice () {
  const evRuleNoticeRaw = ref('')
  const evRuleNoticeLoading = ref(false)

  const evRuleNoticeContent = computed(() => evRuleNoticeRaw.value)

  const hasEvRuleNotice = computed(
    () => !evRuleNoticeLoading.value && hasPromptHtmlContent(evRuleNoticeRaw.value)
  )

  const evRuleNoticeBannerText = computed(() => extractNoticeBannerSummary(evRuleNoticeRaw.value))

  const loadEvRuleNotice = async () => {
    evRuleNoticeLoading.value = true
    try {
      let content = ''
      try {
        const publicData = await getPublicBookingNotices()
        content = getPromptContentByKey(publicData, EV_BOOKING_RULE_UPDATE_NOTICE_KEY)
      } catch {
        /* 回退鉴权接口 */
      }
      if (!content) {
        const data = await getPrompts({ category: 'system_fixed' }, SILENT_ERROR)
        content = getPromptContentByKey(data, EV_BOOKING_RULE_UPDATE_NOTICE_KEY)
      }
      evRuleNoticeRaw.value = content
    } catch {
      evRuleNoticeRaw.value = ''
    } finally {
      evRuleNoticeLoading.value = false
    }
  }

  return {
    evRuleNoticeContent,
    evRuleNoticeBannerText,
    evRuleNoticeLoading,
    hasEvRuleNotice,
    loadEvRuleNotice
  }
}
