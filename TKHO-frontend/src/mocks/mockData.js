/**
 * 集中 mock 数据（单文件管理）
 * 为兼顾加载速度：大数组采用惰性初始化；EV 预订数据按需生成（调用一次即可）。
 *
 * 关联字段约定（便于与真实 API / 表结构对齐）：
 * - 会议审批：venueId → 场地；bookerEmployeeId → 员工 id；bookerCorpId → 预订人 corpId
 * - 账号待审批：departmentId → 部门 id（与 department 名称对应）
 * - 车牌：userId → 用户 id（与 corpId 对应同一人）
 * - 展示配置 venueRules：venueId、displayType、mergeGroup、displayName（大屏行名，如 CR1）、arrowDirection（8方向）
 *   - 特殊规则：EV 可使用 venueId=null，前端据此判断为固定行（不可修改）
 * - 员工 ↔ 角色 / 部门：当前仅用字符串 role、department，若需 roleId、departmentId 可在员工记录上扩展
 */

let _employeeListRaw = null
let _employeeListNormalized = null
let _pendingListRaw = null
let _pendingListNormalized = null

function cloneMockItem (item) {
  // 组件会对列表做 push/splice/替换，因此每次必须返回“独立副本”
  const out = { ...item }
  for (const [k, v] of Object.entries(out)) {
    if (Array.isArray(v)) out[k] = v.slice()
  }
  return out
}

function cloneMockList (list) {
  return list.map(cloneMockItem)
}

export function createMockUser ({ corpId, system }) {
  return {
    id: 1,
    name: corpId,
    firstName: corpId,
    lastName: '',
    employeeNo: '',
    rank: '',
    // 模拟角色：admin 与 booking 用户区分 AppHeader；后续由后端权限覆盖
    role: system === 'admin' ? 'admin' : 'user',
    system
  }
}

export function createMockToken () {
  return 'mock-token-' + Date.now()
}

export const mockAdminPendingCounts = {
  pendingBookingsCount: 3,
  pendingUsersCount: 2
}

function normalizeEmployeeRaw (u) {
  const role = u.role ?? u.position ?? ''
  const annualQuotaEV = u.annualQuotaEV ?? u.annualQuota ?? 0
  const usedQuotaEV = u.usedQuotaEV ?? u.usedQuota ?? 0
  const annualQuotaVenue = u.annualQuotaVenue ?? u.annualQuota ?? 0
  const usedQuotaVenue = u.usedQuotaVenue ?? u.usedQuota ?? 0
  return { ...u, role, annualQuotaEV, usedQuotaEV, annualQuotaVenue, usedQuotaVenue }
}

/** 从合并 name 拆出 first/last，并补齐 employeeNo / rank（兼容旧 mock） */
function withUserNameFields (u, idx = 0) {
  const parts = String(u.name || '').trim().split(/\s+/).filter(Boolean)
  const firstName = u.firstName ?? parts[0] ?? ''
  const lastName = u.lastName ?? parts.slice(1).join(' ') ?? ''
  const name = u.name || [firstName, lastName].filter(Boolean).join(' ')
  return {
    ...u,
    firstName,
    lastName,
    name,
    employeeNo: u.employeeNo ?? String(100000 + Number(u.id ?? idx + 1)),
    rank: u.rank ?? ''
  }
}

export function getMockEmployeeListRaw () {
  if (_employeeListRaw) return cloneMockList(_employeeListRaw)

  const baseList = [
    { id: 1, corpId: 'E001', name: 'John Doe', department: 'ADM', position: 'Admin', email: 'john@tkoh.com', contact: '91000000', annualQuotaEV: -1, usedQuotaEV: 12, annualQuotaVenue: -1, usedQuotaVenue: 3, status: 'active' },
    { id: 2, corpId: 'E002', name: 'Jane Smith', department: 'CNS', position: 'User', email: 'jane@tkoh.com', contact: '91000001', annualQuota: 30, usedQuota: 5, status: 'active' },
    { id: 3, corpId: 'E003', name: 'Michael Tan', department: 'D&T', position: 'User', email: 'michael.tan@tkoh.com', contact: '91000002', annualQuota: 40, usedQuota: 9, status: 'active' },
    { id: 4, corpId: 'E004', name: 'Emily Wong', department: 'HCE', position: 'User', email: 'emily.wong@tkoh.com', contact: '91000003', annualQuota: 30, usedQuota: 3, status: 'active' },
    { id: 5, corpId: 'E005', name: 'Daniel Lee', department: 'ADM', position: 'User', email: 'daniel.lee@tkoh.com', contact: '91000004', annualQuota: 35, usedQuota: 14, status: 'active' },
    { id: 6, corpId: 'E006', name: 'Olivia Chan', department: 'ENT', position: 'User', email: 'olivia.chan@tkoh.com', contact: '91000005', annualQuota: 25, usedQuota: 2, status: 'active' },
    { id: 7, corpId: 'E007', name: 'Ryan Lim', department: 'GO', position: 'User', email: 'ryan.lim@tkoh.com', contact: '91000006', annualQuota: 30, usedQuota: 7, status: 'active' },
    { id: 8, corpId: 'E008', name: 'Sophia Ng', department: 'CNS', position: 'User', email: 'sophia.ng@tkoh.com', contact: '91000007', annualQuota: 30, usedQuota: 11, status: 'active' },
    { id: 9, corpId: 'E009', name: 'Kevin Ho', department: 'PMMD', position: 'User', email: 'kevin.ho@tkoh.com', contact: '91000008', annualQuota: 30, usedQuota: 6, status: 'active' },
    { id: 10, corpId: 'E010', name: 'Grace Low', department: 'SOPD', position: 'User', email: 'grace.low@tkoh.com', contact: '91000009', annualQuota: 35, usedQuota: 15, status: 'active' },
    { id: 11, corpId: 'E011', name: 'Jason Chua', department: 'ADM', position: 'User', email: 'jason.chua@tkoh.com', contact: '91000010', annualQuota: 35, usedQuota: 8, status: 'active' },
    { id: 12, corpId: 'E012', name: 'Alicia Koh', department: 'NSD', position: 'User', email: 'alicia.koh@tkoh.com', contact: '91000011', annualQuota: 25, usedQuota: 4, status: 'active' },
    { id: 13, corpId: 'E013', name: 'Marcus Teo', department: 'HCE', position: 'User_EV', email: 'marcus.teo@tkoh.com', contact: '91000012', annualQuota: 40, usedQuota: 18, status: 'active' },
    { id: 14, corpId: 'E014', name: 'Hannah Goh', department: 'D&T', position: 'User', email: 'hannah.goh@tkoh.com', contact: '91000013', annualQuota: 30, usedQuota: 10, status: 'active' },
    { id: 15, corpId: 'E015', name: 'Brandon Yap', department: 'SS', position: 'User', email: 'brandon.yap@tkoh.com', contact: '91000014', annualQuota: 30, usedQuota: 5, status: 'active' },
    { id: 16, corpId: 'E016', name: 'Natalie Sim', department: 'ENT', position: 'Admin', email: 'natalie.sim@tkoh.com', contact: '91000015', annualQuota: -1, usedQuota: 13, status: 'active' },
    { id: 17, corpId: 'E017', name: 'Darren Ang', department: 'SOPD', position: 'User_Venue', email: 'darren.ang@tkoh.com', contact: '91000016', annualQuota: 25, usedQuota: 1, status: 'active' },
    { id: 18, corpId: 'E018', name: 'Chloe Tan', department: 'SS', position: 'User', email: 'chloe.tan@tkoh.com', contact: '91000017', annualQuota: 30, usedQuota: 12, status: 'active' },
    { id: 19, corpId: 'E019', name: 'Samuel Neo', department: 'SS', position: 'User_EV', email: 'samuel.neo@tkoh.com', contact: '91000018', annualQuota: 30, usedQuota: 7, status: 'inactive' },
    { id: 20, corpId: 'E020', name: 'Ivy Cheong', department: 'SOPD', position: 'User', email: 'ivy.cheong@tkoh.com', contact: '91000019', annualQuota: 30, usedQuota: 9, status: 'active' },
    { id: 21, corpId: 'E021', name: 'Leonard Fong', department: 'PMMD', position: 'Admin', email: 'leonard.fong@tkoh.com', contact: '91000020', annualQuota: -1, usedQuota: 20, status: 'active' },
    { id: 22, corpId: 'E022', name: 'Vanessa Liew', department: 'ADM', position: 'Support', email: 'vanessa.liew@tkoh.com', contact: '91000021', annualQuota: 30, usedQuota: 6, status: 'inactive' },
    { id: 23, corpId: 'E023', name: 'Tommy Tan', department: 'SS', role: 'EV Booking', email: 'tommy.tan@tkoh.com', contact: '91000022', annualQuotaEV: 40, usedQuotaEV: 22, annualQuotaVenue: 20, usedQuotaVenue: 12, status: 'expired' },
    { id: 24, corpId: 'E024', name: 'Lily Wong', department: 'SS', role: 'Venue Booking', email: 'lily.wong@tkoh.com', contact: '91000023', annualQuotaEV: 25, usedQuotaEV: 15, annualQuotaVenue: 55, usedQuotaVenue: 28, status: 'expired' },
    { id: 25, corpId: 'E025', name: 'Ethan Lim', department: 'ENT', role: 'Admin', email: 'ethan.lim@tkoh.com', contact: '91000024', annualQuotaEV: -1, usedQuotaEV: 40, annualQuotaVenue: -1, usedQuotaVenue: 35, status: 'expired' }
  ]
  _employeeListRaw = baseList.map((u, idx) => ({
    ...withUserNameFields(u, idx),
    // 统一提供最近登录时间，供 UserManagement 表格展示
    lastLoginTime: u.lastLoginTime ?? `2026-03-${String((idx % 27) + 1).padStart(2, '0')} ${String(8 + (idx % 10)).padStart(2, '0')}:${String((idx * 7) % 60).padStart(2, '0')}`
  }))

  return cloneMockList(_employeeListRaw)
}

export function getMockEmployeeListNormalized () {
  if (_employeeListNormalized) return cloneMockList(_employeeListNormalized)

  // 注意：这里需要基于 raw 的缓存做 normalize，然后返回克隆副本
  _employeeListNormalized = _employeeListRaw
    ? _employeeListRaw.map(normalizeEmployeeRaw)
    : getMockEmployeeListRaw().map(normalizeEmployeeRaw)

  return cloneMockList(_employeeListNormalized)
}

export function getMockPendingListRaw () {
  if (_pendingListRaw) return cloneMockList(_pendingListRaw)

  _pendingListRaw = [
    {
      id: 101,
      corpId: 'E003',
      name: 'Bob Wilson',
      firstName: 'Bob',
      lastName: 'Wilson',
      employeeNo: '100101',
      rank: 'Officer',
      department: 'D&T',
      /** 关联 getMockDepartmentList 的 id，便于按部门筛选/统计 */
      departmentId: 3,
      role: 'Staff',
      email: 'bob@tkoh.com',
      lastLoginTime: '2026-03-18 09:20',
      submittedAt: '2026-03-20 10:30',
      reason: 'Requesting access to make EV/Venue bookings for team meetings.'
    }
  ]

  return cloneMockList(_pendingListRaw)
}

export function getMockPendingListNormalized () {
  if (_pendingListNormalized) return cloneMockList(_pendingListNormalized)

  const raw = _pendingListRaw ?? getMockPendingListRaw()
  _pendingListNormalized = raw.map((u) => ({
    ...u,
    role: u.role ?? u.position ?? ''
  }))

  return cloneMockList(_pendingListNormalized)
}

/**
 * 会议审批（pending / approved / rejected）约定字段：
 * - venueId: 关联 getMockVenueList() 的 id（与 venueName 对应同一场地）
 * - bookerEmployeeId: 预订人，关联员工表 id；无匹配员工时为 null
 * - bookerCorpId: 预订人 corpId，便于与员工/账号按 corpId 关联（冗余展示字段）
 */
let _meetingPendingList = null
let _meetingApprovedList = null
let _meetingRejectedList = null
let _teaServiceDoneByBookingId = null
let _accessRoleList = null
let _departmentList = null
let _parkingList = null
let _promptList = null
let _venueList = null
let _licensePlateList = null
let _accountVehicleList = null
let _evTimePeriods = null
let _bookingWindows = null
let _displayConfig = null
let _evManageBookingList = null
let _venueCalendarBookingList = null
let _venueManageBookingList = null

export function getMockMeetingPendingList () {
  if (_meetingPendingList) return cloneMockList(_meetingPendingList)
  _meetingPendingList = [
    {
      id: 1,
      bookingId: 'BK20260320001',
      venueId: 2,
      venueName: 'Conference Room B',
      bookerEmployeeId: 1,
      bookerCorpId: 'E001',
      userName: 'John Doe',
      department: 'ADM',
      meetingTitle: 'Reserved',
      date: '2026-05-05',
      time: '14:30-15:30',
      teaService: { option: 'none', attendees: 8 },
      teaServiceRequired: false,
      attendees: 8,
      submittedAt: '2026-03-20 10:30'
    },
    {
      id: 2,
      bookingId: 'BK20260320002',
      venueId: 1,
      venueName: 'Conference Room A',
      bookerEmployeeId: 2,
      bookerCorpId: 'E002',
      userName: 'Jane Smith',
      department: 'CNS',
      meetingTitle: 'Team Building Planning',
      date: '2026-05-06',
      time: '09:30-10:30',
      teaService: { option: '1', attendees: 10 },
      teaServiceRequired: true,
      attendees: 10,
      submittedAt: '2026-03-20 11:15'
    },
    {
      id: 3,
      bookingId: 'BK20260320003',
      venueId: 1,
      venueName: 'Conference Room A',
      bookerEmployeeId: 2,
      bookerCorpId: 'E002',
      userName: 'Jane Smith',
      department: 'CNS',
      meetingTitle: 'Reflooring Discussion',
      date: '2026-05-05',
      time: '10:30-12:30',
      teaService: { option: '3', attendees: 12, teaPots: 1, waterPots: 1 },
      teaServiceRequired: true,
      attendees: 12,
      submittedAt: '2026-05-05 11:15'
    },
    {
      id: 4,
      bookingId: 'BK20260320004',
      venueId: 1,
      venueName: 'Conference Room A',
      bookerEmployeeId: 2,
      bookerCorpId: 'E002',
      userName: 'Jane Smith',
      department: 'CNS',
      meetingTitle: 'Booking System Discussion with JW',
      date: '2026-05-05',
      time: '15:00-17:00',
      teaService: { option: '4', attendees: 6, specialRequest: '不加糖，11:00 再送一輪' },
      teaServiceRequired: true,
      attendees: 6,
      submittedAt: '2026-05-05 11:15'
    },
    {
      id: 5,
      bookingId: 'BK20260320005',
      venueId: 2,
      venueName: 'Conference Room B',
      bookerEmployeeId: 2,
      bookerCorpId: 'E002',
      userName: 'Jane Smith',
      department: 'CNS',
      meetingTitle: 'Labour Department OSH Inspection Meeting',
      date: '2026-05-05',
      time: '10:00-12:00',
      teaService: { option: '1', attendees: 18 },
      teaServiceRequired: true,
      attendees: 18,
      submittedAt: '2026-05-05 11:15'
    },
    {
      id: 6,
      bookingId: 'BK20260320006',
      venueId: 3,
      venueName: 'Conference Room C',
      bookerEmployeeId: 2,
      bookerCorpId: 'E002',
      userName: 'Jane Smith',
      department: 'CNS',
      meetingTitle: 'Fall Prevention Internal Meeting',
      date: '2026-05-05',
      time: '09:30-13:00',
      teaService: { option: '2', attendees: 14, ratioFrom: 2, ratioTo: 3 },
      teaServiceRequired: true,
      attendees: 14,
      submittedAt: '2026-05-06 11:15'
    }
  ]
  return cloneMockList(_meetingPendingList)
}

export function getMockTeaServiceRequests () {
  if (!_teaServiceDoneByBookingId) _teaServiceDoneByBookingId = {}
  const meetings = getMockMeetingPendingList()
  const venueMap = new Map(getMockVenueList().map(v => [v.id, v]))
  return meetings
    .filter(item => item.teaService)
    .map(item => {
      const venue = venueMap.get(item.venueId)
      return {
        id: item.bookingId || item.id,
        bookingId: item.bookingId || String(item.id),
        venueId: item.venueId,
        venueName: item.venueName || venue?.name || '',
        venueNameZh: venue?.nameZh || '',
        meetingTitle: item.meetingTitle,
        date: item.date,
        time: item.time,
        attendees: item.attendees ?? item.teaService?.attendees ?? null,
        teaServiceRequired: item.teaServiceRequired ?? true,
        teaService: { ...item.teaService },
        completed: Boolean(_teaServiceDoneByBookingId[item.bookingId || item.id])
      }
    })
}

export function setMockTeaServiceRequestCompleted (bookingId, completed) {
  if (!_teaServiceDoneByBookingId) _teaServiceDoneByBookingId = {}
  if (completed) {
    _teaServiceDoneByBookingId[bookingId] = true
  } else {
    delete _teaServiceDoneByBookingId[bookingId]
  }
  return getMockTeaServiceRequests()
}

export function getMockMeetingApprovedList () {
  if (_meetingApprovedList) return cloneMockList(_meetingApprovedList)
  _meetingApprovedList = [
    {
      id: 101,
      bookingId: 'BK20260319001',
      venueId: 1,
      venueName: 'Conference Room A',
      bookerEmployeeId: null,
      bookerCorpId: 'E099',
      userName: 'Bob Wilson',
      department: 'D&T',
      meetingTitle: 'Budget Review',
      date: '2026-03-24',
      time: '09:00-11:00',
      approvedAt: '2026-03-19 15:30',
      approvedBy: 'Admin'
    }
  ]
  return cloneMockList(_meetingApprovedList)
}

export function getMockMeetingRejectedList () {
  if (_meetingRejectedList) return cloneMockList(_meetingRejectedList)
  _meetingRejectedList = [
    {
      id: 201,
      bookingId: 'BK20260318001',
      venueId: 2,
      venueName: 'Conference Room B',
      bookerEmployeeId: null,
      bookerCorpId: 'E088',
      userName: 'Alice Brown',
      department: 'SOPD',
      meetingTitle: 'Casual Discussion',
      date: '2026-03-23',
      time: '15:00-17:00',
      rejectedAt: '2026-03-18 16:45',
      rejectedBy: 'Admin',
      reason: 'Meeting title not specific enough'
    }
  ]
  return cloneMockList(_meetingRejectedList)
}

export function getMockAccessRoleList () {
  if (_accessRoleList) return cloneMockList(_accessRoleList)
  _accessRoleList = [
    { id: 1, roleName: 'Admin', description: 'Admin user who has FULL control withour restructions over the system', AnnualVenueQuota: -1, AnnualEvQuota: -1, employeeCount: 15 },
    { id: 2, roleName: 'User', description: 'Regular user who can access EV and venue bookings', AnnualVenueQuota: 100, AnnualEvQuota: 60, employeeCount: 120 },
    { id: 3, roleName: 'User_EV', description: 'Regular user who can access EV booking ONLY', AnnualVenueQuota: 0, AnnualEvQuota: 60, employeeCount: 35 },
    { id: 4, roleName: 'User_Venue', description: 'Regular user who can access venue booking ONLY', AnnualVenueQuota: 100, AnnualEvQuota: 0, employeeCount: 8 }
  ]
  return cloneMockList(_accessRoleList)
}

export function getMockDepartmentList () {
  if (_departmentList) return cloneMockList(_departmentList)
  _departmentList = [
    { id: 1, departmentName: 'ADM', description: 'Administrative Services Division', employeeCount: 0 },
    { id: 2, departmentName: 'CNS', description: 'Community Nursing Services', employeeCount: 0 },
    { id: 3, departmentName: 'D&T', description: 'Domestic & Transportation', employeeCount: 0 },
    { id: 4, departmentName: 'EMSD', description: 'Electrical & Mechanical Services Department', employeeCount: 0 },
    { id: 5, departmentName: 'ENT', description: 'Department of Ear, Nose & Throat', employeeCount: 0 },
    { id: 6, departmentName: 'FM', description: 'Facility Management', employeeCount: 0 },
    { id: 7, departmentName: 'FM&PHC', description: 'Department of Family Medicine & Primary Health Care', employeeCount: 0 },
    { id: 8, departmentName: 'GO', description: 'General Office', employeeCount: 0 },
    { id: 9, departmentName: 'HCE', description: 'Hospital Chief Executive\'s Office', employeeCount: 0 },
    { id: 10, departmentName: 'HIRD', description: 'Health Information & Records Department', employeeCount: 0 },
    { id: 11, departmentName: 'HRC', description: 'Health Resources Centre', employeeCount: 0 },
    { id: 12, departmentName: 'HRD', description: 'Human Resources Division', employeeCount: 0 },
    { id: 13, departmentName: 'ICT', description: 'Infection Control Team', employeeCount: 0 },
    { id: 14, departmentName: 'ITD', description: 'Information Technology Department', employeeCount: 0 },
    { id: 15, departmentName: 'MED', description: 'Department of Medicine', employeeCount: 0 },
    { id: 16, departmentName: 'NSD', description: 'Nursing Services Division', employeeCount: 0 },
    { id: 17, departmentName: 'OPH', description: 'Department of Ophthalmology', employeeCount: 0 },
    { id: 18, departmentName: 'OSH', description: 'Occupational Safety and Health Team', employeeCount: 0 },
    { id: 19, departmentName: 'P&CR', description: 'Patient & Community Relations Department', employeeCount: 0 },
    { id: 20, departmentName: 'Path', description: 'Department of Pathology', employeeCount: 0 },
    { id: 21, departmentName: 'Pharm', description: 'Pharmacy', employeeCount: 0 },
    { id: 22, departmentName: 'PMMD', description: 'Procurement & Materials Management Department', employeeCount: 0 },
    { id: 23, departmentName: 'Q&S', description: 'Quality & Safety Office', employeeCount: 0 },
    { id: 24, departmentName: 'SOPD', description: 'Specialist Out-patient Department', employeeCount: 0 },
    { id: 25, departmentName: 'SS', description: 'Supporting Services', employeeCount: 0 }
  ]
  return cloneMockList(_departmentList)
}

export function getMockEVParkingList () {
  if (_parkingList) return cloneMockList(_parkingList)
  _parkingList = [
    { id: 1, evSpace: 'A-01', location: 'Ground Floor', status: 'active' },
    { id: 2, evSpace: 'B-01', location: 'Level 1', status: 'active' },
    { id: 3, evSpace: 'C-01', location: 'Level 2', status: 'active' }
  ]
  return cloneMockList(_parkingList)
}

export function getMockEVTimePeriods () {
  if (_evTimePeriods) return cloneMockList(_evTimePeriods)
  _evTimePeriods = [
    { id: 1, period: 'AM', startTime: '08:30', endTime: '13:00', status: 'active' },
    { id: 2, period: 'PM', startTime: '13:45', endTime: '18:15', status: 'active' },
    { id: 3, period: 'Night', startTime: '19:00', endTime: '23:30', status: 'active' }
  ]
  return cloneMockList(_evTimePeriods)
}

export function getMockPromptList () {
  if (_promptList) return cloneMockList(_promptList)
  _promptList = [
    {
      id: 1,
      key: 'ev_booking_points_to_note',
      name: 'EV Booking Points to Note',
      content: `<p><strong>Points to Note:</strong></p><ol><li>TKOH Car Park Reservation System allows access by nominated staff only.</li><li>Visitors coming to TKOH to attend meeting or to deliver presentation at lecture/seminar/workshop, or to service or technical support should make booking through the nominated staff.</li><li>Booking is not available for visitors coming to attend training, course, seminar or workshop.</li><li>Booking for contractors or suppliers for whatever purpose is not accepted.</li><li>Booking should be made at least 5 working days before the date of parking.</li><li>Confirmation of booking will be announced on the system 5 days before the date of parking.</li><li>Amendment for car registration number or booking details must be notified in advance.</li><li>Reserved parking-space will be allocated to other users if the registered car does not show up one hour after.</li><li>Owing to the limited number of parking-spaces in the Reserved Carpark, acceptance of car park reservation of a parking-space.</li></ol>`,
      category: 'system_fixed',
      canAdd: false
    },
    {
      id: 2,
      key: 'venue_booking_points_to_note',
      name: 'Venue Booking Points to Note',
      content: `<p><strong>Points to Note:</strong></p><ol><li>For reservation of other venues (e.g. Courtyard or Glasshouse), please contact General Office at <strong>2208 1951</strong> directly.</li><li>General Office reserves the right to cancel any booking or reassign another venue under necessary circumstances.</li><li>Should user require the following service for the meeting, please directly contact the respective department in advance for arrangement.</li></ol>
<table>
  <thead>
    <tr>
      <th>Service/Equipment</th>
      <th>Subject Department</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Zoom/Video Conferencing</td>
      <td>Information Technology Dept (Tel: 2208 1830)</td>
    </tr>
    <tr>
      <td>Venue Setting / Furniture on-loan</td>
      <td>Facility Management Dept (Tel: 2208 1845)</td>
    </tr>
    <tr>
      <td>Equipment on-loan</td>
      <td>General Office (Tel: 2208 1951)</td>
    </tr>
    <tr>
      <td>Tea Service for Conference Rooms (ad-hoc)</td>
      <td>General Office (Tel: 2208 1951)</td>
    </tr>
    <tr>
      <td>Tea Service for Other Venue and Rooms</td>
      <td>Via ADS</td>
    </tr>
  </tbody>
</table>`,
      category: 'system_fixed',
      canAdd: false
    },
    {
      id: 3,
      key: 'venue_add_booking_setup',
      name: 'Venue Setup',
      content: 'Contact FM (Ext. 1845)',
      category: 'system_fixed',
      canAdd: false
    },
    {
      id: 4,
      key: 'venue_add_booking_equipment',
      name: 'Equipment',
      content: 'Contact ITD (Ext. 1830)',
      category: 'system_fixed',
      canAdd: false
    },
    {
      id: 5,
      key: 'venue_add_booking_tools_materials',
      name: 'Tools and Materials',
      content: 'Contact GO (Ext. 1896)',
      category: 'system_fixed',
      canAdd: false
    },
    {
      id: 6,
      key: 'venue_add_booking_others_special_requests',
      name: 'Others / Special Requests',
      content: 'Contact GO (Ext. 1896)',
      category: 'system_fixed',
      canAdd: false
    },
    {
      id: 18,
      key: 'venue_add_booking_tea_service',
      name: 'Tea Service Required',
      content: 'Reminder prompt:\nOther venues: ADS, Ad hoc bookings: GO',
      category: 'system_fixed',
      canAdd: false
    },
    {
      id: 9,
      key: 'meeting_approval_reject_template',
      name: 'Meeting Title Non-compliant',
      content: 'Your meeting booking request is rejected because the meeting title is not compliant. Please provide a clear and business-related title.',
      category: 'reject_template',
      canAdd: true,
      templateType: 'meeting_approval'
    },
    {
      id: 10,
      key: 'meeting_approval_reject_template',
      name: 'Insufficient Meeting Details',
      content: 'Your meeting booking request is rejected due to insufficient meeting details. Please complete the purpose and required information before resubmission.',
      category: 'reject_template',
      canAdd: true,
      templateType: 'meeting_approval'
    },
    {
      id: 11,
      key: 'meeting_approval_reject_template',
      name: 'Duplicate Time Slot Booking',
      content: 'Your meeting booking request is rejected because the selected date/time conflicts with an existing booking under your account.',
      category: 'reject_template',
      canAdd: true,
      templateType: 'meeting_approval'
    },
    {
      id: 8,
      key: 'user_application_reject_template',
      name: 'User Application Reject Template',
      content: 'Your user application is rejected. Reason: {reason}',
      category: 'reject_template',
      canAdd: true,
      templateType: 'user_application'
    },
    {
      id: 12,
      key: 'user_application_reject_template',
      name: 'Invalid Contact Phone Number',
      content: 'Your user application is rejected because the contact telephone number is invalid. Please provide a valid and reachable phone number.',
      category: 'reject_template',
      canAdd: true,
      templateType: 'user_application'
    },
    {
      id: 13,
      key: 'user_application_reject_template',
      name: 'Email Format Invalid',
      content: 'Your user application is rejected due to invalid email format. Please provide a valid corporate email address.',
      category: 'reject_template',
      canAdd: true,
      templateType: 'user_application'
    },
    {
      id: 14,
      key: 'user_application_reject_template',
      name: 'Department / Unit Information Missing',
      content: 'Your user application is rejected because department information is missing or incorrect. Please update and submit again.',
      category: 'reject_template',
      canAdd: true,
      templateType: 'user_application'
    },
    {
      id: 15,
      key: 'ev_alert_message',
      name: 'EV Alert Message',
      content: `<p class="attention-line">[ For Attention, please ]</p>
<p class="main-title">Updates on Booking Rules of EV Charging Facilities</p>
<p class="section-title">Effective from 01 JAN 2025</p>
<p class="line-item">a. Booking quota: Change from 2 sessions/week to <span class="change-highlight">1 session/week</span></p>
<p class="line-item">b. Period of AM session: Change from 09:00hr-13:15hr to <span class="change-highlight">08:30hr-13:00hr</span></p>
<p class="line-item">c. Period of PM session: Change from 14:00hr-18:15hr to <span class="change-highlight">13:45hr-18:15hr</span></p>
<p class="section-title">Effective from 13 JAN 2025</p>
<p class="line-item">d. New booking timeslots releasing time: Change from 00:00hr everyday to <span class="change-highlight">13:00hr everyday</span></p>`,
      category: 'system_fixed',
      canAdd: false
    },
    {
      id: 16,
      key: 'venue_alert_message',
      name: 'Venue Alert Message',
      content: `<p class="venue-notice-line">Lecture Theatre is temporarily closed.</p>
<p class="venue-notice-line zh">演講廳暫停使用</p>`,
      category: 'system_fixed',
      canAdd: false
    }
  ]
  return cloneMockList(_promptList)
}

export function getMockVenueList () {
  if (_venueList) return cloneMockList(_venueList)
  _venueList = [
    {
      id: 1,
      name: 'Conference Room 1',
      nameZh: '會議室1',
      tab: 'conference_discussion',
      type: 'conference',
      color: '#3b82f6',
      location: '8/F Ambulatory Care Block',
      locationZh: '日間醫療大樓8樓',
      roomCapacity: 8,
      displayType: 'merge',
      userDefinedUploadEventTitle: true,
      image: '',
      blocks: [
        { id: 1001, startAt: '2026-03-30 13:00', endAt: '2026-03-30 16:00', reason: 'Projector maintenance' }
      ],
      status: 'active'
    },
    { id: 2, name: 'Conference Room 2', nameZh: '會議室2', tab: 'conference_discussion', type: 'conference', color: '#10b981', location: '8/F Ambulatory Care Block', locationZh: '日間醫療大樓8樓', roomCapacity: 20, displayType: 'merge', userDefinedUploadEventTitle: true, image: '', blocks: [], status: 'active' },
    { id: 3, name: 'Conference Room 3', nameZh: '會議室3', tab: 'conference_discussion', type: 'conference', color: '#06b6d4', location: '8/F Ambulatory Care Block', locationZh: '日間醫療大樓8樓', roomCapacity: 40, displayType: 'merge', userDefinedUploadEventTitle: true, image: '', blocks: [], status: 'active' },
    { id: 4, name: 'Discussion Room', nameZh: '討論室', tab: 'conference_discussion', type: 'discussion', color: '#f59e0b', location: '3F', locationZh: '3樓', roomCapacity: 12, displayType: 'single', userDefinedUploadEventTitle: true, image: '', blocks: [], status: 'active' },
    { id: 5, name: 'Function Room', nameZh: '多功能室', tab: 'other_venues', type: 'other', color: '#ec4899', location: 'Ground Floor', locationZh: '地下', roomCapacity: 60, displayType: 'single', userDefinedUploadEventTitle: true, image: '', blocks: [], status: 'active' },
    { id: 6, name: 'Lecture Theatre', nameZh: '演講廳', tab: 'other_venues', type: 'other', color: '#6366f1', location: '8/F Ambulatory Care Block', locationZh: '日間醫療大樓8樓', roomCapacity: 70, displayType: 'single', userDefinedUploadEventTitle: true, image: '', blocks: [], status: 'active' },
    { id: 7, name: 'Auditorium', nameZh: '禮堂', tab: 'other_venues', type: 'other', color: '#8b5cf6', location: '1F', locationZh: '1樓', roomCapacity: 99, displayType: 'single', userDefinedUploadEventTitle: true, image: '', blocks: [], status: 'active' }
  ]
  return cloneMockList(_venueList)
}

export function getMockLicensePlateList () {
  if (_licensePlateList) return cloneMockList(_licensePlateList)

  _licensePlateList = [
    { id: 1, userId: 1, corpId: 'E001', owner: 'John Doe', plateNumber: 'SJA1234A', status: 'active' },
    { id: 2, userId: 2, corpId: 'E002', owner: 'Jane Smith', plateNumber: 'SJB5678B', status: 'active' },
    { id: 3, userId: 6, corpId: 'E006', owner: 'Olivia Chan', plateNumber: 'SKO9012C', status: 'inactive' },
    { id: 4, userId: 20, corpId: 'E020', owner: 'Ivy Cheong', plateNumber: 'SKP3456D', status: 'active' }
  ]

  return cloneMockList(_licensePlateList)
}

export function getMockAccountVehicleList () {
  if (_accountVehicleList) return cloneMockList(_accountVehicleList)
  _accountVehicleList = [
    { plate: 'AB1234', isDefault: true },
    { plate: 'CD5678', isDefault: false }
  ]
  return cloneMockList(_accountVehicleList)
}

export function getMockEVManageBookingList () {
  const normalizeEvManageBookingMock = (row) => ({
    ...row,
    submittedAt: row.submittedAt || (row.bookedOn ? `${row.bookedOn} 09:30` : ''),
    reservedBy: row.reservedBy || undefined,
    submitter: row.submitter || row.reservedBy || undefined
  })
  if (_evManageBookingList) {
    return cloneMockList(_evManageBookingList).map(normalizeEvManageBookingMock)
  }
  _evManageBookingList = [
    { id: 1, licensePlate: 'YZ4567', space: 'B2', date: '28 Mar 2026', time: 'AM (08:30 - 13:00)', bookedOn: '17 Mar 2026', status: 'upcoming' },
    { id: 2, licensePlate: 'YZ4567', space: 'B3', date: '3 Mar 2026', time: 'AM (08:30 - 13:00)', bookedOn: '25 Feb 2026', status: 'upcoming' },
    { id: 3, licensePlate: 'AB1234', space: 'B2', date: '12 Feb 2026', time: 'PM (13:45 - 18:15)', bookedOn: '3 Feb 2026', status: 'upcoming' },
    { id: 4, licensePlate: 'HK7890', space: 'B1', date: '7 Feb 2026', time: 'Night (19:00 - 23:30)', bookedOn: '4 Feb 2026', status: 'upcoming' },
    { id: 5, licensePlate: 'YZ4567', space: 'B3', date: '3 Feb 2026', time: 'AM (08:30 - 13:00)', bookedOn: '25 Jan 2026', status: 'past' },
    { id: 6, licensePlate: 'AB1234', space: 'B2', date: '28 Jan 2026', time: 'PM (13:45 - 18:15)', bookedOn: '20 Jan 2026', status: 'cancelled' },
    { id: 7, licensePlate: 'CD5678', space: 'B1', date: '15 Mar 2026', time: 'AM (08:30 - 13:00)', bookedOn: '10 Mar 2026', status: 'upcoming' },
    { id: 8, licensePlate: 'EF9012', space: 'B3', date: '18 Mar 2026', time: 'PM (13:45 - 18:15)', bookedOn: '12 Mar 2026', status: 'upcoming' },
    { id: 9, licensePlate: 'GH3456', space: 'B2', date: '22 Mar 2026', time: 'Night (19:00 - 23:30)', bookedOn: '15 Mar 2026', status: 'upcoming' },
    { id: 10, licensePlate: 'AB1234', space: 'B1', date: '25 Mar 2026', time: 'AM (08:30 - 13:00)', bookedOn: '18 Mar 2026', status: 'upcoming' },
    { id: 11, licensePlate: 'YZ4567', space: 'B2', date: '5 Feb 2026', time: 'PM (13:45 - 18:15)', bookedOn: '28 Jan 2026', status: 'past' },
    { id: 12, licensePlate: 'HK7890', space: 'B3', date: '8 Feb 2026', time: 'AM (08:30 - 13:00)', bookedOn: '1 Feb 2026', status: 'past' },
    { id: 13, licensePlate: 'CD5678', space: 'B1', date: '10 Feb 2026', time: 'Night (19:00 - 23:30)', bookedOn: '3 Feb 2026', status: 'past' },
    { id: 14, licensePlate: 'EF9012', space: 'B2', date: '14 Feb 2026', time: 'PM (13:45 - 18:15)', bookedOn: '7 Feb 2026', status: 'past' },
    { id: 15, licensePlate: 'GH3456', space: 'B3', date: '20 Feb 2026', time: 'AM (08:30 - 13:00)', bookedOn: '13 Feb 2026', status: 'cancelled' },
    { id: 16, licensePlate: 'AB1234', space: 'B1', date: '30 Mar 2026', time: 'PM (13:45 - 18:15)', bookedOn: '23 Mar 2026', status: 'upcoming' },
    { id: 17, licensePlate: 'YZ4567', space: 'B3', date: '2 Apr 2026', time: 'AM (08:30 - 13:00)', bookedOn: '25 Mar 2026', status: 'upcoming' },
    { id: 18, licensePlate: 'HK7891', space: 'B2', date: '5 Apr 2026', time: 'Night (19:00 - 23:30)', bookedOn: '28 Mar 2026', status: 'upcoming' },
    { id: 19, licensePlate: 'HK7890', space: 'B1', date: '5 Apr 2026', time: 'Night (19:00 - 23:30)', bookedOn: '28 Mar 2026', status: 'upcoming' },
    { id: 20, licensePlate: 'HK7895', space: 'B3', date: '5 Apr 2026', time: 'Night (19:00 - 23:30)', bookedOn: '28 Mar 2026', status: 'upcoming' },
    { id: 21, licensePlate: 'HK7892', space: 'B1', date: '5 Apr 2026', time: 'AM (08:30 - 13:00)', bookedOn: '28 Mar 2026', status: 'upcoming' },
    { id: 22, licensePlate: 'HK7893', space: 'B2', date: '5 Apr 2026', time: 'AM (08:30 - 13:00)', bookedOn: '28 Mar 2026', status: 'upcoming' },
    { id: 23, licensePlate: 'HK7894', space: 'B3', date: '5 Apr 2026', time: 'AM (08:30 - 13:00)', bookedOn: '28 Mar 2026', status: 'upcoming' },
    { id: 24, licensePlate: 'HK7895', space: 'B1', date: '5 Apr 2026', time: 'PM (13:45 - 18:15)', bookedOn: '28 Mar 2026', status: 'upcoming' },
    { id: 25, licensePlate: 'HK7896', space: 'B2', date: '5 Apr 2026', time: 'PM (13:45 - 18:15)', bookedOn: '28 Mar 2026', status: 'upcoming' },
    { id: 26, licensePlate: 'HK7897', space: 'B3', date: '5 Apr 2026', time: 'PM (13:45 - 18:15)', bookedOn: '28 Mar 2026', status: 'upcoming' },
    { id: 27, employeeId: 1, corpId: 'Admin-test', reservedBy: 'Admin Test User', submitter: 'Admin Test User', email: 'employee1@tkho.local', licensePlate: 'AT1001', space: 'B1', date: '8 Apr 2026', time: 'AM (08:30 - 13:00)', bookedOn: '1 Apr 2026', status: 'upcoming' },
    { id: 28, employeeId: 1, corpId: 'Admin-test', reservedBy: 'Admin Test User', email: 'employee1@tkho.local', licensePlate: 'AT1001', space: 'B2', date: '27 Mar 2026', time: 'PM (13:45 - 18:15)', bookedOn: '20 Mar 2026', status: 'past' },
    { id: 29, employeeId: 1, corpId: 'Admin-test', reservedBy: 'Admin Test User', email: 'employee1@tkho.local', licensePlate: 'AT1001', space: 'B3', date: '10 Apr 2026', time: 'Night (19:00 - 23:30)', bookedOn: '3 Apr 2026', status: 'cancelled' }
  ]
  return cloneMockList(_evManageBookingList).map(normalizeEvManageBookingMock)
}

export function getMockVenueManageBookingList () {
  const normalizeVenueManageBookingMock = (row) => ({
    ...row,
    submitter: row.submitter || row.reservedBy || undefined
  })
  if (_venueManageBookingList) {
    return cloneMockList(_venueManageBookingList).map(normalizeVenueManageBookingMock)
  }
  _venueManageBookingList = [
    { id: 1, topic: 'Department Monthly Review', room: 'Conference Room 1', date: '10 Feb 2026', time: '10:00 - 11:30', bookedOn: '28 Jan 2026 14:30', status: 'upcoming', type: 'venue', reservedBy: 'Chan Tai Man', contact: '12345678', email: 'abc@xyz.com', teaServiceRequired: true, teaServiceSummary: 'Tea / One Pot', teaServiceParticipants: 8, approvalStatus: 'pending', approvedBy: '', approvedAt: '', rejectReason: '' },
    { id: 2, topic: 'Project Kick-off Meeting', room: 'Discussion Room', date: '5 May 2026', time: '14:00 - 15:30', bookedOn: '30 Mar 2026 09:15', status: 'upcoming', type: 'venue', reservedBy: 'Karen Shen', contact: '12345678', email: 'karen.shen@ha.org.hk', teaServiceRequired: false, approvalStatus: 'approved', approvedBy: 'Admin', approvedAt: '30 Jan 2026 09:15', rejectReason: '' },
    { id: 3, topic: 'Training Session - New Staff', room: 'Lecture Theatre', date: '20 Jan 2026', time: '09:00 - 10:45', bookedOn: '10 Jan 2026 16:20', status: 'past', type: 'venue', reservedBy: 'John Doe', contact: '87654321', email: 'john.doe@ha.org.hk', teaServiceRequired: false, approvalStatus: 'approved', approvedBy: 'Admin', approvedAt: '10 Jan 2026 16:20', rejectReason: '' },
    { id: 4, topic: 'Budget Planning Meeting', room: 'Conference Room 2', date: '12 Feb 2026', time: '13:00 - 14:30', bookedOn: '29 Jan 2026 11:45', status: 'upcoming', type: 'venue', reservedBy: 'Mary Wong', contact: '23456789', email: 'mary.wong@ha.org.hk', teaServiceRequired: false, approvalStatus: 'approved', approvedBy: 'Admin', approvedAt: '29 Jan 2026 11:45', rejectReason: '' },
    { id: 5, topic: 'Team Building Workshop', room: 'Function Room', date: '15 Feb 2026', time: '09:00 - 17:00', bookedOn: '01 Feb 2026 08:30', status: 'upcoming', type: 'venue', reservedBy: 'Peter Lee', contact: '34567890', email: 'peter.lee@ha.org.hk', teaServiceRequired: true, teaServiceSummary: 'Water / One Bottle Per Person', teaServiceParticipants: 20, approvalStatus: 'pending', approvedBy: '', approvedAt: '', rejectReason: '' },
    { id: 6, topic: 'Client Presentation', room: 'Conference Room 3', date: '18 Jan 2026', time: '15:00 - 16:30', bookedOn: '08 Jan 2026 13:10', status: 'past', type: 'venue', reservedBy: 'Sarah Chen', contact: '45678901', email: 'sarah.chen@ha.org.hk', teaServiceRequired: false, approvalStatus: 'approved', approvedBy: 'Admin', approvedAt: '08 Jan 2026 13:10', rejectReason: '' },
    { id: 7, topic: 'IT Security Briefing', room: 'Discussion Room 2', date: '08 Feb 2026', time: '10:30 - 12:00', bookedOn: '25 Jan 2026 15:40', status: 'upcoming', type: 'venue', reservedBy: 'David Lam', contact: '56789012', email: 'david.lam@ha.org.hk', teaServiceRequired: false, approvalStatus: 'approved', approvedBy: 'Admin', approvedAt: '25 Jan 2026 15:40', rejectReason: '' },
    { id: 8, topic: 'Annual Performance Review', room: 'Conference Room 1', date: '22 Jan 2026', time: '14:00 - 16:00', bookedOn: '12 Jan 2026 10:25', status: 'past', type: 'venue', reservedBy: 'Emily Ng', contact: '67890123', email: 'emily.ng@ha.org.hk', teaServiceRequired: false, approvalStatus: 'approved', approvedBy: 'Admin', approvedAt: '12 Jan 2026 10:25', rejectReason: '' },
    { id: 9, topic: 'Product Launch Planning', room: 'Auditorium', date: '20 Feb 2026', time: '09:30 - 11:00', bookedOn: '03 Feb 2026 12:50', status: 'upcoming', type: 'venue', reservedBy: 'Michael Chow', contact: '78901234', email: 'michael.chow@ha.org.hk', teaServiceRequired: true, teaServiceSummary: 'Tea / One Bottle Per Person', teaServiceParticipants: 35, approvalStatus: 'approved', approvedBy: 'Admin', approvedAt: '03 Feb 2026 12:50', rejectReason: '' },
    { id: 10, topic: 'HR Policy Update Session', room: 'Lecture Theatre', date: '25 Feb 2026', time: '13:30 - 15:00', bookedOn: '05 Feb 2026 09:05', status: 'upcoming', type: 'venue', reservedBy: 'Linda Tsang', contact: '89012345', email: 'linda.tsang@ha.org.hk', teaServiceRequired: false, approvalStatus: 'approved', approvedBy: 'Admin', approvedAt: '05 Feb 2026 09:05', rejectReason: '' },
    { id: 11, topic: 'Quarterly Business Review', room: 'Conference Room 2', date: '28 Feb 2026', time: '10:00 - 12:00', bookedOn: '06 Feb 2026 14:15', status: 'upcoming', type: 'venue', reservedBy: 'Robert Chan', contact: '90123456', email: 'robert.chan@ha.org.hk', teaServiceRequired: false, approvalStatus: 'approved', approvedBy: 'Admin', approvedAt: '06 Feb 2026 14:15', rejectReason: '' },
    { id: 12, topic: 'Marketing Strategy Meeting', room: 'Discussion Room', date: '15 Jan 2026', time: '11:00 - 12:30', bookedOn: '05 Jan 2026 16:55', status: 'canceled', type: 'venue', reservedBy: 'Jessica Liu', contact: '01234567', email: 'jessica.liu@ha.org.hk', teaServiceRequired: false, approvalStatus: 'rejected', approvedBy: '', approvedAt: '', rejectReason: 'Booking rejected by admin' },
    { id: 13, topic: 'Vendor Negotiation', room: 'Conference Room 3', date: '03 Mar 2026', time: '14:30 - 16:00', bookedOn: '07 Feb 2026 11:20', status: 'upcoming', type: 'venue', reservedBy: 'Thomas Yip', contact: '11223344', email: 'thomas.yip@ha.org.hk', teaServiceRequired: false, approvalStatus: 'approved', approvedBy: 'Admin', approvedAt: '07 Feb 2026 11:20', rejectReason: '' },
    { id: 14, employeeId: 1, corpId: 'Admin-test', topic: 'Admin Monthly Operations Sync', room: 'Conference Room 1', date: '12 Apr 2026', time: '10:00 - 11:00', bookedOn: '02 Apr 2026 09:40', status: 'upcoming', type: 'venue', reservedBy: 'Admin-test', contact: '91000000', email: 'employee1@tkho.local', teaServiceRequired: true, teaServiceSummary: 'Tea / One Pot', teaServiceParticipants: 6, approvalStatus: 'approved', approvedBy: 'Admin', approvedAt: '02 Apr 2026 09:45', rejectReason: '' },
    { id: 15, employeeId: 1, corpId: 'Admin-test', topic: 'Admin-test System Review', room: 'Discussion Room', date: '22 Mar 2026', time: '15:00 - 16:00', bookedOn: '15 Mar 2026 16:20', status: 'past', type: 'venue', reservedBy: 'Admin-test', contact: '91000000', email: 'employee1@tkho.local', teaServiceRequired: false, approvalStatus: 'approved', approvedBy: 'Admin', approvedAt: '15 Mar 2026 16:25', rejectReason: '' },
    { id: 16, employeeId: 1, corpId: 'Admin-test', topic: 'Admin-test Budget Workshop', room: 'Function Room', date: '18 Apr 2026', time: '14:00 - 16:00', bookedOn: '06 Apr 2026 11:10', status: 'canceled', type: 'venue', reservedBy: 'Admin-test', contact: '91000000', email: 'employee1@tkho.local', teaServiceRequired: true, teaServiceSummary: 'Water / One Bottle Per Person', teaServiceParticipants: 18, approvalStatus: 'rejected', approvedBy: '', approvedAt: '', rejectReason: 'Rescheduled by organizer' }
  ]
  return cloneMockList(_venueManageBookingList).map(normalizeVenueManageBookingMock)
}

export function getMockVenueCalendarBookingList ({ today = new Date() } = {}) {
  if (_venueCalendarBookingList) return cloneMockList(_venueCalendarBookingList)

  const baseDate = new Date(today)
  const tomorrow = new Date(baseDate)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dayAfterTomorrow = new Date(baseDate)
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2)
  const threeDaysLater = new Date(baseDate)
  threeDaysLater.setDate(threeDaysLater.getDate() + 3)
  const fourDaysLater = new Date(baseDate)
  fourDaysLater.setDate(fourDaysLater.getDate() + 4)
  const nextWeek = new Date(baseDate)
  nextWeek.setDate(nextWeek.getDate() + 7)

  _venueCalendarBookingList = [
    { id: 1, roomName: 'Conference Room 1', date: baseDate.toISOString(), startTime: '08:00', endTime: '09:00', attendees: 5, topic: 'Labour Department OSH Inspection Meeting', notes: 'Weekly team meeting', reservedBy: 'John Smith', contact: '62001000' },
    { id: 2, roomName: 'Conference Room 2', date: baseDate.toISOString(), startTime: '09:00', endTime: '11:00', attendees: 8, topic: 'Booking System Discussion with JW', notes: 'Client presentation', reservedBy: 'Mary Johnson', contact: '62001001' },
    { id: 3, roomName: 'Conference Room 3', date: baseDate.toISOString(), startTime: '11:00', endTime: '12:00', attendees: 6, topic: 'Testing Session', notes: 'QA meeting', reservedBy: 'David Lee', contact: '62001002' },
    { id: 4, roomName: 'Conference Room 1', date: baseDate.toISOString(), startTime: '13:30', endTime: '15:00', attendees: 10, topic: 'Strategy Planning', notes: 'Quarterly review', reservedBy: 'Sarah Wilson', contact: '62001003' },
    { id: 5, roomName: 'Discussion Room', date: baseDate.toISOString(), startTime: '10:00', endTime: '11:30', attendees: 4, topic: 'Project Discussion', notes: 'Sprint planning', reservedBy: 'Michael Chen', contact: '62001004' },
    { id: 6, roomName: 'Conference Room 2', date: baseDate.toISOString(), startTime: '14:00', endTime: '16:00', attendees: 12, topic: 'Training Workshop', notes: 'New employee orientation', reservedBy: 'Lisa Brown', contact: '62001005' },
    { id: 7, roomName: 'Function Room', date: baseDate.toISOString(), startTime: '09:30', endTime: '12:00', attendees: 20, topic: 'Department Meeting', notes: 'Monthly all-hands', reservedBy: 'Robert Taylor', contact: '62001006' },
    { id: 8, roomName: 'Conference Room 3', date: baseDate.toISOString(), startTime: '15:00', endTime: '17:00', attendees: 8, topic: 'Client Presentation', notes: 'Product demo', reservedBy: 'Jennifer White', contact: '62001007' },
    { id: 9, roomName: 'Lecture Theatre', date: baseDate.toISOString(), startTime: '13:00', endTime: '15:30', attendees: 50, topic: 'Annual Conference', notes: 'Company-wide event', reservedBy: 'James Anderson', contact: '62001008' },
    { id: 10, roomName: 'Discussion Room', date: baseDate.toISOString(), startTime: '16:00', endTime: '17:30', attendees: 5, topic: 'Code Review', notes: 'Development team sync', reservedBy: 'Emily Davis', contact: '62001009' },
    { id: 11, roomName: 'Conference Room 1', date: tomorrow.toISOString(), startTime: '10:00', endTime: '11:30', attendees: 3, topic: 'Project discussion', notes: 'Project discussion', reservedBy: 'Tom Harris', contact: '62001010' },
    { id: 12, roomName: 'Conference Room 2', date: tomorrow.toISOString(), startTime: '14:00', endTime: '15:30', attendees: 6, topic: 'Budget Review', notes: 'Finance meeting', reservedBy: 'Patricia Moore', contact: '62001011' },
    { id: 13, roomName: 'Conference Room 3', date: dayAfterTomorrow.toISOString(), startTime: '09:00', endTime: '10:30', attendees: 8, topic: 'Design Review', notes: 'UI/UX discussion', reservedBy: 'Kevin Garcia', contact: '62001012' },
    { id: 14, roomName: 'Conference Room 1', date: threeDaysLater.toISOString(), startTime: '11:00', endTime: '12:00', attendees: 5, topic: 'Sprint Planning', notes: 'Agile team meeting', reservedBy: 'Amanda Martinez', contact: '62001013' },
    { id: 15, roomName: 'Discussion Room', date: fourDaysLater.toISOString(), startTime: '15:00', endTime: '16:30', attendees: 4, topic: 'Team Sync', notes: 'Weekly standup', reservedBy: 'Christopher Lee', contact: '62001014' },
    { id: 16, roomName: 'Conference Room A', date: nextWeek.toISOString(), startTime: '13:00', endTime: '14:00', attendees: 4, topic: 'Training session', notes: 'Training session', reservedBy: 'Nancy Martin', contact: '62001015', color: '#f43f5e' }
  ]

  return cloneMockList(_venueCalendarBookingList)
}

export function generateEVBookingsMock ({
  days = 14,
  periods = ['am', 'pm', 'night'],
  totalPerSlot = 3,
  // 默认从“当前时间”开始生成，保持与原组件一致的随机体验
  today = new Date()
} = {}) {
  const bookings = {}

  const base = new Date(today)
  const formatDate = (date) => date.toISOString().split('T')[0]

  for (let i = 0; i < days; i++) {
    const date = new Date(base)
    date.setDate(date.getDate() + i)
    const dateStr = formatDate(date)

    periods.forEach((period) => {
      const key = `${dateStr}-${period}`
      const random = Math.random()

      if (random < 0.15) {
        bookings[key] = { available: 0, total: totalPerSlot }
      } else if (random < 0.30) {
        bookings[key] = { available: 1, total: totalPerSlot }
      } else if (random < 0.50) {
        bookings[key] = { available: 2, total: totalPerSlot }
      } else {
        bookings[key] = { available: totalPerSlot, total: totalPerSlot }
      }
    })
  }

  return bookings
}

function cloneBookingWindow (window) {
  return {
    ...window,
    history: Array.isArray(window.history) ? window.history.map(item => ({ ...item })) : []
  }
}

function ensureBookingWindows () {
  if (_bookingWindows) return
  const formatDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const today = new Date()
  const evEnd = new Date(today)
  evEnd.setDate(evEnd.getDate() + 13)
  const now = new Date().toISOString()
  _bookingWindows = {
    venue: {
      resourceType: 'venue',
      currentStartDate: '2026-01-01',
      currentEndDate: '2026-12-31',
      updatedBy: 'System Admin',
      updatedAt: now,
      history: [
        {
          id: 1,
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          publishedAt: now,
          publishedBy: 'System Admin'
        }
      ]
    },
    ev: {
      resourceType: 'ev',
      currentStartDate: formatDate(today),
      currentEndDate: formatDate(evEnd),
      evDateUpdateTime: '13:00',
      updatedBy: 'System Admin',
      updatedAt: now,
      history: [
        {
          id: 1,
          startDate: formatDate(today),
          endDate: formatDate(evEnd),
          publishedAt: now,
          publishedBy: 'System Admin'
        }
      ]
    }
  }
}

export function getMockBookingWindow (resourceType) {
  ensureBookingWindows()
  const key = resourceType === 'ev' ? 'ev' : 'venue'
  return cloneBookingWindow(_bookingWindows[key])
}

export function publishMockBookingWindow ({ resourceType, startDate, endDate, publishedBy = 'Admin' }) {
  ensureBookingWindows()
  const key = resourceType === 'ev' ? 'ev' : 'venue'
  const target = _bookingWindows[key]
  const now = new Date().toISOString()

  target.currentStartDate = startDate
  target.currentEndDate = endDate
  target.updatedBy = publishedBy
  target.updatedAt = now
  target.history.unshift({
    id: Date.now(),
    startDate,
    endDate,
    publishedAt: now,
    publishedBy
  })

  return cloneBookingWindow(target)
}

function ensureDisplayConfig () {
  if (_displayConfig) return
  _displayConfig = {
    venueDisplayMode: 'mixed',
    evDisplayMode: 'single',
    evDisplaySettings: {
      footerTickerText: '請依照已預約之時段及車位泊車，並於離場前移走車輛。'
    },
    venueRules: [
      { venueId: 1, displayType: 'merge', mergeGroup: 'Group A', displayName: 'CR1', arrowDirection: 'up-left' },
      { venueId: 2, displayType: 'merge', mergeGroup: 'Group A', displayName: 'CR2', arrowDirection: 'right' },
      { venueId: 3, displayType: 'merge', mergeGroup: '', displayName: 'CR3', arrowDirection: 'right' },
      { venueId: 4, displayType: 'single', mergeGroup: '', displayName: '', arrowDirection: '' },
      { venueId: 5, displayType: 'single', mergeGroup: 'Group B', displayName: '', arrowDirection: '' },
      { venueId: 6, displayType: 'single', mergeGroup: 'Group B', displayName: '', arrowDirection: '' },
      { venueId: 7, displayType: 'single', mergeGroup: '', displayName: '', arrowDirection: '' },
      { venueId: null, displayType: 'single', mergeGroup: '', displayName: 'EV', arrowDirection: '' }
    ],
    mergeDisplaySettings: {
      panelTitleText: 'Conference Room | 8/F Ambulatory Care Block\n會議室 | 日間醫療大樓8樓',
        footerTickerText: '如對會議室有任何疑問，請向總務部查詢 (電話：2208 1812)。若感覺身體不適，特別是發燒或咳嗽，請在會議期間佩戴外科口罩並儘快就醫。For enquiries regarding Conference Rooms, please contact General Office (Tel: 2208 1812). If feeling unwell, especially if experiencing a fever or cough, wear a surgical mask during the meeting and seek medical advice as soon as possible.',
        qrCodeImage: ''
    },
    updatedBy: 'System Admin',
    updatedAt: new Date().toISOString()
  }
}

export function getMockDisplayConfig () {
  ensureDisplayConfig()
  const mergeDisplaySettings = _displayConfig.mergeDisplaySettings || {
    panelTitleText: '',
    footerTickerText: '',
    qrCodeImage: ''
  }
  const evDisplaySettings = _displayConfig.evDisplaySettings || {
    footerTickerText: ''
  }
  const fallbackTicker = [mergeDisplaySettings.footerLine1, mergeDisplaySettings.footerLine2]
    .filter(Boolean)
    .join('  |  ')
  const legacyPanelTitle = [mergeDisplaySettings.panelTitleLine1, mergeDisplaySettings.panelTitleLine2]
    .filter(Boolean)
    .join('\n')
  return {
    ..._displayConfig,
    venueRules: _displayConfig.venueRules.map(item => ({
      ...item,
      venueId: item.venueId ?? null,
      displayName: item.displayName ?? '',
      arrowDirection: item.arrowDirection ?? ''
    })),
    mergeDisplaySettings: {
      panelTitleText: mergeDisplaySettings.panelTitleText || legacyPanelTitle || '',
      footerTickerText: mergeDisplaySettings.footerTickerText || fallbackTicker || '',
      qrCodeImage: mergeDisplaySettings.qrCodeImage || ''
    },
    evDisplaySettings: {
      footerTickerText: evDisplaySettings.footerTickerText || ''
    }
  }
}

export function saveMockDisplayConfig (nextConfig, updatedBy = 'Admin') {
  ensureDisplayConfig()
  _displayConfig = {
    venueDisplayMode: nextConfig.venueDisplayMode,
    evDisplayMode: nextConfig.evDisplayMode,
    evDisplaySettings: {
      footerTickerText: nextConfig.evDisplaySettings?.footerTickerText || ''
    },
    venueRules: Array.isArray(nextConfig.venueRules)
      ? nextConfig.venueRules.map(item => ({
        ...item,
        venueId: item.venueId ?? null,
        displayName: item.displayName ?? '',
        arrowDirection: item.arrowDirection ?? ''
      }))
      : [],
    mergeDisplaySettings: {
      panelTitleText: nextConfig.mergeDisplaySettings?.panelTitleText || '',
      footerTickerText: nextConfig.mergeDisplaySettings?.footerTickerText || '',
      qrCodeImage: nextConfig.mergeDisplaySettings?.qrCodeImage || ''
    },
    updatedBy,
    updatedAt: new Date().toISOString()
  }
  return getMockDisplayConfig()
}

