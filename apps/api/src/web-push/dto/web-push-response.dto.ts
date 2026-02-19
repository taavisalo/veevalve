import { ApiProperty } from '@nestjs/swagger';

export class WebPushUpsertResponseDto {
  @ApiProperty({
    description: 'Number of favorite ids that were valid and stored.',
    example: 3,
  })
  favoriteCount!: number;
}
