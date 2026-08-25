/**
 * @param {Record<string, unknown> | null | undefined} teaService
 * @param {number | null | undefined} [fallbackAttendees]
 * @param {{ includeSpecialRequest?: boolean }} [options]
 */
export function formatTeaServiceDisplay (teaService, fallbackAttendees, options = {}) {
  if (!teaService) return '-'

  const includeSpecialRequest = options.includeSpecialRequest !== false
  const attendees = teaService.attendees ?? fallbackAttendees ?? ''
  let option = String(teaService.option || '').trim()
  const special = String(teaService.specialRequest || teaService.notes || '').trim()

  if (!option) {
    const beverages = String(teaService.beverages || '').trim()
    const notes = special
    if (beverages.includes('不用茶')) option = 'none'
    else if (notes && !beverages) option = '4'
    else if (beverages.includes('壺茶') || beverages.includes('壺水')) option = '3'
    else if (beverages.includes('對')) option = '2'
    else if (beverages.includes('每位茶')) option = '1'
    else option = '1'
  }

  if (option === 'none') return '不用茶'

  let base = ''
  if (option === '1') {
    base = `每位茶 / ${attendees}`
  } else if (option === '2') {
    const from = teaService.ratioFrom ?? '?'
    const to = teaService.ratioTo ?? '?'
    base = `每位茶 / ${from} 對 ${to}`
  } else if (option === '3') {
    const teaPots = teaService.teaPots ?? '?'
    const waterPots = teaService.waterPots ?? '?'
    base = `${teaPots} 壺茶 / ${waterPots} 壺水 + 杯`
  } else if (option === '4') {
    // 旧数据：仅特殊要求
    return includeSpecialRequest ? (special || '-') : '-'
  } else {
    return '-'
  }

  if (includeSpecialRequest && special) return `${base}（${special}）`
  return base
}

/** 去掉「主选项（特殊要求）」尾部括号，避免与独立 Special Requests 列重复 */
export function stripTeaServiceSpecialSuffix (summary) {
  return String(summary || '').replace(/（[^）]*）\s*$/u, '').trim()
}

/**
 * @param {Record<string, unknown>} form
 */
export function buildTeaServiceApiPayload (form) {
  const attendees = Number(form.attendeeCount ?? form.teaServiceParticipants)
  const safeAttendees = Number.isFinite(attendees) && attendees >= 1 ? attendees : 1
  const teaServiceRequired = Boolean(form.teaServiceRequired)

  if (!teaServiceRequired) {
    return {
      teaServiceRequired: false,
      attendeeCount: safeAttendees
    }
  }

  let option = String(form.teaServiceOption || '1').trim()
  // Option 4 仅为追加，不能作为主选项
  if (option === '4' || option === 'none' || !option) option = '1'

  const payload = {
    teaServiceRequired: true,
    teaServiceOption: option,
    attendeeCount: safeAttendees
  }

  if (option === '2') {
    payload.teaServiceRatioFrom = Number(form.teaServiceRatioFrom)
    payload.teaServiceRatioTo = Number(form.teaServiceRatioTo)
  } else if (option === '3') {
    payload.teaServiceTeaPots = Number(form.teaServiceTeaPots)
    payload.teaServiceWaterPots = Number(form.teaServiceWaterPots)
  }

  const specialRequest = String(form.teaServiceSpecialRequest || '').trim()
  // Option 4 为追加项；二次组装 payload 时可能只有 specialRequest、没有 teaServiceOption4
  if (form.teaServiceOption4 || specialRequest) {
    payload.teaServiceOption4 = true
    payload.teaServiceSpecialRequest = specialRequest
  }

  return payload
}

/**
 * @param {Record<string, unknown>} form
 * @param {{ isAdmin?: boolean }} [opts]
 */
export function validateTeaServiceForm (form, opts = {}) {
  if (!form.teaServiceRequired) return { ok: true }

  let option = String(form.teaServiceOption || '').trim()
  if (option === '4') {
    return {
      ok: false,
      message: 'Please select Option 1 / 2 / 3 before adding Option 4 special requests'
    }
  }
  if (!option || !['1', '2', '3'].includes(option)) {
    return { ok: false, message: 'Please select a tea service option (1 / 2 / 3)' }
  }

  if (option === '2') {
    const from = Number(form.teaServiceRatioFrom)
    const to = Number(form.teaServiceRatioTo)
    if (!Number.isFinite(from) || from < 1 || !Number.isFinite(to) || to < 1) {
      return { ok: false, message: 'Please enter valid values for Option 2 (X 對 X)' }
    }
  }

  if (option === '3') {
    const teaPots = Number(form.teaServiceTeaPots)
    const waterPots = Number(form.teaServiceWaterPots)
    if (!Number.isFinite(teaPots) || teaPots < 0 || !Number.isFinite(waterPots) || waterPots < 0) {
      return { ok: false, message: 'Please enter valid pot counts for Option 3' }
    }
    if (teaPots === 0 && waterPots === 0) {
      return { ok: false, message: 'Please enter at least one pot count for Option 3' }
    }
  }

  if (form.teaServiceOption4) {
    if (!opts.isAdmin) {
      return { ok: false, message: 'Only administrators can add Option 4 special requests' }
    }
    const text = String(form.teaServiceSpecialRequest || '').trim()
    if (!text) {
      return { ok: false, message: 'Please enter special requests in Chinese for Option 4' }
    }
  }

  return { ok: true }
}

/**
 * @param {Record<string, unknown> | null | undefined} teaService
 */
export function parseTeaServiceToForm (teaService) {
  if (!teaService) {
    return {
      teaServiceOption: '1',
      teaServiceOption4: false,
      teaServiceRatioFrom: null,
      teaServiceRatioTo: null,
      teaServiceTeaPots: null,
      teaServiceWaterPots: null,
      teaServiceSpecialRequest: ''
    }
  }

  let option = String(teaService.option || '').trim()
  const special = String(teaService.specialRequest || teaService.notes || '').trim()

  if (!option) {
    const beverages = String(teaService.beverages || '').trim()
    if (beverages.includes('不用茶')) option = 'none'
    else if (special && !beverages) option = '4'
    else if (beverages.includes('壺茶') || beverages.includes('壺水')) option = '3'
    else if (beverages.includes('對')) option = '2'
    else option = '1'
  }

  // 旧 option=4：主选项回退为 1，并勾选追加 Option 4
  if (option === '4') {
    return {
      teaServiceOption: '1',
      teaServiceOption4: Boolean(special),
      teaServiceRatioFrom: null,
      teaServiceRatioTo: null,
      teaServiceTeaPots: null,
      teaServiceWaterPots: null,
      teaServiceSpecialRequest: special
    }
  }

  return {
    teaServiceOption: option === 'none' ? '1' : option,
    teaServiceOption4: Boolean(special),
    teaServiceRatioFrom: teaService.ratioFrom ?? null,
    teaServiceRatioTo: teaService.ratioTo ?? null,
    teaServiceTeaPots: teaService.teaPots ?? null,
    teaServiceWaterPots: teaService.waterPots ?? null,
    teaServiceSpecialRequest: special
  }
}

/**
 * @param {Record<string, unknown> | null | undefined} venue
 */
export function venueOffersTeaService (venue) {
  if (venue == null) return true
  return venue.teaServiceAvailable !== false
}
