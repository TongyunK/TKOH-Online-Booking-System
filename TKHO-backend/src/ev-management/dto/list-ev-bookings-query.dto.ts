import { IsIn, IsOptional, IsString } from 'class-validator';

export class ListEvBookingsQueryDto {
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

  /** 次排序字段（主排序相同时生效，常用 bookingDateTime） */
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

  /** CSV license plate numbers */
  @IsOptional()
  @IsString()
  licensePlates?: string;

  /** CSV EV space names */
  @IsOptional()
  @IsString()
  spaces?: string;

  /** CSV reserved-by display labels (legacy; prefer reservedByUserIds) */
  @IsOptional()
  @IsString()
  reservedBy?: string;

  /** CSV submitter display labels (legacy; prefer submitterUserIds) */
  @IsOptional()
  @IsString()
  submitters?: string;

  /** CSV reserved-by user ids（车牌所属用户） */
  @IsOptional()
  @IsString()
  reservedByUserIds?: string;

  /** CSV submitter user ids */
  @IsOptional()
  @IsString()
  submitterUserIds?: string;

  @IsOptional()
  @IsString()
  includeOptions?: string;

  @IsOptional()
  @IsString()
  all?: string;
}
