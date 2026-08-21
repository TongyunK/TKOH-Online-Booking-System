import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveVenueManageBookingDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  topic?: string;

  @IsOptional()
  @IsBoolean()
  displayOnHomepage?: boolean;
}

export class RejectVenueManageBookingDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  topic?: string;

  @IsString()
  reason!: string;

  @IsOptional()
  @IsBoolean()
  displayOnHomepage?: boolean;
}

