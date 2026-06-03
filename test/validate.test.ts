import { describe, it, expect } from 'vitest';
import { validateConfig } from '../src/validate';
import type { TrackerConfig } from '../src/types';

describe('validateConfig', () => {
  it('throws when type is missing', () => {
    expect(() => validateConfig({} as TrackerConfig)).toThrow(/type/);
  });

  it('requires property for non-boolean types', () => {
    expect(() => validateConfig({ type: 'colormap' } as TrackerConfig)).toThrow(/property/);
  });

  it('allows boolean type without a property', () => {
    expect(() => validateConfig({ type: 'boolean' } as TrackerConfig)).not.toThrow();
  });

  it('requires colors for colormap', () => {
    expect(() =>
      validateConfig({ type: 'colormap', property: 'mood' } as TrackerConfig),
    ).toThrow(/colors/);
  });

  it('accepts a valid colormap', () => {
    expect(() =>
      validateConfig({
        type: 'colormap',
        property: 'mood',
        colors: { good: '#0f0' },
      } as unknown as TrackerConfig),
    ).not.toThrow();
  });

  describe('heatmap bins', () => {
    const base = { type: 'heatmap', property: 'steps' } as const;

    it('requires non-empty bins', () => {
      expect(() => validateConfig({ ...base, bins: [] } as unknown as TrackerConfig)).toThrow();
      expect(() => validateConfig(base as unknown as TrackerConfig)).toThrow();
    });

    it('rejects a non-positive first bin', () => {
      expect(() =>
        validateConfig({ ...base, bins: [0, 10] } as unknown as TrackerConfig),
      ).toThrow();
    });

    it('rejects non-ascending bins', () => {
      expect(() =>
        validateConfig({ ...base, bins: [10, 10] } as unknown as TrackerConfig),
      ).toThrow();
      expect(() =>
        validateConfig({ ...base, bins: [10, 5] } as unknown as TrackerConfig),
      ).toThrow();
    });

    it('accepts strictly ascending positive bins', () => {
      expect(() =>
        validateConfig({ ...base, bins: [5, 10, 15] } as unknown as TrackerConfig),
      ).not.toThrow();
    });
  });
});
