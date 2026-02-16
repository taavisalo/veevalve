import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

// Prisma cuid/cuid2 ids are lowercase URL-safe tokens.
const PLACE_ID_PATTERN = /^[a-z0-9]+$/;

export class GetPlaceParams {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(10)
  @MaxLength(64)
  @Matches(PLACE_ID_PATTERN)
  id!: string;
}
