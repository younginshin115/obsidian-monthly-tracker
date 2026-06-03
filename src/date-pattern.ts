/**
 * Build a regex that matches daily-note filenames for a given year/month.
 *
 * The `dateFormat` uses `YYYY`/`MM`/`DD` tokens. `YYYY` and `MM` are filled in
 * with the concrete year/month, while `DD` becomes a captured `(\d{2})` group so
 * callers can read the day back out. Any other characters in the format are
 * treated literally and regex-escaped.
 */
export function buildDatePattern(dateFormat: string, year: number, month: number): RegExp {
  const mm = String(month).padStart(2, '0');
  const escaped = dateFormat
    .replace('YYYY', '\x00Y\x00')
    .replace('MM', '\x00M\x00')
    .replace('DD', '\x00D\x00')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace('\x00Y\x00', String(year))
    .replace('\x00M\x00', mm)
    .replace('\x00D\x00', '(\\d{2})');
  return new RegExp(`^${escaped}`);
}
