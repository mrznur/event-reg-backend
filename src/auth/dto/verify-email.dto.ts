import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';
import { trimLower } from '../../common/trim';

export class VerifyEmailDto {
  @Transform(trimLower)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @Transform(trimLower)
  @IsString()
  @Length(6, 6, { message: 'Code must be 6 digits' })
  code!: string;
}
