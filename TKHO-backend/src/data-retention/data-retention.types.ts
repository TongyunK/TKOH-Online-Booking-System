export type DataRetentionPurgeSummary = {
  retentionMonths: number;
  cutoffIso: string;
  venueBookingsDeleted: number;
  evBookingsDeletedByAge: number;
  startedAtIso: string;
  finishedAtIso: string;
  ok: boolean;
  errorMessage?: string;
};
