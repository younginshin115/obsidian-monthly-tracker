import { describe, it, expect } from 'vitest';
import { buildDatePattern } from '../src/date-pattern';

describe('buildDatePattern', () => {
  it('matches a YYYY-MM-DD filename for the given year/month', () => {
    const re = buildDatePattern('YYYY-MM-DD', 2026, 6);
    expect('2026-06-04.md').toMatch(re);
    expect('2026-06-04').toMatch(re);
  });

  it('captures the day as a two-digit group', () => {
    const re = buildDatePattern('YYYY-MM-DD', 2026, 6);
    const match = '2026-06-04.md'.match(re);
    expect(match?.[1]).toBe('04');
  });

  it('zero-pads single-digit months', () => {
    const re = buildDatePattern('YYYY-MM-DD', 2026, 3);
    expect('2026-03-09.md').toMatch(re);
    expect('2026-3-09.md').not.toMatch(re);
  });

  it('does not match a different month', () => {
    const re = buildDatePattern('YYYY-MM-DD', 2026, 6);
    expect('2026-07-04.md').not.toMatch(re);
  });

  it('anchors at the start so a trailing year does not match', () => {
    const re = buildDatePattern('YYYY-MM-DD', 2026, 6);
    expect('note-2026-06-04.md').not.toMatch(re);
  });

  it('escapes literal characters in the format', () => {
    const re = buildDatePattern('YYYY.MM.DD', 2026, 6);
    expect('2026.06.04.md').toMatch(re);
    // The '.' must be literal, not a regex wildcard.
    expect('2026x06x04.md').not.toMatch(re);
  });

  it('supports formats without separators', () => {
    const re = buildDatePattern('YYYYMMDD', 2026, 6);
    const match = '20260604.md'.match(re);
    expect(match?.[1]).toBe('04');
  });
});
