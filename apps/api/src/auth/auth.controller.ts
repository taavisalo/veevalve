import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AuthProviderResponseDto } from './dto/auth-provider-response.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  @Get('providers')
  @ApiOperation({
    summary: 'List auth providers',
    description: 'Returns enabled sign-in providers for client login UI.',
  })
  @ApiOkResponse({
    type: AuthProviderResponseDto,
    isArray: true,
    description: 'Available auth providers.',
  })
  listProviders(): { id: string; displayName: string }[] {
    return [
      { id: 'google', displayName: 'Google' },
      { id: 'apple', displayName: 'Apple' },
      { id: 'microsoft', displayName: 'Microsoft' },
      { id: 'tara', displayName: 'Estonia TARA (eID)' },
    ];
  }
}
