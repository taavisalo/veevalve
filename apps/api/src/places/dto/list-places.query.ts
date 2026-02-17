import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const parseBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }

  return fallback;
};

export class ListPlacesQuery {
  @IsOptional()
  @IsIn(['BEACH', 'POOL'])
  type?: 'BEACH' | 'POOL';

  @IsOptional()
  @IsIn(['GOOD', 'BAD', 'UNKNOWN'])
  status?: 'GOOD' | 'BAD' | 'UNKNOWN';

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsIn(['LATEST', 'NAME'])
  sort?: 'LATEST' | 'NAME';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  offset?: number;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsIn(['et', 'en'])
  locale?: 'et' | 'en';

  @IsOptional()
  @Transform(({ value }) => parseBoolean(value, true))
  @IsBoolean()
  includeBadDetails: boolean = true;
}
