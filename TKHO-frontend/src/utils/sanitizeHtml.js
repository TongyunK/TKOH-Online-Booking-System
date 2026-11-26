/**
 * Strip unsafe tags/attrs; keep prompt editor styles (color, background, lists, etc.).
 * @param {unknown} html
 * @returns {string}
 */
export function sanitizeHtml (html) {
  const container = document.createElement('div')
  container.innerHTML = html == null ? '' : String(html)
  container.querySelectorAll('script, iframe, object, embed, style, link').forEach((node) => node.remove())
  container.querySelectorAll('*').forEach((el) => {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase()
      const value = String(attr.value || '')
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name)
        continue
      }
      if ((name === 'href' || name === 'src') && value.trim().toLowerCase().startsWith('javascript:')) {
        el.removeAttribute(attr.name)
      }
      if (name === 'style') {
        const safe = value
          .split(';')
          .map((s) => s.trim())
          .filter(Boolean)
          .filter((rule) =>
            /^(color|background-color|font-weight|font-style|text-decoration|text-align|margin-left|margin-right|width|max-width|display|list-style-type|list-style-position)\s*:/i.test(
              rule
            )
          )
          .join('; ')
        if (safe) el.setAttribute('style', safe)
        else el.removeAttribute('style')
      }
    }
  })
  return container.innerHTML
}
