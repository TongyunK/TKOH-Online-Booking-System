import { Transform } from 'class-transformer';
import { IsOptional, Matches } from 'class-validator';
import { pickQueryValue } from '../../common/pick-query-value';

export class TeaServiceDisplayQueryDto {
  /** 起始日期 YYYY-MM-DD；兼容 FromDate / date / Date */
  @IsOptional()
  @Transform(({ obj }) =>
    pickQueryValue(obj, 'fromDate', 'FromDate', 'from_date', 'date', 'Date'),
  )
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fromDate?: string;
}
