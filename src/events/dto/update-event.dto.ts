import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { IsIanaTimeZone } from '../../common/is-time-zone';
import { EventCategory } from '../../generated/prisma/enums';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateEventDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsEnum(EventCategory)
  category?: EventCategory;

  @IsOptional()
  @Transform(trim)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  coverImage?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  venue?: string;

  @IsOptional()
  @IsIanaTimeZone()
  timezone?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  capacity?: number;
}
