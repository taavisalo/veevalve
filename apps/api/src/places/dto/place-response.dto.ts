import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PlaceLatestReadingResponseDto {
  @ApiProperty({
    description: 'ISO timestamp for the latest known water-quality sample.',
    example: '2026-02-18T09:30:00.000Z',
    format: 'date-time',
  })
  sampledAt!: string;

  @ApiProperty({
    enum: ['GOOD', 'BAD', 'UNKNOWN'],
    description: 'Normalized quality status.',
    example: 'GOOD',
  })
  status!: 'GOOD' | 'BAD' | 'UNKNOWN';

  @ApiProperty({
    description: 'Localized status reason text.',
    example: 'Vee kvaliteet vastab nõuetele.',
  })
  statusReason!: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Expanded BAD-status detail lines when requested.',
    example: ['Escherichia coli: 1200 CFU/100ml (piirnorm 500).'],
  })
  badDetails?: string[];
}

export class PlaceListResponseDto {
  @ApiProperty({
    description: 'Internal place id.',
    example: 'cm6abcd123efg456hij7890kl',
  })
  id!: string;

  @ApiProperty({
    description: 'External source id from Terviseamet feed.',
    example: '12345',
  })
  externalId!: string;

  @ApiProperty({
    enum: ['BEACH', 'POOL'],
    description: 'Place type.',
    example: 'POOL',
  })
  type!: 'BEACH' | 'POOL';

  @ApiProperty({
    description: 'Localized place name.',
    example: 'SPA Georg Ots veekeskus',
  })
  name!: string;

  @ApiProperty({
    description: 'Municipality.',
    example: 'Kuressaare',
  })
  municipality!: string;

  @ApiPropertyOptional({
    description: 'Localized address when available.',
    example: 'Pargi 16, Kuressaare',
    nullable: true,
  })
  address!: string | null;

  @ApiPropertyOptional({
    description: 'Latitude coordinate when available.',
    example: 58.2482,
    nullable: true,
  })
  latitude!: number | null;

  @ApiPropertyOptional({
    description: 'Longitude coordinate when available.',
    example: 22.5039,
    nullable: true,
  })
  longitude!: number | null;

  @ApiPropertyOptional({
    description: 'Latest known water-quality reading for this place.',
    type: () => PlaceLatestReadingResponseDto,
  })
  latestReading?: PlaceLatestReadingResponseDto;
}

export class PlaceMetricsResponseDto {
  @ApiProperty({ example: 150 })
  totalEntries!: number;

  @ApiProperty({ example: 92 })
  poolEntries!: number;

  @ApiProperty({ example: 58 })
  beachEntries!: number;

  @ApiProperty({ example: 8 })
  badQualityEntries!: number;

  @ApiProperty({ example: 137 })
  goodQualityEntries!: number;

  @ApiProperty({ example: 5 })
  unknownQualityEntries!: number;

  @ApiProperty({ example: 6 })
  badPoolEntries!: number;

  @ApiProperty({ example: 2 })
  badBeachEntries!: number;

  @ApiProperty({ example: 42 })
  updatedWithin24hEntries!: number;

  @ApiProperty({ example: 12 })
  staleOver7dEntries!: number;

  @ApiPropertyOptional({
    description: 'Most recent source change/check timestamp.',
    example: '2026-02-19T10:15:00.000Z',
    format: 'date-time',
    nullable: true,
  })
  latestSourceUpdatedAt!: string | null;
}
