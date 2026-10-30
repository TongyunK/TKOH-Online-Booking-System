import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpsertYearlyQuotaDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  annualQuotaEV?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  annualQuotaVenue?: number;
}
