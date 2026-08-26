import { IsIn, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(1)
  corpId!: string;

  @IsString()
  password!: string;

  @IsString()
  @IsIn(['parking', 'room', 'admin'])
  system!: 'parking' | 'room' | 'admin';
}
