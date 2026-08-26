import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateVenueCalendarBookingDto {
  @IsString()
  roomName!: string;

  @IsString()
  date!: string;

  @IsString()
  startTime!: string;

  @IsString()
  endTime!: string;

  @IsString()
  @MaxLength(500)
  topic!: string;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999)
  attendeeCount?: number;

  @IsOptional()
  @IsBoolean()
  teaServiceRequired?: boolean;

  /** 是否允许会议标题�?display 大屏公开显示 */
  @IsOptional()
  @IsBoolean()
  displayOnHomepage?: boolean;

  @IsOptional()
  @IsString()
  teaServiceOption?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  teaServiceRatioFrom?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  teaServiceRatioTo?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  teaServiceTeaPots?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  teaServiceWaterPots?: number;

  /** @deprecated legacy */
  @IsOptional()
  @IsString()
  teaOrWater?: string;

  /** @deprecated legacy */
  @IsOptional()
  @IsString()
  serviceType?: string;

  @IsOptional()
  @IsString()
  teaServiceSpecialRequest?: string;

  @IsOptional()
  @IsString()
  roomType?: string;

  /** 管理员代订时指定预订人用�?ID；默认本�?*/
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'reservedByUserId must be a numeric id' })
  reservedByUserId?: string;
}
