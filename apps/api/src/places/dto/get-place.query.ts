import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';

export class GetPlaceQuery {
  @ApiPropertyOptional({
    enum: ['et', 'en'],
    description: 'Response locale. Defaults to Estonian (`et`).',
    example: 'et',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsIn(['et', 'en'])
  locale?: 'et' | 'en';
}
