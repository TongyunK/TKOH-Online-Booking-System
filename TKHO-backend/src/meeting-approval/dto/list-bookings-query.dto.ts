export type MeetingApprovalListQuery = {
  page?: number | string;
  pageSize?: number | string;
  /** Keyword search across venue, title, booker, booking id, etc. */
  q?: string;
  dateFrom?: string;
  dateTo?: string;
  /** venueName | date | time | submittedAt | reservedBy | approvedAt | approvedBy | rejectedAt | rejectedBy */
  sortBy?: string;
  sortOrder?: string;
  /** Comma-separated venue names */
  venueNames?: string;
  /** Comma-separated "Name (corpId)" labels */
  reservedBy?: string;
  /** When true, include distinct filter option lists for the current tab scope */
  includeOptions?: boolean | string;
  /** When true, return all matching rows (capped) for Excel export */
  all?: boolean | string;
};
