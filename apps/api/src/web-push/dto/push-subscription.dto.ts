import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class PushSubscriptionKeysDto {
  @ApiProperty({
    description: 'Base64URL encoded P-256 public key.',
    example: 'BJJ4WnW8Pj5k9a1xg0fM8Yf4YfD4xQfUq3o5G2QX9nM',
    maxLength: 4096,
  })
  @IsString()
  @MaxLength(4096)
  p256dh!: string;

  @ApiProperty({
    description: 'Base64URL encoded auth secret.',
    example: '9V6xk9hQ3f7K8mN2',
    maxLength: 4096,
  })
  @IsString()
  @MaxLength(4096)
  auth!: string;
}

class PushSubscriptionDto {
  @ApiProperty({
    description: 'Push service endpoint URL.',
    example: 'https://fcm.googleapis.com/fcm/send/dummy-endpoint-token',
    maxLength: 4096,
    format: 'uri',
  })
  @IsUrl(
    {
      require_protocol: true,
      require_tld: true,
      protocols: ['https'],
    },
    { message: 'subscription.endpoint must be a valid https URL' },
  )
  @MaxLength(4096)
  endpoint!: string;

  @ApiProperty({
    description: 'Push subscription cryptographic keys.',
    type: () => PushSubscriptionKeysDto,
  })
  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys!: PushSubscriptionKeysDto;

  @ApiPropertyOptional({
    description: 'Optional push subscription expiration timestamp in milliseconds.',
    example: null,
    nullable: true,
  })
  @IsOptional()
  @IsNumber(
    {},
    {
      message: 'subscription.expirationTime must be a number when provided',
    },
  )
  expirationTime?: number | null;
}

export class UpsertWebPushSubscriptionDto {
  @ApiProperty({
    description: 'Push subscription payload from the browser Push API.',
    type: () => PushSubscriptionDto,
  })
  @ValidateNested()
  @Type(() => PushSubscriptionDto)
  subscription!: PushSubscriptionDto;

  @ApiProperty({
    type: [String],
    description: 'Favorite place ids attached to this subscription.',
    example: ['cm6abcd123efg456hij7890kl'],
    maxItems: 50,
  })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  favoritePlaceIds: string[] = [];

  @ApiPropertyOptional({
    enum: ['et', 'en'],
    description: 'Preferred notification locale.',
    default: 'et',
    example: 'et',
  })
  @IsIn(['et', 'en'])
  locale: 'et' | 'en' = 'et';
}

export class DeleteWebPushSubscriptionDto {
  @ApiProperty({
    description: 'Subscription endpoint to delete.',
    example: 'https://fcm.googleapis.com/fcm/send/dummy-endpoint-token',
    maxLength: 4096,
    format: 'uri',
  })
  @IsUrl(
    {
      require_protocol: true,
      require_tld: true,
      protocols: ['https'],
    },
    { message: 'endpoint must be a valid https URL' },
  )
  @MaxLength(4096)
  endpoint!: string;
}

export interface NormalizedWebPushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
  expirationTime: bigint | null;
}
