import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveVenueManageBookingDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  topic?: string;

  @IsOptional()
  @IsBoolean()
  displayOnHomepage?: boolean;
}

export class RejectVenueManageBookingDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  topic?: string;

  @IsString()
  reason!: string;

  @IsOptional()
  @IsBoolean()
  displayOnHomepage?: boolean;
}

