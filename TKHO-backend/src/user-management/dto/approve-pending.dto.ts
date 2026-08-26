import { IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class ApprovePendingDto {
  @IsString()
  @MinLength(1)
  password!: string;

  @IsOptional()
  @IsString()
  corpId?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  employeeNo?: string;

  @IsOptional()
  @IsString()
  rank?: string;

  @IsOptional()
  @IsString()
  department?: string;

  /** Required when approving; assigned to the created user. */
  @IsString()
  @MinLength(1)
  role!: string;

  @IsOptional()
  @IsString()
  contact?: string;

  @IsOptional()
  @IsNumber()
  annualQuotaEV?: number;

  @IsOptional()
  @IsNumber()
  annualQuotaVenue?: number;
}
