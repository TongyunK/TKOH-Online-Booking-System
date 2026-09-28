import { Transform } from 'class-transformer';
import { IsOptional, Matches } from 'class-validator';
import { pickQueryValue } from '../../common/pick-query-value';

export class VenuePublicDisplayQueryDto {
  /** 场地 ID（venues.id）；兼容 venueID / venue_id */
  @Transform(({ obj }) => pickQueryValue(obj, 'venueId', 'venueID', 'venue_id'))
  @Matches(/^\d+$/)
  venueId!: string;

  /** 展示日期 YYYY-MM-DD；兼容 Date */
  @IsOptional()
  @Transform(({ obj }) => pickQueryValue(obj, 'date', 'Date'))
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;
}
