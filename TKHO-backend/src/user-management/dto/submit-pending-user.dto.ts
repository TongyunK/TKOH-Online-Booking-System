import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class SubmitPendingUserDto {
  @IsString()
  @MinLength(1)
  @Matches(/^[A-Z0-9]+$/, {
    message: 'CORP User ID must contain capital letters and numbers only',
  })
  corpId!: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsString()
  @MinLength(1)
  lastName!: string;

  @IsString()
  @Matches(/^\d{6}$/, {
    message: 'Employee No. must be exactly 6 digits',
  })
  employeeNo!: string;

  @IsOptional()
  @IsString()
  rank?: string;

  @IsString()
  @MinLength(1)
  department!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  @Matches(/^\d{8}$/, {
    message: 'Contact No. must be exactly 8 digits',
  })
  contactNo!: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  carPlateNo?: string;
}
