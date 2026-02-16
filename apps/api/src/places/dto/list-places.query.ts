import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListPlacesQuery {
  @IsOptional()
  @IsIn(['BEACH', 'POOL'])
  type?: 'BEACH' | 'POOL';

  @IsOptional()
  @IsIn(['GOOD', 'BAD', 'UNKNOWN'])
  status?: 'GOOD' | 'BAD' | 'UNKNOWN';

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['LATEST', 'NAME'])
  sort?: 'LATEST' | 'NAME';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsIn(['et', 'en'])
  locale?: 'et' | 'en';
}
