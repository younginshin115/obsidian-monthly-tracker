export interface BooleanConfig {
  type: 'boolean';
  title?: string;
  property?: string;
  source?: string;
  /** hex color string or preset name (e.g. "blue") */
  color: string;
}

export interface ColormapConfig {
  type: 'colormap';
  title?: string;
  property: string;
  source?: string;
  colors: Record<string, string>;
}

export interface HeatmapConfig {
  type: 'heatmap';
  title?: string;
  property: string;
  source?: string;
  unit?: string;
  /**
   * Thresholds separating intensity levels.
   * e.g. [3, 5, 7, 10] → 5 buckets: [0,3), [3,5), [5,7), [7,10), [10,∞)
   */
  bins?: number[];
  /** array of hex colors, length = bins.length + 1, or omit and use colorScheme */
  colors?: string[];
  /** built-in heatmap color scheme name (e.g. "indigo") */
  colorScheme?: string;
  showTotal?: boolean;
  /** label shown next to total, defaults to property name */
  totalLabel?: string;
}

export type TrackerConfig = BooleanConfig | ColormapConfig | HeatmapConfig;

export interface PluginSettings {
  dailyNotesFolder: string;
  dateFormat: string;
}

export const DEFAULT_SETTINGS: PluginSettings = {
  dailyNotesFolder: '',
  dateFormat: 'YYYY-MM-DD',
};
