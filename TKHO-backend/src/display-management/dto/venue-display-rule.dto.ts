import { IsIn, IsOptional, IsString } from 'class-validator';

const DISPLAY_TYPES = ['single', 'merge'] as const;
const ARROW_DIRECTIONS = [
  'up',
  'up-right',
  'right',
  'down-right',
  'down',
  'down-left',
  'left',
  'up-left',
  '',
] as const;

export class VenueDisplayRuleDto {
  @IsOptional()
  venueId?: string | number | null;

  @IsOptional()
  @IsString()
  venueName?: string;

  @IsIn(DISPLAY_TYPES)
  displayType!: (typeof DISPLAY_TYPES)[number];

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsIn(ARROW_DIRECTIONS)
  arrowDirection?: string;
}
