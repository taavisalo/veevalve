import { ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiPropertyOptional({
    enum: ['BEACH', 'POOL'],
    description: 'Filter by place type.',
    example: 'POOL',
  })
  @IsOptional()
  @IsIn(['BEACH', 'POOL'])
  type?: 'BEACH' | 'POOL';

  @ApiPropertyOptional({
    enum: ['GOOD', 'BAD', 'UNKNOWN'],
    description: 'Filter by latest normalized water quality status.',
    example: 'BAD',
  })
  @IsOptional()
  @IsIn(['GOOD', 'BAD', 'UNKNOWN'])
  status?: 'GOOD' | 'BAD' | 'UNKNOWN';

  @ApiPropertyOptional({
    description:
      'Free-text search across place name, municipality, address and sampling point fields.',
    example: 'gospa',
    maxLength: 120,
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({
    enum: ['LATEST', 'NAME'],
    description: 'Sort order. Defaults to latest sample time when omitted.',
    example: 'LATEST',
  })
  @IsOptional()
  @IsIn(['LATEST', 'NAME'])
  sort?: 'LATEST' | 'NAME';

  @ApiPropertyOptional({
    description:
      'Result page size. Defaults to 10 for non-search, 20 when `search` is provided.',
    minimum: 1,
    maximum: 100,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Result offset for pagination.',
    minimum: 0,
    maximum: 10000,
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  offset?: number;

  @ApiPropertyOptional({
    enum: ['et', 'en'],
    description: 'Response locale. Defaults to Estonian (`et`).',
    example: 'et',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsIn(['et', 'en'])
  locale?: 'et' | 'en';

  @ApiPropertyOptional({
    description: 'Include expanded BAD-status detail texts in `latestReading.badDetails`.',
    default: true,
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => parseBoolean(value, true))
  @IsBoolean()
  includeBadDetails: boolean = true;
}
