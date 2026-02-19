import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

// Prisma cuid/cuid2 ids are lowercase URL-safe tokens.
const PLACE_ID_PATTERN = /^[a-z0-9]+$/;

export class GetPlaceParams {
  @ApiProperty({
    description: 'Internal place id (Prisma cuid/cuid2 token).',
    example: 'cm6abcd123efg456hij7890kl',
    minLength: 10,
    maxLength: 64,
    pattern: '^[a-z0-9]+$',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(10)
  @MaxLength(64)
  @Matches(PLACE_ID_PATTERN)
  id!: string;
}
