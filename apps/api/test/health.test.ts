import { describe, expect, it } from 'vitest';

import { HealthController } from '../src/health/health.controller';

describe('HealthController', () => {
  it('returns ok status', () => {
    const result = new HealthController().getHealth();

    expect(result.status).toBe('ok');
    expect(result.timestamp).toBeTypeOf('string');
  });
});
