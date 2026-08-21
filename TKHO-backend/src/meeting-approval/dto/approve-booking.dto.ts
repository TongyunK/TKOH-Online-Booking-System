import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveBookingDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  meetingTitle?: string;

  @IsOptional()
  @IsBoolean()
  displayOnHomepage?: boolean;
}
