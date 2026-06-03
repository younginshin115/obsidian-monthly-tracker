import { describe, it, expect } from 'vitest';
import {
  COLOR_PRESETS,
  HEATMAP_SCHEMES,
  resolveColor,
  resolveHeatmapColors,
} from '../src/presets';

describe('resolveColor', () => {
  it('returns the blue preset when no color is given', () => {
    expect(resolveColor()).toBe(COLOR_PRESETS.blue);
    expect(resolveColor('')).toBe(COLOR_PRESETS.blue);
  });

  it('resolves a known preset name to its hex (case-insensitive)', () => {
    expect(resolveColor('green')).toBe(COLOR_PRESETS.green);
    expect(resolveColor('GREEN')).toBe(COLOR_PRESETS.green);
  });

  it('passes through an unknown color string unchanged', () => {
    expect(resolveColor('#123456')).toBe('#123456');
    expect(resolveColor('rebeccapurple')).toBe('rebeccapurple');
  });
});

describe('resolveHeatmapColors', () => {
  it('prefers an explicit non-empty colors array', () => {
    const colors = ['#000', '#111', '#222'];
    expect(resolveHeatmapColors(colors, 'green')).toBe(colors);
  });

  it('resolves a known scheme name when no colors array is given', () => {
    expect(resolveHeatmapColors(undefined, 'green')).toBe(HEATMAP_SCHEMES.green);
    expect(resolveHeatmapColors([], 'GREEN')).toBe(HEATMAP_SCHEMES.green);
  });

  it('falls back to the indigo scheme for an unknown or missing scheme', () => {
    expect(resolveHeatmapColors()).toBe(HEATMAP_SCHEMES.indigo);
    expect(resolveHeatmapColors(undefined, 'not-a-scheme')).toBe(HEATMAP_SCHEMES.indigo);
  });
});
