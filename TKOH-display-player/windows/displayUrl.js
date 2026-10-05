function withPlayerFlag (link) {
  const url = new URL(String(link || '').trim())
  if (!url.searchParams.has('player')) {
    url.searchParams.set('player', '1')
  }
  return url.toString()
}

function buildDisplayUrl (config) {
  return withPlayerFlag(config.link)
}

function allowedHostFromLink (link) {
  try {
    return new URL(String(link || '').trim()).host
  } catch {
    return ''
  }
}

module.exports = {
  buildDisplayUrl,
  allowedHostFromLink
}
