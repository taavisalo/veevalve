import { describe, expect, it } from 'vitest';

import { lest97ToWgs84 } from '../src/geo/lest97';

describe('L-EST97 coordinate conversion', () => {
  it('converts Terviseamet coordinates to WGS84 latitude and longitude', () => {
    const inglirand = lest97ToWgs84({ x: 6589950.426, y: 544949.103 });
    expect(inglirand?.latitude).toBeCloseTo(59.444979, 6);
    expect(inglirand?.longitude).toBeCloseTo(24.792305, 6);

    const anneKanal = lest97ToWgs84({ x: 6474140.104, y: 660292.593 });
    expect(anneKanal?.latitude).toBeCloseTo(58.378265, 6);
    expect(anneKanal?.longitude).toBeCloseTo(26.740583, 6);
  });

  it('rejects invalid projected coordinates', () => {
    expect(lest97ToWgs84({ x: Number.NaN, y: 544949.103 })).toBeUndefined();
  });
});
