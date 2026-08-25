import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @MaxLength(100)
  @IsOptional()
  firstName?: string;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  lastName?: string;

  /** @deprecated Prefer firstName/lastName. Written to lastName when lastName is omitted. */
  @IsString()
  @MaxLength(100)
  @IsOptional()
  fullName?: string;

  @IsString()
  @MaxLength(50)
  @IsOptional()
  department?: string;

  @IsString()
  @MaxLength(30)
  phone: string;

  /** Maps to User.employeeNo (not account). */
  @IsString()
  @MaxLength(50)
  @IsOptional()
  employeeNo?: string;

  @IsString()
  @MaxLength(50)
  @IsOptional()
  rank?: string;
}
