/** Single-color presets for boolean tracker */
export const COLOR_PRESETS: Record<string, string> = {
  blue:   '#64b5f6',
  green:  '#66bb6a',
  red:    '#e57373',
  purple: '#ba68c8',
  orange: '#ffb74d',
  yellow: '#ffd54f',
  teal:   '#4db6ac',
  indigo: '#7986cb',
  pink:   '#f06292',
};

/**
 * Heatmap color-scheme presets.
 * Index 0 = no data, index 1..n = increasing intensity.
 */
export const HEATMAP_SCHEMES: Record<string, string[]> = {
  blue:   ['#ebedf0', '#bbdefb', '#90caf9', '#64b5f6', '#42a5f5', '#1e88e5'],
  green:  ['#ebedf0', '#c8e6c9', '#a5d6a7', '#81c784', '#66bb6a', '#43a047'],
  red:    ['#ebedf0', '#ffcdd2', '#ef9a9a', '#e57373', '#ef5350', '#e53935'],
  purple: ['#ebedf0', '#e1bee7', '#ce93d8', '#ba68c8', '#ab47bc', '#8e24aa'],
  orange: ['#ebedf0', '#ffe0b2', '#ffcc80', '#ffb74d', '#ffa726', '#fb8c00'],
  yellow: ['#ebedf0', '#fff9c4', '#fff59d', '#fff176', '#ffee58', '#fdd835'],
  teal:   ['#ebedf0', '#b2dfdb', '#80cbc4', '#4db6ac', '#26a69a', '#00897b'],
  indigo: ['#ebedf0', '#e8eaf6', '#c5cae9', '#9fa8da', '#7986cb', '#5c6bc0'],
  pink:   ['#ebedf0', '#fce4ec', '#f48fb1', '#f06292', '#ec407a', '#d81b60'],
};

/** Colormap presets: named value → color */
export const COLORMAP_PRESETS: Record<string, Record<string, string>> = {
  condition: {
    good:  '#2196f3',
    soso:  '#8bc34a',
    tired: '#ff9800',
    bad:   '#f44336',
  },
};

/** Resolve a color string: if it's a known preset name, return the hex; otherwise return as-is. */
export function resolveColor(color: string): string {
  return COLOR_PRESETS[color.toLowerCase()] ?? color;
}

/** Resolve heatmap colors array from colorScheme preset or explicit colors array. */
export function resolveHeatmapColors(colors?: string[], colorScheme?: string): string[] {
  if (colors && colors.length > 0) return colors;
  if (colorScheme) {
    const scheme = HEATMAP_SCHEMES[colorScheme.toLowerCase()];
    if (scheme) return scheme;
  }
  return HEATMAP_SCHEMES['indigo'];
}

/** Resolve colormap colors from preset or explicit colors map. */
export function resolveColormapColors(
  colors?: Record<string, string>,
  preset?: string,
): Record<string, string> {
  if (colors && Object.keys(colors).length > 0) return colors;
  if (preset) {
    const p = COLORMAP_PRESETS[preset.toLowerCase()];
    if (p) return p;
  }
  return {};
}
