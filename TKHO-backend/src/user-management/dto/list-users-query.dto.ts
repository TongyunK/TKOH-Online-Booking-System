export type ListUsersQuery = {
  page?: number | string;
  pageSize?: number | string;
  q?: string;
  /** active | expired_inactive | all */
  statusScope?: string;
  sortBy?: string;
  sortOrder?: string;
  /** Comma-separated department names */
  departments?: string;
  /** Comma-separated role names */
  roles?: string;
  includeOptions?: boolean | string;
  all?: boolean | string;
};

export type ListPendingUsersQuery = {
  status?: string;
  page?: number | string;
  pageSize?: number | string;
  q?: string;
  sortBy?: string;
  sortOrder?: string;
  departments?: string;
  includeOptions?: boolean | string;
  all?: boolean | string;
};
