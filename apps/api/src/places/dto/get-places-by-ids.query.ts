import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsArray,
  IsIn,
  IsString,
  MaxLength,
} from 'class-validator';

const normalizeIds = (value: unknown): string[] => {
  const rawValues = Array.isArray(value) ? value : [value];
  const parsed = rawValues
    .flatMap((item) => (typeof item === 'string' ? item.split(',') : []))
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  return [...new Set(parsed)];
};

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

export class GetPlacesByIdsQuery {
  @Transform(({ value }) => normalizeIds(value))
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  ids!: string[];

  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsIn(['et', 'en'])
  locale: 'et' | 'en' = 'et';

  @Transform(({ value }) => parseBoolean(value, true))
  @IsBoolean()
  includeBadDetails: boolean = true;
}
