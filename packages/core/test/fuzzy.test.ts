import { describe, expect, it } from 'vitest';

import {
  fuzzySuggestionThreshold,
  normalizeFuzzyText,
  scoreFuzzyMatch,
} from '../src/search/fuzzy';

describe('fuzzy search helpers', () => {
  it('normalizes accents and spacing', () => {
    expect(normalizeFuzzyText('  Pärnu   rand  ')).toBe('parnu rand');
  });

  it('scores typo queries higher for relevant names', () => {
    const query = 'pirtia';
    const relevant = scoreFuzzyMatch({
      query,
      primary: 'Pirita rand',
      secondary: 'Tallinn',
    });
    const irrelevant = scoreFuzzyMatch({
      query,
      primary: 'Kalev Spa bassein',
      secondary: 'Tallinn',
    });

    expect(relevant).toBeGreaterThan(irrelevant);
    expect(relevant).toBeGreaterThan(fuzzySuggestionThreshold(query));
  });
});
