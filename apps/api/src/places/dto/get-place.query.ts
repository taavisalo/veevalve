import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';

export class GetPlaceQuery {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsIn(['et', 'en'])
  locale?: 'et' | 'en';
}

