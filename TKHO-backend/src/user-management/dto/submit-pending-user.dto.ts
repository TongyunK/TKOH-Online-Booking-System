import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class SubmitPendingUserDto {
  @IsString()
  @MinLength(1)
  corpId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  department!: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  contactNo!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
