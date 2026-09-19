import { TrackerConfig } from './types';
import { t } from './i18n';

export interface YearMonth {
  year: number;
  month: number;
}

/** True when the code block itself carries a year or month (frontmatter is then unnecessary). */
export function hasBlockYearMonth(config: TrackerConfig): boolean {
  return config?.year != null || config?.month != null;
}

/**
 * Whole numbers only: `5.5` and `NaN` are numbers that pass a 1–12 range check yet
 * render a silently empty tracker (the date pattern becomes `2026-5.5-…`, and every
 * comparison against `NaN` is false), so they are rejected as a type error instead.
 */
function isWholeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

/**
 * Resolve which month to render: the code block's own `year`/`month` when given,
 * otherwise the current note's frontmatter.
 *
 * The block must set both fields or neither — a lone `month` would silently pick
 * up a year from elsewhere, which is rarely what the author meant.
 */
export function resolveYearMonth(
  config: TrackerConfig,
  fm: Record<string, unknown> | undefined,
): YearMonth {
  const m = t();
  let year: unknown;
  let month: unknown;

  if (hasBlockYearMonth(config)) {
    year = config.year;
    month = config.month;
    if (year == null || month == null) {
      throw new Error(m.errBlockYearMonthPair);
    }
    if (!isWholeNumber(year) || !isWholeNumber(month)) {
      throw new Error(m.errBlockYearMonthType);
    }
  } else {
    year = fm?.year;
    month = fm?.month;
    if (year == null || month == null) {
      throw new Error(m.errMissingYearMonth);
    }
    if (!isWholeNumber(year) || !isWholeNumber(month)) {
      throw new Error(m.errYearMonthType);
    }
  }

  if (month < 1 || month > 12) {
    throw new Error(m.errInvalidMonth(month));
  }

  return { year, month };
}
