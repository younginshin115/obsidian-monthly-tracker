import { describe, it, expect } from 'vitest';
import type { App } from 'obsidian';
import { detectDailyNotesFolder, resolveDailyNotesFolder } from '../src/folder';

describe('resolveDailyNotesFolder', () => {
  it('prefers the code-block source over settings and detection', () => {
    expect(resolveDailyNotesFolder('Journal', 'Settings', 'Detected')).toBe('Journal');
  });

  it('falls back to the settings folder when source is undefined', () => {
    expect(resolveDailyNotesFolder(undefined, 'Settings', 'Detected')).toBe('Settings');
  });

  it('falls back to the detected folder when source and settings are empty', () => {
    expect(resolveDailyNotesFolder(undefined, '', 'Detected')).toBe('Detected');
  });

  it('normalizes trailing and leading slashes', () => {
    expect(resolveDailyNotesFolder('Calendar/Days/', '', '')).toBe('Calendar/Days');
    expect(resolveDailyNotesFolder('/Calendar/Days', '', '')).toBe('Calendar/Days');
  });

  it('normalizes backslashes to forward slashes', () => {
    expect(resolveDailyNotesFolder('Calendar\\Days', '', '')).toBe('Calendar/Days');
  });

  it('keeps an unresolved path empty instead of normalizing to the vault root', () => {
    // normalizePath('') would return '/', which would scan the whole vault.
    expect(resolveDailyNotesFolder(undefined, '', '')).toBe('');
  });

  it('treats an explicit empty source like an unset one (does not fall through)', () => {
    // `source ?? ...` only falls through on null/undefined, so an explicit ''
    // short-circuits to the empty-guard and yields '' rather than the vault root.
    expect(resolveDailyNotesFolder('', 'Settings', 'Detected')).toBe('');
  });
});

describe('detectDailyNotesFolder', () => {
  it('reads the core Daily notes plugin folder first', () => {
    const app = {
      internalPlugins: {
        plugins: { 'daily-notes': { instance: { options: { folder: 'Daily' } } } },
      },
      plugins: { plugins: { 'periodic-notes': { settings: { daily: { folder: 'Periodic' } } } } },
    } as unknown as App;
    expect(detectDailyNotesFolder(app)).toBe('Daily');
  });

  it('falls back to the Periodic Notes plugin folder', () => {
    const app = {
      internalPlugins: { plugins: {} },
      plugins: { plugins: { 'periodic-notes': { settings: { daily: { folder: 'Periodic' } } } } },
    } as unknown as App;
    expect(detectDailyNotesFolder(app)).toBe('Periodic');
  });

  it('returns empty string when neither plugin is configured', () => {
    const app = { internalPlugins: { plugins: {} }, plugins: { plugins: {} } } as unknown as App;
    expect(detectDailyNotesFolder(app)).toBe('');
  });
});
