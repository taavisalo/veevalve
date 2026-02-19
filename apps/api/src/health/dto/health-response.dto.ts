import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({
    description: 'Health status indicator.',
    example: 'ok',
  })
  status!: string;

  @ApiProperty({
    description: 'Current server timestamp.',
    example: '2026-02-19T14:10:00.000Z',
    format: 'date-time',
  })
  timestamp!: string;
}
