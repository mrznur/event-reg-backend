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
import { Transform } from 'class-transformer';
import { IsIanaTimeZone } from '../../common/is-time-zone';
import { trim } from '../../common/trim';
import { EventCategory } from '../../generated/prisma/enums';

export class CreateEventDto {
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description!: string;

  @IsEnum(EventCategory)
  category!: EventCategory;

  @Transform(trim)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  coverImage!: string;
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  venue!: string;

  @IsOptional()
  @IsIanaTimeZone()
  timezone?: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsInt()
  @Min(1)
  @Max(100000)
  capacity!: number;
}
