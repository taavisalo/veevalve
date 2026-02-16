import { Controller, Get } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  @Get('providers')
  listProviders(): { id: string; displayName: string }[] {
    return [
      { id: 'google', displayName: 'Google' },
      { id: 'apple', displayName: 'Apple' },
      { id: 'microsoft', displayName: 'Microsoft' },
      { id: 'tara', displayName: 'Estonia TARA (eID)' },
    ];
  }
}
