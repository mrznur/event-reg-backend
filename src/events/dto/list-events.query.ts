import { Transform, Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { EventCategory } from '../../generated/prisma/enums';

export class ListEventsQuery {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(EventCategory)
  category?: EventCategory;

  @IsOptional()
  @IsIn(['true', 'false'])
  upcoming?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
