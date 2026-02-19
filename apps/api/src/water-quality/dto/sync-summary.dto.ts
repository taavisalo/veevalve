import { ApiProperty } from '@nestjs/swagger';

export class SyncSummaryDto {
  @ApiProperty({ description: 'Number of feeds checked in this run.', example: 8 })
  feedsChecked!: number;

  @ApiProperty({ description: 'Number of feeds that changed.', example: 3 })
  feedsChanged!: number;

  @ApiProperty({ description: 'Number of feeds unchanged (304).', example: 4 })
  feedsUnchanged!: number;

  @ApiProperty({ description: 'Number of feeds not found (404).', example: 1 })
  feedsNotFound!: number;

  @ApiProperty({ description: 'Feeds skipped due to interval gating.', example: 0 })
  feedsSkippedByInterval!: number;

  @ApiProperty({ description: 'Metadata rows processed (places/facilities).', example: 180 })
  metadataRowsProcessed!: number;

  @ApiProperty({ description: 'Sample rows parsed from feeds.', example: 4200 })
  sampleRowsProcessed!: number;

  @ApiProperty({ description: 'Sample rows newly inserted.', example: 120 })
  sampleRowsInserted!: number;

  @ApiProperty({ description: 'Place status changes detected and saved.', example: 7 })
  statusChanges!: number;
}
