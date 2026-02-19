import { ApiProperty } from '@nestjs/swagger';

export class AuthProviderResponseDto {
  @ApiProperty({
    description: 'Machine-readable auth provider id.',
    example: 'google',
  })
  id!: string;

  @ApiProperty({
    description: 'Human-readable auth provider name.',
    example: 'Google',
  })
  displayName!: string;
}
