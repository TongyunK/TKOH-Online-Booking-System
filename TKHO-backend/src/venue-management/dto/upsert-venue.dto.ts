import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, Min, ValidateIf } from 'class-validator';

export class UpsertVenueDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  nameZh?: string;

  @IsOptional()
  @IsString()
  tab?: string;

  @IsOptional()
  @IsIn(['conference', 'discussion', 'other'])
  type?: 'conference' | 'discussion' | 'other';

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  locationZh?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99999)
  roomCapacity?: number;

  @IsOptional()
  @IsBoolean()
  teaServiceAvailable?: boolean;

  @IsOptional()
  @IsBoolean()
  userDefinedUploadEventTitle?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'dailyBookingStartTime must be HH:mm',
  })
  dailyBookingStartTime?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'dailyBookingEndTime must be HH:mm',
  })
  dailyBookingEndTime?: string | null;

  @IsOptional()
  @IsIn(['single', 'merge'])
  displayType?: 'single' | 'merge';

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';
}

