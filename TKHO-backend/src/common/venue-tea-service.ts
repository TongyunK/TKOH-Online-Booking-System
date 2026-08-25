export type VenueTeaServiceOption = 'none' | '1' | '2' | '3' | '4';

export type VenueTeaServicePayload = {
  option: VenueTeaServiceOption;
  attendees: number;
  ratioFrom?: number;
  ratioTo?: number;
  teaPots?: number;
  waterPots?: number;
  /** Option 4 追加特殊要求（可与 option 1/2/3 并存） */
  specialRequest?: string;
  /** @deprecated legacy */
  beverages?: string;
  /** @deprecated legacy */
  serveAs?: string;
  /** @deprecated legacy */
  quantity?: number;
  /** @deprecated legacy */
  notes?: string;
};

export function normalizeVenueTeaService(raw: unknown): VenueTeaServicePayload | null {
  if (!raw) return null;
  let obj: Record<string, unknown> | null = null;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    obj = raw as Record<string, unknown>;
  } else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        obj = parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  if (!obj) return null;
  return obj as VenueTeaServicePayload;
}

function resolveSpecialRequest(input: {
  specialRequest?: string;
  teaServiceSpecialRequest?: string;
}): string {
  return String(input.specialRequest ?? input.teaServiceSpecialRequest ?? '').trim();
}

export function buildVenueTeaServiceJson(input: {
  teaServiceRequired: boolean;
  attendees: number;
  option?: string;
  ratioFrom?: number;
  ratioTo?: number;
  teaPots?: number;
  waterPots?: number;
  specialRequest?: string;
  /** legacy */
  teaOrWater?: string;
  serviceType?: string;
  teaServiceSpecialRequest?: string;
}): VenueTeaServicePayload {
  const attendees = Number.isFinite(input.attendees) && input.attendees >= 1 ? input.attendees : 1;
  if (!input.teaServiceRequired) {
    return { option: 'none', attendees };
  }

  const specialRequest = resolveSpecialRequest(input);
  let option = String(input.option || '').trim() as VenueTeaServiceOption;

  // Option 4 仅为追加；若误传为 option=4，回退主选项为 1 并保留 specialRequest
  if (option === '4') {
    option = '1';
  }

  let base: VenueTeaServicePayload;
  if (option === '2') {
    base = {
      option: '2',
      attendees,
      ratioFrom: Number(input.ratioFrom),
      ratioTo: Number(input.ratioTo),
    };
  } else if (option === '3') {
    base = {
      option: '3',
      attendees,
      teaPots: Number(input.teaPots),
      waterPots: Number(input.waterPots),
    };
  } else if (option === '1') {
    base = { option: '1', attendees };
  } else {
    // Legacy fallback when option is missing
    base = {
      option: '1',
      attendees,
      beverages: input.teaOrWater ?? 'tea',
      serveAs: input.serviceType ?? 'pot',
      quantity: attendees,
    };
  }

  if (specialRequest) {
    base.specialRequest = specialRequest;
  }
  return base;
}

export function formatVenueTeaServiceDisplay(
  teaService: VenueTeaServicePayload | null | undefined,
  fallbackAttendees?: number | null,
): string {
  if (!teaService) return '-';

  const attendees = teaService.attendees ?? fallbackAttendees ?? '';
  let option = String(teaService.option || '').trim();
  const special = String(teaService.specialRequest || teaService.notes || '').trim();

  if (!option) {
    const beverages = String(teaService.beverages || '').trim();
    if (beverages.includes('不用茶')) option = 'none';
    else if (special && !beverages) option = '4';
    else if (beverages.includes('壺茶') || beverages.includes('壺水')) option = '3';
    else if (beverages.includes('對')) option = '2';
    else if (beverages.includes('每位茶')) option = '1';
    else option = '1';
  }

  if (option === 'none') {
    return '不用茶';
  }

  let base = '';
  if (option === '1') {
    base = `每位茶 / ${attendees}`;
  } else if (option === '2') {
    const from = teaService.ratioFrom ?? '?';
    const to = teaService.ratioTo ?? '?';
    base = `每位茶 / ${from} 對 ${to}`;
  } else if (option === '3') {
    const teaPots = teaService.teaPots ?? '?';
    const waterPots = teaService.waterPots ?? '?';
    base = `${teaPots} 壺茶 / ${waterPots} 壺水 + 杯`;
  } else if (option === '4') {
    return special || '-';
  } else {
    return '-';
  }

  if (special) return `${base}（${special}）`;
  return base;
}
