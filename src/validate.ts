import { TrackerConfig } from './types';
import { t } from './i18n';

/** Validate config-level invariants up front so renderers can assume valid input. */
export function validateConfig(config: TrackerConfig): void {
  const m = t();
  if (!config?.type) {
    throw new Error(m.errMissingType);
  }
  if (!config.property && config.type !== 'boolean') {
    throw new Error(m.errMissingProperty);
  }
  if (config.type === 'colormap' && !config.colors) {
    throw new Error(m.errMissingColors);
  }
  if (config.type === 'heatmap') {
    const bins = config.bins;
    if (!bins || bins.length === 0) {
      throw new Error(m.errHeatmapBins);
    }
    if (bins[0] <= 0) {
      throw new Error(m.errBinsPositive(bins[0]));
    }
    for (let i = 1; i < bins.length; i++) {
      if (bins[i] <= bins[i - 1]) {
        throw new Error(m.errBinsAscending(bins[i - 1], bins[i]));
      }
    }
  }
}
