import { IsEmail, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateUserDto {
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

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  account?: string;

  @IsOptional()
  @IsString()
  contact?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsNumber()
  annualQuotaEV?: number;

  @IsOptional()
  @IsNumber()
  annualQuotaVenue?: number;

  @IsOptional()
  @IsNumber()
  usedQuotaEV?: number;

  @IsOptional()
  @IsNumber()
  usedQuotaVenue?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  password?: string;
}
