export const normalizeFuzzyText = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const createTrigrams = (value: string): string[] => {
  if (!value) {
    return [];
  }

  if (value.length < 3) {
    return [value];
  }

  const padded = `  ${value} `;
  const trigrams: string[] = [];

  for (let index = 0; index <= padded.length - 3; index += 1) {
    trigrams.push(padded.slice(index, index + 3));
  }

  return trigrams;
};

const diceCoefficient = (left: string, right: string): number => {
  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 1;
  }

  const leftTrigrams = createTrigrams(left);
  const rightTrigrams = createTrigrams(right);

  if (leftTrigrams.length === 0 || rightTrigrams.length === 0) {
    return 0;
  }

  const leftCounts = new Map<string, number>();
  for (const trigram of leftTrigrams) {
    leftCounts.set(trigram, (leftCounts.get(trigram) ?? 0) + 1);
  }

  let overlap = 0;
  for (const trigram of rightTrigrams) {
    const count = leftCounts.get(trigram) ?? 0;
    if (count > 0) {
      overlap += 1;
      leftCounts.set(trigram, count - 1);
    }
  }

  return (2 * overlap) / (leftTrigrams.length + rightTrigrams.length);
};

interface ScoreFuzzyMatchInput {
  query: string;
  primary: string;
  secondary?: string;
}

export const scoreFuzzyMatch = ({ query, primary, secondary }: ScoreFuzzyMatchInput): number => {
  const normalizedQuery = normalizeFuzzyText(query);
  const normalizedPrimary = normalizeFuzzyText(primary);
  const normalizedSecondary = secondary ? normalizeFuzzyText(secondary) : '';

  if (!normalizedPrimary || !normalizedQuery) {
    return 0;
  }

  if (normalizedQuery.length <= 2) {
    let score = 0;

    if (normalizedPrimary.startsWith(normalizedQuery)) {
      score += 1;
    } else if (normalizedPrimary.includes(normalizedQuery)) {
      score += 0.65;
    }

    if (normalizedSecondary.startsWith(normalizedQuery)) {
      score += 0.45;
    } else if (normalizedSecondary.includes(normalizedQuery)) {
      score += 0.25;
    }

    if (normalizedPrimary.split(' ').some((token) => token.startsWith(normalizedQuery))) {
      score += 0.2;
    }

    return score;
  }

  let score = 0;
  score += diceCoefficient(normalizedQuery, normalizedPrimary) * 1.35;
  score += diceCoefficient(normalizedQuery, normalizedSecondary) * 0.65;

  if (normalizedPrimary.startsWith(normalizedQuery)) {
    score += 0.32;
  } else if (normalizedPrimary.includes(normalizedQuery)) {
    score += 0.18;
  }

  if (normalizedSecondary.startsWith(normalizedQuery)) {
    score += 0.14;
  }

  if (normalizedPrimary.split(' ').some((token) => token.startsWith(normalizedQuery))) {
    score += 0.12;
  }

  return score;
};

export const fuzzySuggestionThreshold = (query: string): number => {
  const normalizedQuery = normalizeFuzzyText(query);
  return normalizedQuery.length <= 2 ? 0.45 : 0.24;
};
