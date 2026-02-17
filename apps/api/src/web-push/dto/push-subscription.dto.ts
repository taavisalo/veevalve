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
  @IsString()
  @MaxLength(4096)
  p256dh!: string;

  @IsString()
  @MaxLength(4096)
  auth!: string;
}

class PushSubscriptionDto {
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

  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys!: PushSubscriptionKeysDto;

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
  @ValidateNested()
  @Type(() => PushSubscriptionDto)
  subscription!: PushSubscriptionDto;

  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  favoritePlaceIds: string[] = [];

  @IsIn(['et', 'en'])
  locale: 'et' | 'en' = 'et';
}

export class DeleteWebPushSubscriptionDto {
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
