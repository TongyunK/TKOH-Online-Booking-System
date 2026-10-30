import { IsIn, IsOptional, IsString } from 'class-validator';

export class ListVenueBookingsQueryDto {
  @IsOptional()
  @IsIn(['my', 'all'])
  scope?: 'my' | 'all' = 'my';

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  pageSize?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: string;

  /** 次排序字段（主排序相同时生效，常用 dateTime） */
  @IsOptional()
  @IsString()
  secondarySortBy?: string;

  @IsOptional()
  @IsString()
  secondarySortOrder?: string;

  /** CSV: upcoming,past,cancelled */
  @IsOptional()
  @IsString()
  statuses?: string;

  /** CSV venue names */
  @IsOptional()
  @IsString()
  venueNames?: string;

  /** CSV reserved-by display labels (legacy; prefer reservedByUserIds) */
  @IsOptional()
  @IsString()
  reservedBy?: string;

  /** CSV submitter display labels (legacy; prefer submitterUserIds) */
  @IsOptional()
  @IsString()
  submitters?: string;

  /** CSV reserved-by user ids */
  @IsOptional()
  @IsString()
  reservedByUserIds?: string;

  /** CSV submitter user ids */
  @IsOptional()
  @IsString()
  submitterUserIds?: string;

  /** CSV approval statuses */
  @IsOptional()
  @IsString()
  approvalStatuses?: string;

  @IsOptional()
  @IsString()
  includeOptions?: string;

  @IsOptional()
  @IsString()
  all?: string;
}
