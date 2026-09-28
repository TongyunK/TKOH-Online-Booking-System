import { Transform } from 'class-transformer';
import { IsOptional, Matches } from 'class-validator';
import { pickQueryValue } from '../../common/pick-query-value';

export class VenueMergePublicDisplayQueryDto {
  /** 展示日期 YYYY-MM-DD；兼容 Date */
  @IsOptional()
  @Transform(({ obj }) => pickQueryValue(obj, 'date', 'Date'))
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;
}
