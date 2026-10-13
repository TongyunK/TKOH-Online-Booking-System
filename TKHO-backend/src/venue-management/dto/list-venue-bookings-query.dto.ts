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

  /** CSV: upcoming,past,cancelled */
  @IsOptional()
  @IsString()
  statuses?: string;

  /** CSV venue names */
  @IsOptional()
  @IsString()
  venueNames?: string;

  /** CSV reserved-by display labels */
  @IsOptional()
  @IsString()
  reservedBy?: string;

  /** CSV submitter display labels */
  @IsOptional()
  @IsString()
  submitters?: string;

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
