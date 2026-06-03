import { TrackerConfig, BooleanConfig, ColormapConfig, HeatmapConfig } from './types';
import { resolveColor, resolveHeatmapColors } from './presets';
import { t } from './i18n';

export interface DayData {
  day: number;
  value: unknown;
  filePath?: string;
}

const EMPTY_COLOR = '#ebedf0';

function applyBaseStyle(el: HTMLElement, bgColor: string, textStyle: Record<string, string>): void {
  Object.assign(el.style, {
    backgroundColor: bgColor,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px 0',
    borderRadius: '2px',
    fontSize: '9px',
    flex: '1',
    minWidth: '0',
    boxSizing: 'border-box',
    ...textStyle,
  });
}

function dayCell(
  day: number,
  bgColor: string,
  filePath: string | undefined,
  tooltip: string,
  textStyle: Record<string, string>,
): HTMLElement {
  const el: HTMLElement = filePath
    ? document.createElement('a')
    : document.createElement('div');

  if (filePath) {
    const anchor = el as HTMLAnchorElement;
    anchor.classList.add('internal-link');
    anchor.setAttribute('href', filePath);
    anchor.dataset.href = filePath;
    anchor.style.textDecoration = 'none';
  }

  el.title = tooltip;
  el.textContent = String(day);
  applyBaseStyle(el, bgColor, textStyle);
  return el;
}

function wrapGrid(cells: HTMLElement[]): HTMLElement {
  const row = document.createElement('div');
  Object.assign(row.style, { display: 'flex', gap: '2px', marginBottom: '8px' });
  for (const cell of cells) row.appendChild(cell);
  return row;
}

const ACTIVE_STYLE: Record<string, string> = { fontWeight: '600', color: 'white' };
const EMPTY_STYLE: Record<string, string> = { color: '#999' };

export function renderBoolean(config: BooleanConfig, data: Map<number, DayData>, daysInMonth: number): HTMLElement {
  const activeColor = resolveColor(config.color);
  const cells: HTMLElement[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const entry = data.get(day);
    const active = entry !== undefined && !!entry.value;
    cells.push(dayCell(day, active ? activeColor : EMPTY_COLOR, entry?.filePath, active ? t().tooltipYes : '', active ? ACTIVE_STYLE : EMPTY_STYLE));
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
    const bgColor = mappedColor ?? EMPTY_COLOR;
    cells.push(dayCell(day, bgColor, entry?.filePath, val ?? '', mappedColor ? ACTIVE_STYLE : EMPTY_STYLE));
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
    ...Array(maxIntensity + 1 - colors.length).fill(colors[colors.length - 1] ?? EMPTY_COLOR),
  ];

  let total = 0;
  const cells: HTMLElement[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const entry = data.get(day);
    const raw = entry?.value;
    const val = typeof raw === 'number' && isFinite(raw) ? raw : 0;
    total += val;
    const intensity = getIntensity(val);
    const bgColor = safeColors[intensity] ?? EMPTY_COLOR;
    cells.push(dayCell(day, bgColor, entry?.filePath, val > 0 ? `${val}${unit}` : '', intensity > 0 ? ACTIVE_STYLE : EMPTY_STYLE));
  }

  const container = document.createElement('div');

  if (config.showTotal) {
    const label = config.totalLabel ?? t().totalLabel;
    const summary = document.createElement('div');
    Object.assign(summary.style, { marginBottom: '6px', fontSize: '12px', color: 'var(--text-muted)' });
    summary.textContent = `${label}: `;
    const value = document.createElement('span');
    Object.assign(value.style, { fontWeight: '600', color: 'var(--text-normal)' });
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
  container.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

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
