import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { DATA_BACKUP_EMAIL_INTERVALS } from '../system-setting.keys';

export class UpdateSystemSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  userInactiveAfterMonths?: number;

  @IsOptional()
  @IsString()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  hkPublicHolidaysUrl?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'evDateUpdateTime must be HH:mm in 24-hour format',
  })
  evDateUpdateTime?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  evWeeklyBookingLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  venueBookingMinGapMinutes?: number;

  @IsOptional()
  @ValidateIf((_, value) => value != null && String(value).trim() !== '')
  @IsEmail()
  dataBackupReceivingEmail?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  dataBackupTimeSpan?: number;

  @IsOptional()
  @IsIn([...DATA_BACKUP_EMAIL_INTERVALS])
  dataBackupEmailInterval?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'dataBackupEmailSendTime must be HH:mm in 24-hour format',
  })
  dataBackupEmailSendTime?: string;
}
