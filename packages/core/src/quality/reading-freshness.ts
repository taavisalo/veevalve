const DEFAULT_STALE_READING_MONTHS = 3;

const toValidDate = (value: string): Date | undefined => {
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
};

const subtractUtcMonths = (date: Date, months: number): Date => {
  const firstDayOfTargetMonth = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() - months,
      1,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
  const daysInTargetMonth = new Date(
    Date.UTC(firstDayOfTargetMonth.getUTCFullYear(), firstDayOfTargetMonth.getUTCMonth() + 1, 0),
  ).getUTCDate();

  firstDayOfTargetMonth.setUTCDate(Math.min(date.getUTCDate(), daysInTargetMonth));
  return firstDayOfTargetMonth;
};

export const isWaterQualityReadingStale = (
  sampledAtIso: string,
  referenceTimeIso?: string,
  staleAfterMonths = DEFAULT_STALE_READING_MONTHS,
): boolean => {
  const sampledAt = toValidDate(sampledAtIso);
  if (!sampledAt) {
    return false;
  }

  const referenceTime = toValidDate(referenceTimeIso ?? '') ?? new Date();
  const staleBefore = subtractUtcMonths(referenceTime, staleAfterMonths);
  return sampledAt.getTime() < staleBefore.getTime();
};
