import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectBookingDto {
  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  rejectReason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  meetingTitle?: string;

  @IsOptional()
  @IsBoolean()
  displayOnHomepage?: boolean;
}
