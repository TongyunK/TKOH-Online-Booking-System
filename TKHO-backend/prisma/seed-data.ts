/** Seeds the `user` table (single account table; legacy `employees` removed). */
export type SeedUser = {
  id: number;
  corpId: string;
  firstName: string;
  lastName: string;
  employeeNo?: string | null;
  rank?: string | null;
  departmentId: number;
  accessRoleId: number;
  email?: string;
  contact?: string;
  annualQuotaEV?: number;
  usedQuotaEV?: number;
  annualQuotaVenue?: number;
  usedQuotaVenue?: number;
};

export type SeedVenue = {
  id: number;
  name: string;
  nameZh?: string;
  tab?: string;
  type?: string;
  roomCapacity?: number;
  capacity?: number;
  color?: string;
  location?: string;
  locationZh?: string;
  displayType?: string;
  userDefinedUploadEventTitle?: boolean;
  image?: string | null;
  status?: string;
};

export type SeedEvSlot = {
  id: number;
  evSpace: string;
  location?: string;
  status?: string;
};

export type SeedEvPeriod = {
  id: number;
  period: string;
  startTime: string;
  endTime: string;
  status?: string;
};

export type SeedLicensePlate = {
  id: number;
  userId?: number | null;
  plateNumber: string;
  isDefault?: boolean;
  status?: string;
};

export type SeedPrompt = {
  id: number;
  promptKey: string;
  name: string;
  content: string;
  category: string;
  canAdd?: boolean;
  templateType?: string | null;
};

export type SeedDepartment = {
  id: number;
  departmentName: string;
  description?: string;
  employeeCount?: number;
};

export type SeedAccessRole = {
  id: number;
  roleName: string;
  description?: string;
  annualVenueQuota?: number;
  annualEvQuota?: number;
  employeeCount?: number;
};

const departmentCodes = [
  'ADM',
  'CNS',
  'D&T',
  'EMSD',
  'ENT',
  'FM',
  'FM&PHC',
  'GO',
  'HCE',
  'HIRD',
  'HRC',
  'HRD',
  'ICT',
  'ITD',
  'MED',
  'NSD',
  'OPH',
  'OSH',
  'P&CR',
  'Path',
  'Pharm',
  'PMMD',
  'Q&S',
  'SOPD',
  'SS',
];
const accessRoles = ['Admin', 'User', 'User_EV', 'User_Venue'];

function accessRoleIdFromAppRole(role: string): number {
  switch (role) {
    case 'Admin':
      return 1;
    case 'User':
      return 2;
    case 'User_EV':
      return 3;
    case 'User_Venue':
      return 4;
    default:
      return 2;
  }
}

const departmentList: SeedDepartment[] = [
  { id: 1, departmentName: 'ADM', description: 'Administrative Services Division', employeeCount: 0 },
  { id: 2, departmentName: 'CNS', description: 'Community Nursing Services', employeeCount: 0 },
  { id: 3, departmentName: 'D&T', description: 'Domestic & Transportation', employeeCount: 0 },
  { id: 4, departmentName: 'EMSD', description: 'Electrical & Mechanical Services Department', employeeCount: 0 },
  { id: 5, departmentName: 'ENT', description: 'Department of Ear, Nose & Throat', employeeCount: 0 },
  { id: 6, departmentName: 'FM', description: 'Facility Management', employeeCount: 0 },
  { id: 7, departmentName: 'FM&PHC', description: 'Department of Family Medicine & Primary Health Care', employeeCount: 0 },
  { id: 8, departmentName: 'GO', description: 'General Office', employeeCount: 0 },
  { id: 9, departmentName: 'HCE', description: "Hospital Chief Executive's Office", employeeCount: 0 },
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
  { id: 25, departmentName: 'SS', description: 'Supporting Services', employeeCount: 0 },
];

const accessRoleList: SeedAccessRole[] = [
  { id: 0, roleName: 'SuperAdmin', description: 'System hidden super administrator role for developers only', annualVenueQuota: -1, annualEvQuota: -1, employeeCount: 0 },
  { id: 1, roleName: 'Admin', description: 'Admin user who has FULL control withour restructions over the system', annualVenueQuota: -1, annualEvQuota: -1, employeeCount: 15 },
  { id: 2, roleName: 'User', description: 'Regular user who can access EV and venue bookings', annualVenueQuota: 100, annualEvQuota: 60, employeeCount: 120 },
  { id: 3, roleName: 'User_EV', description: 'Regular user who can access EV booking ONLY', annualVenueQuota: 0, annualEvQuota: 60, employeeCount: 35 },
  { id: 4, roleName: 'User_Venue', description: 'Regular user who can access venue booking ONLY', annualVenueQuota: 100, annualEvQuota: 0, employeeCount: 8 },
];

const users: SeedUser[] = [
  {
    id: 0,
    corpId: 'SuperAdmin',
    firstName: 'System',
    lastName: 'SuperAdmin',
    employeeNo: null,
    rank: null,
    departmentId: 1,
    accessRoleId: 0,
    email: 'superadmin@tkho.local',
    contact: '910000000',
    annualQuotaEV: -1,
    usedQuotaEV: 0,
    annualQuotaVenue: -1,
    usedQuotaVenue: 0,
  },
  ...Array.from({ length: 25 }, (_, index) => {
    const i = index + 1;
    const isAdmin = i === 1 || i === 16;
    const selectedRole = isAdmin ? 'Admin' : accessRoles[(index % (accessRoles.length - 1)) + 1];
    const isVenueOnly = selectedRole === 'User_Venue';
    const isEvOnly = selectedRole === 'User_EV';
    return {
      id: i,
      corpId: i === 1 ? 'Admin-test' : `E${String(i).padStart(3, '0')}`,
      firstName: 'Employee',
      lastName: `${i}`,
      employeeNo: i === 1 ? 'Admin-test' : `E${String(i).padStart(3, '0')}`,
      rank: isAdmin ? 'Admin' : null,
      departmentId: index % departmentCodes.length + 1,
      accessRoleId: accessRoleIdFromAppRole(selectedRole),
      email: `employee${i}@tkho.local`,
      contact: `91${String(i).padStart(6, '0')}`,
      annualQuotaEV: isAdmin ? -1 : isVenueOnly ? 0 : 60,
      usedQuotaEV: (index * 3) % 20,
      annualQuotaVenue: isAdmin ? -1 : isEvOnly ? 0 : 100,
      usedQuotaVenue: (index * 2) % 10,
    };
  }),
];

const venues: SeedVenue[] = [
  { id: 1, name: 'Conference Room 1', nameZh: '會議室1', tab: 'conference_discussion', type: 'conference', roomCapacity: 8, color: '#3b82f6', location: '8/F Ambulatory Care Block', locationZh: '日間醫療大樓8樓', displayType: 'merge', userDefinedUploadEventTitle: true, image: null, status: 'active' },
  { id: 2, name: 'Conference Room 2', nameZh: '會議室2', tab: 'conference_discussion', type: 'conference', roomCapacity: 20, color: '#10b981', location: '8/F Ambulatory Care Block', locationZh: '日間醫療大樓8樓', displayType: 'merge', userDefinedUploadEventTitle: true, image: null, status: 'active' },
  { id: 3, name: 'Conference Room 3', nameZh: '會議室3', tab: 'conference_discussion', type: 'conference', roomCapacity: 40, color: '#06b6d4', location: '8/F Ambulatory Care Block', locationZh: '日間醫療大樓8樓', displayType: 'merge', userDefinedUploadEventTitle: true, image: null, status: 'active' },
  { id: 4, name: 'Discussion Room', nameZh: '討論室', tab: 'conference_discussion', type: 'discussion', roomCapacity: 12, color: '#f59e0b', location: '3F', locationZh: '3樓', displayType: 'single', userDefinedUploadEventTitle: true, image: null, status: 'active' },
  { id: 5, name: 'Function Room', nameZh: '多功能室', tab: 'other_venues', type: 'other', roomCapacity: 60, color: '#ec4899', location: 'Ground Floor', locationZh: '地下', displayType: 'single', userDefinedUploadEventTitle: true, image: null, status: 'active' },
  { id: 6, name: 'Lecture Theatre', nameZh: '演講廳', tab: 'other_venues', type: 'other', roomCapacity: 70, color: '#6366f1', location: '8/F Ambulatory Care Block', locationZh: '日間醫療大樓8樓', displayType: 'single', userDefinedUploadEventTitle: true, image: null, status: 'active' },
  { id: 7, name: 'Auditorium', nameZh: '禮堂', tab: 'other_venues', type: 'other', roomCapacity: 99, color: '#8b5cf6', location: '1F', locationZh: '1樓', displayType: 'single', userDefinedUploadEventTitle: true, image: null, status: 'active' },
];

const evSlots: SeedEvSlot[] = [
  { id: 1, evSpace: 'EV-01', location: 'B1', status: 'active' },
  { id: 2, evSpace: 'EV-02', location: 'B1', status: 'active' },
  { id: 3, evSpace: 'EV-03', location: 'B1', status: 'active' },
];

const evPeriods: SeedEvPeriod[] = [
  { id: 1, period: 'AM', startTime: '08:30', endTime: '13:00', status: 'active' },
  { id: 2, period: 'PM', startTime: '13:45', endTime: '18:15', status: 'active' },
  { id: 3, period: 'Night', startTime: '19:00', endTime: '23:30', status: 'active' },
];

const licensePlates: SeedLicensePlate[] = Array.from({ length: 25 }, (_, index) => {
  const i = index + 1;
  return {
    id: i,
    userId: i,
    plateNumber: `SEED${String(i).padStart(3, '0')}A`,
    isDefault: true,
    status: 'active',
  };
});

const prompts: SeedPrompt[] = [
  {
    id: 1,
    promptKey: 'ev_booking_points_to_note',
    name: 'EV Booking Points to Note',
    content: `<p><strong>Points to Note:</strong></p><ol><li>TKOH Car Park Reservation System allows access by nominated staff only.</li><li>Visitors coming to TKOH to attend meeting or to deliver presentation at lecture/seminar/workshop, or to service or technical support should make booking through the nominated staff.</li><li>Booking is not available for visitors coming to attend training, course, seminar or workshop.</li><li>Booking for contractors or suppliers for whatever purpose is not accepted.</li><li>Booking should be made at least 5 working days before the date of parking.</li><li>Confirmation of booking will be announced on the system 5 days before the date of parking.</li><li>Amendment for car registration number or booking details must be notified in advance.</li><li>Reserved parking-space will be allocated to other users if the registered car does not show up one hour after.</li><li>Owing to the limited number of parking-spaces in the Reserved Carpark, acceptance of car park reservation of a parking-space.</li></ol>`,
    category: 'system_fixed',
    canAdd: false,
    templateType: null,
  },
  {
    id: 2,
    promptKey: 'venue_booking_points_to_note',
    name: 'Venue Booking Points to Note',
    content: `<p><strong>Points to Note:</strong></p><ol><li>For reservation of other venues (e.g. Courtyard or Glasshouse), please contact General Office at <strong>2208 1951</strong> directly.</li><li>General Office reserves the right to cancel any booking or reassign another venue under necessary circumstances.</li><li>Should user require the following service for the meeting, please directly contact the respective department in advance for arrangement.</li></ol><table style="width: auto"><tbody><tr><th colspan="1" rowspan="1" width="388.48">Service/Equipment</th><th colspan="1" rowspan="1" width="416.65">Subject Department</th></tr><tr><td colspan="1" rowspan="1" width="auto">Zoom/Video Conferencing</td><td colspan="1" rowspan="1" width="auto">Information Technology Dept (Tel: 2208 1830)</td></tr><tr><td colspan="1" rowspan="1" width="auto">Venue Setting / Furniture on-loan</td><td colspan="1" rowspan="1" width="auto">Facility Management Dept (Tel: 2208 1845)</td></tr><tr><td colspan="1" rowspan="1" width="auto">Equipment on-loan</td><td colspan="1" rowspan="1" width="auto">General Office (Tel: 2208 1951)</td></tr><tr><td colspan="1" rowspan="1" width="auto">Tea Service for Conference Rooms (ad-hoc)</td><td colspan="1" rowspan="1" width="auto">General Office (Tel: 2208 1951)</td></tr><tr><td colspan="1" rowspan="1" width="auto">Tea Service for Other Venue and Rooms</td><td colspan="1" rowspan="1" width="auto">Via ADS</td></tr></tbody></table><p><br></p>`,
    category: 'system_fixed',
    canAdd: false,
    templateType: null,
  },
  {
    id: 3,
    promptKey: 'venue_add_booking_setup',
    name: 'Venue Setup',
    content: 'Contact FM (Ext. 1845)',
    category: 'system_fixed',
    canAdd: false,
    templateType: null,
  },
  {
    id: 4,
    promptKey: 'venue_add_booking_equipment',
    name: 'Equipment',
    content: 'Contact ITD (Ext. 1830)',
    category: 'system_fixed',
    canAdd: false,
    templateType: null,
  },
  {
    id: 5,
    promptKey: 'venue_add_booking_tools_materials',
    name: 'Tools and Materials',
    content: 'Contact GO (Ext. 1896)',
    category: 'system_fixed',
    canAdd: false,
    templateType: null,
  },
  {
    id: 6,
    promptKey: 'venue_add_booking_others_special_requests',
    name: 'Others / Special Requests',
    content: 'Contact GO (Ext. 1896)',
    category: 'system_fixed',
    canAdd: false,
    templateType: null,
  },
  {
    id: 7,
    promptKey: 'venue_add_booking_tea_service',
    name: 'Tea Service Required',
    content: 'Reminder prompt:\nOther venues: ADS, Ad hoc bookings: GO',
    category: 'system_fixed',
    canAdd: false,
    templateType: null,
  },
  {
    id: 8,
    promptKey: 'ev_alert_message',
    name: 'EV Alert Message',
    content: `<p style="text-align: center"><span style="color: rgb(225, 60, 57)"><strong>[ For Attention, please ]</strong></span></p><p style="text-align: center"><span style="color: rgb(225, 60, 57)"><strong>Updates on Booking Rules of EV Charging Facilities</strong></span></p><p><u><strong>Effective from 01 JAN 2025</strong></u></p><p>a. Booking quota: Change from 2 sessions/week to <span style="color: rgb(225, 60, 57)">1 session/week</span></p><p>b. Period of AM session: Change from 09:00hr-13:15hr to<span style="color: rgb(225, 60, 57)"> 08:30hr-13:00hr</span></p><p>c. Period of PM session: Change from 14:00hr-18:15hr to <span style="color: rgb(225, 60, 57)">13:45hr-18:15hr</span></p><p><u><strong>Effective from 13 JAN 2025</strong></u></p><p>d. New booking timeslots releasing time: Change from 00:00hr everyday to <span style="color: rgb(225, 60, 57)">13:00hr everyday</span></p>`,
    category: 'system_fixed',
    canAdd: false,
    templateType: null,
  },
  {
    id: 9,
    promptKey: 'venue_alert_message',
    name: 'Venue Alert Message',
    content: `<p class="venue-notice-line">Lecture Theatre is temporarily closed.</p><p class="venue-notice-line zh">演講廳暫停使用</p>`,
    category: 'system_fixed',
    canAdd: false,
    templateType: null,
  },
  {
    id: 10,
    promptKey: 'user_application_reject_template',
    name: 'User Application Reject Template',
    content: 'Your user application is rejected. Reason: {reason}',
    category: 'reject_template',
    canAdd: true,
    templateType: 'user_application',
  },
  {
    id: 11,
    promptKey: 'meeting_approval_reject_template',
    name: 'Meeting Title Non-compliant',
    content: `Your meeting booking request is rejected because the meeting title is not compliant. Please provide a clear and business-related title.`,
    category: 'reject_template',
    canAdd: true,
    templateType: 'meeting_approval',
  },
  {
    id: 12,
    promptKey: 'meeting_approval_reject_template',
    name: 'Insufficient Meeting Details',
    content: `Your meeting booking request is rejected due to insufficient meeting details. Please complete the purpose and required information before resubmission.`,
    category: 'reject_template',
    canAdd: true,
    templateType: 'meeting_approval',
  },
  {
    id: 13,
    promptKey: 'meeting_approval_reject_template',
    name: 'Duplicate Time Slot Booking',
    content: `Your meeting booking request is rejected because the selected date/time conflicts with an existing booking under your account.`,
    category: 'reject_template',
    canAdd: true,
    templateType: 'meeting_approval',
  },
  {
    id: 14,
    promptKey: 'user_application_reject_template',
    name: 'Invalid Contact Phone Number',
    content: `Your user application is rejected because the contact telephone number is invalid. Please provide a valid and reachable phone number.`,
    category: 'reject_template',
    canAdd: true,
    templateType: 'user_application',
  },
  {
    id: 15,
    promptKey: 'user_application_reject_template',
    name: 'Email Format Invalid',
    content: `Your user application is rejected due to invalid email format. Please provide a valid corporate email address.`,
    category: 'reject_template',
    canAdd: true,
    templateType: 'user_application',
  },
  {
    id: 16,
    promptKey: 'user_application_reject_template',
    name: 'Department / Unit Information Missing',
    content: `Your user application is rejected because department information is missing or incorrect. Please update and submit again.`,
    category: 'reject_template',
    canAdd: true,
    templateType: 'user_application',
  },
  {
    id: 17,
    promptKey: 'user_application_reject_template',
    name: 'User Application Reject Template',
    content: 'Your user application is rejected. Reason: {222222222222222}',
    category: 'reject_template',
    canAdd: true,
    templateType: 'user_application',
  },
  {
    id: 18,
    promptKey: 'user_application_reject_template',
    name: 'User Application Reject Template',
    content: 'Your user application is rejected. Reason: {33333333333333333}',
    category: 'reject_template',
    canAdd: true,
    templateType: 'user_application',
  },
];

export const seedData = {
  departmentList,
  accessRoleList,
  users,
  venues,
  evSlots,
  evPeriods,
  licensePlates,
  prompts,
};
