import { TrackerConfig, BooleanConfig, ColormapConfig, HeatmapConfig } from './types';
import { resolveColor, resolveHeatmapColors } from './presets';
import { t } from './i18n';

export interface DayData {
  day: number;
  value: unknown;
  filePath?: string;
}

/**
 * Build a single day cell.
 * @param bgColor inline background color for active cells; null lets the theme
 *   (`.is-empty`) style empty cells so dark mode is respected.
 */
function dayCell(
  day: number,
  bgColor: string | null,
  active: boolean,
  filePath: string | undefined,
  tooltip: string,
): HTMLElement {
  const el: HTMLElement = filePath
    ? document.createElement('a')
    : document.createElement('div');

  el.classList.add('monthly-tracker-cell', active ? 'is-active' : 'is-empty');
  if (bgColor) el.style.backgroundColor = bgColor;

  if (filePath) {
    const anchor = el as HTMLAnchorElement;
    anchor.classList.add('internal-link');
    anchor.setAttribute('href', filePath);
    anchor.dataset.href = filePath;
  }

  el.title = tooltip;
  el.textContent = String(day);
  return el;
}

function wrapGrid(cells: HTMLElement[]): HTMLElement {
  const row = document.createElement('div');
  row.classList.add('monthly-tracker-row');
  for (const cell of cells) row.appendChild(cell);
  return row;
}

export function renderBoolean(config: BooleanConfig, data: Map<number, DayData>, daysInMonth: number): HTMLElement {
  const activeColor = resolveColor(config.color);
  const cells: HTMLElement[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const entry = data.get(day);
    const active = entry !== undefined && !!entry.value;
    cells.push(dayCell(day, active ? activeColor : null, active, entry?.filePath, active ? t().tooltipYes : ''));
  }

  return wrapGrid(cells);
}

export function renderColormap(config: ColormapConfig, data: Map<number, DayData>, daysInMonth: number): HTMLElement {
  const colorMap = config.colors;
  const cells: HTMLElement[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const entry = data.get(day);
    const val = entry?.value as string | undefined;
    const mappedColor = val != null ? colorMap[val] : undefined;
    cells.push(dayCell(day, mappedColor ?? null, !!mappedColor, entry?.filePath, val ?? ''));
  }

  return wrapGrid(cells);
}

export function renderHeatmap(config: HeatmapConfig, data: Map<number, DayData>, daysInMonth: number): HTMLElement {
  const colors = resolveHeatmapColors(config.colors, config.colorScheme);
  // bins are validated upstream in processBlock; non-null assertion is safe here.
  const bins = config.bins!;
  const unit = config.unit ?? '';

  function getIntensity(val: number): number {
    if (val <= 0) return 0;
    for (let i = 0; i < bins.length; i++) {
      if (val < bins[i]) return i + 1;
    }
    return bins.length + 1;
  }

  const maxIntensity = bins.length + 1;
  const safeColors = colors.length >= maxIntensity + 1 ? colors : [
    ...colors,
    ...Array(maxIntensity + 1 - colors.length).fill(colors[colors.length - 1] ?? ''),
  ];

  let total = 0;
  const cells: HTMLElement[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const entry = data.get(day);
    const raw = entry?.value;
    const val = typeof raw === 'number' && isFinite(raw) ? raw : 0;
    total += val;
    const intensity = getIntensity(val);
    const active = intensity > 0;
    const bgColor = active ? (safeColors[intensity] || null) : null;
    cells.push(dayCell(day, bgColor, active, entry?.filePath, val > 0 ? `${val}${unit}` : ''));
  }

  const container = document.createElement('div');

  if (config.showTotal) {
    const label = config.totalLabel ?? t().totalLabel;
    const summary = document.createElement('div');
    summary.classList.add('monthly-tracker-summary');
    summary.textContent = `${label}: `;
    const value = document.createElement('span');
    value.classList.add('monthly-tracker-summary-value');
    const displayTotal = Number.isInteger(total) ? String(total) : total.toFixed(1);
    value.textContent = `${displayTotal}${unit}`;
    summary.appendChild(value);
    container.appendChild(summary);
  }

  container.appendChild(wrapGrid(cells));
  return container;
}

export function renderTracker(
  config: TrackerConfig,
  data: Map<number, DayData>,
  daysInMonth: number,
): HTMLElement {
  const container = document.createElement('div');
  container.classList.add('monthly-tracker');

  let inner: HTMLElement | null = null;
  if (config.type === 'boolean') {
    inner = renderBoolean(config, data, daysInMonth);
  } else if (config.type === 'colormap') {
    inner = renderColormap(config, data, daysInMonth);
  } else if (config.type === 'heatmap') {
    inner = renderHeatmap(config, data, daysInMonth);
  }

  if (inner) container.appendChild(inner);
  return container;
}
