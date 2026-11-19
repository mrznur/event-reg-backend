import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { trim } from '../../common/trim';

export class CreateGalleryImageDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @Transform(trim)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  url!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  caption?: string;

  @IsOptional()
  @IsString()
  eventId?: string;
}
