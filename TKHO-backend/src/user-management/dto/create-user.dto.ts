import { IsEmail, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(1)
  corpId!: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsString()
  @MinLength(1)
  lastName!: string;

  @IsOptional()
  @IsString()
  employeeNo?: string;

  @IsOptional()
  @IsString()
  rank?: string;

  /** Department display name; created in `departments` when not found. */
  @IsOptional()
  @IsString()
  department?: string;

  /** Access role name; must match `access_roles.role_name`. */
  @IsOptional()
  @IsString()
  role?: string;

  @IsString()
  @MinLength(1)
  password!: string;

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

  /** Frontend: `active` | `inactive` | `expired` */
  @IsOptional()
  @IsString()
  status?: string;

  /** Optional; when provided, creates/links license plate after user create */
  @IsOptional()
  @IsString()
  carPlateNo?: string;
}
