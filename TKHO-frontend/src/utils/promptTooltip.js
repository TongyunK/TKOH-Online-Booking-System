import { sanitizeHtml } from '@/utils/sanitizeHtml'

/**
 * @param {unknown} raw
 */
export function formatPromptTooltipText (raw) {
  if (raw == null || raw === '') return ''
  return String(raw)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim()
}

/**
 * Keep prompt HTML (colors, highlights, lists) for tooltip v-html.
 * @param {unknown} raw
 */
export function formatPromptTooltipHtml (raw) {
  if (raw == null || raw === '') return ''
  const html = sanitizeHtml(raw)
  const text = html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text ? html : ''
}

/**
 * @param {Array<{ key?: string, content?: string }>} promptList
 * @param {string} key
 */
export function pickPromptTooltipText (promptList, key) {
  const raw = promptList.find((p) => p.key === key)?.content
  return formatPromptTooltipText(raw)
}

/**
 * @param {Array<{ key?: string, content?: string }>} promptList
 * @param {string} key
 */
export function pickPromptTooltipHtml (promptList, key) {
  const raw = promptList.find((p) => p.key === key)?.content
  return formatPromptTooltipHtml(raw)
}
