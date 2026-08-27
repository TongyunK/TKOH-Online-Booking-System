export type DataRetentionPurgeSummary = {
  retentionMonths: number;
  cutoffIso: string;
  venueBookingsDeleted: number;
  evBookingsDeletedByAge: number;
  evBookingsDeletedForUserPlates: number;
  licensePlatesDeleted: number;
  usersDeleted: number;
  startedAtIso: string;
  finishedAtIso: string;
  ok: boolean;
  errorMessage?: string;
};
