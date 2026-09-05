import { describe, it, expect } from 'vitest';
import { hasBlockYearMonth, resolveYearMonth } from '../src/month';
import type { TrackerConfig } from '../src/types';

const base = { type: 'boolean', color: 'blue' } as const;

/** Build a config with optional year/month overrides, bypassing the numeric field types. */
function config(overrides: Record<string, unknown> = {}): TrackerConfig {
  return { ...base, ...overrides } as unknown as TrackerConfig;
}

describe('hasBlockYearMonth', () => {
  it('is false when the block sets neither field', () => {
    expect(hasBlockYearMonth(config())).toBe(false);
  });

  it('is true when the block sets either field', () => {
    expect(hasBlockYearMonth(config({ month: 5 }))).toBe(true);
    expect(hasBlockYearMonth(config({ year: 2026 }))).toBe(true);
  });
});

describe('resolveYearMonth', () => {
  describe('block year/month', () => {
    it('takes precedence over frontmatter', () => {
      expect(resolveYearMonth(config({ year: 2026, month: 5 }), { year: 2025, month: 12 })).toEqual({
        year: 2026,
        month: 5,
      });
    });

    it('works without any frontmatter', () => {
      expect(resolveYearMonth(config({ year: 2026, month: 5 }), undefined)).toEqual({
        year: 2026,
        month: 5,
      });
    });

    it('rejects one field without the other', () => {
      expect(() => resolveYearMonth(config({ month: 5 }), { year: 2025, month: 12 })).toThrow(
        /code block/,
      );
      expect(() => resolveYearMonth(config({ year: 2026 }), { year: 2025, month: 12 })).toThrow(
        /code block/,
      );
    });

    it('rejects non-numeric values', () => {
      expect(() => resolveYearMonth(config({ year: '2026', month: 5 }), undefined)).toThrow(
        /numbers/,
      );
      expect(() => resolveYearMonth(config({ year: 2026, month: 'May' }), undefined)).toThrow(
        /numbers/,
      );
    });

    it('rejects an out-of-range month', () => {
      expect(() => resolveYearMonth(config({ year: 2026, month: 0 }), undefined)).toThrow(
        /Invalid month/,
      );
      expect(() => resolveYearMonth(config({ year: 2026, month: 13 }), undefined)).toThrow(
        /Invalid month/,
      );
    });

    // A fractional month passes a 1–12 range check but builds a `2026-5.5-` date pattern
    // that matches nothing, so it must fail as a type error instead.
    it('rejects fractional values', () => {
      expect(() => resolveYearMonth(config({ year: 2026, month: 5.5 }), undefined)).toThrow(
        /whole numbers/,
      );
      expect(() => resolveYearMonth(config({ year: 2026.5, month: 5 }), undefined)).toThrow(
        /whole numbers/,
      );
    });

    // NaN slips through `< 1` and `> 12` alike, leaving daysInMonth NaN and no cells at all.
    it('rejects NaN', () => {
      expect(() => resolveYearMonth(config({ year: 2026, month: NaN }), undefined)).toThrow(
        /whole numbers/,
      );
      expect(() => resolveYearMonth(config({ year: NaN, month: 5 }), undefined)).toThrow(
        /whole numbers/,
      );
    });
  });

  describe('frontmatter fallback', () => {
    it('uses frontmatter when the block sets neither field', () => {
      expect(resolveYearMonth(config(), { year: 2025, month: 12 })).toEqual({
        year: 2025,
        month: 12,
      });
    });

    it('throws when frontmatter is missing or incomplete', () => {
      expect(() => resolveYearMonth(config(), undefined)).toThrow(/frontmatter/);
      expect(() => resolveYearMonth(config(), { year: 2025 })).toThrow(/frontmatter/);
    });

    it('throws when frontmatter values are not numbers', () => {
      expect(() => resolveYearMonth(config(), { year: 2025, month: '12' })).toThrow(/frontmatter/);
    });

    it('rejects an out-of-range month', () => {
      expect(() => resolveYearMonth(config(), { year: 2025, month: 13 })).toThrow(/Invalid month/);
    });

    it('rejects fractional values and NaN', () => {
      expect(() => resolveYearMonth(config(), { year: 2025, month: 5.5 })).toThrow(/whole numbers/);
      expect(() => resolveYearMonth(config(), { year: 2025.5, month: 5 })).toThrow(/whole numbers/);
      expect(() => resolveYearMonth(config(), { year: 2025, month: NaN })).toThrow(/whole numbers/);
    });
  });
});
