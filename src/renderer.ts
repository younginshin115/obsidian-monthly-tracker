import { TrackerConfig, BooleanConfig, ColormapConfig, HeatmapConfig } from './types';
import {
  resolveColor,
  resolveHeatmapColors,
  resolveColormapColors,
} from './presets';

export interface DayData {
  day: number;
  value: unknown;
  filePath?: string;
}

const EMPTY_COLOR = '#ebedf0';

function dayCell(
  day: number,
  bgColor: string,
  filePath: string | undefined,
  tooltip: string,
  textStyle: string,
): string {
  const base = `background-color:${bgColor};display:flex;align-items:center;justify-content:center;padding:4px 2px;border-radius:2px;font-size:9px;min-width:22px;box-sizing:border-box;${textStyle}`;

  if (filePath) {
    return `<a href="${filePath}" class="internal-link" title="${tooltip}" style="${base};text-decoration:none;">${day}</a>`;
  }
  return `<div title="${tooltip}" style="${base}">${day}</div>`;
}

function wrapGrid(cells: string): string {
  return `<div style="display:flex;gap:2px;overflow-x:auto;margin-bottom:8px;">${cells}</div>`;
}

export function renderBoolean(config: BooleanConfig, data: Map<number, DayData>, daysInMonth: number): string {
  const activeColor = resolveColor(config.color);
  let cells = '';

  for (let day = 1; day <= daysInMonth; day++) {
    const entry = data.get(day);
    const active = entry !== undefined && !!entry.value;
    const bgColor = active ? activeColor : EMPTY_COLOR;
    const textStyle = active ? 'font-weight:600;color:white;' : 'color:#999;';
    cells += dayCell(day, bgColor, entry?.filePath, active ? 'Yes' : '', textStyle);
  }

  return wrapGrid(cells);
}

export function renderColormap(config: ColormapConfig, data: Map<number, DayData>, daysInMonth: number): string {
  const colorMap = resolveColormapColors(config.colors, config.preset);
  let cells = '';

  for (let day = 1; day <= daysInMonth; day++) {
    const entry = data.get(day);
    const val = entry?.value as string | undefined;
    const bgColor = (val && colorMap[val]) ? colorMap[val] : EMPTY_COLOR;
    const hasData = val && colorMap[val];
    const textStyle = hasData ? 'font-weight:600;color:white;' : 'color:#999;';
    cells += dayCell(day, bgColor, entry?.filePath, val ?? '', textStyle);
  }

  return wrapGrid(cells);
}

export function renderHeatmap(config: HeatmapConfig, data: Map<number, DayData>, daysInMonth: number): string {
  const colors = resolveHeatmapColors(config.colors, config.colorScheme);
  const bins = config.bins ?? [1, 3, 5, 7];
  const unit = config.unit ?? '';

  function getIntensity(val: number): number {
    if (!val || val <= 0) return 0;
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
  let cells = '';

  for (let day = 1; day <= daysInMonth; day++) {
    const entry = data.get(day);
    const val = typeof entry?.value === 'number' ? entry.value : 0;
    total += val;
    const intensity = getIntensity(val);
    const bgColor = safeColors[intensity] ?? EMPTY_COLOR;
    const hasData = intensity > 0;
    const textStyle = hasData ? 'font-weight:600;color:white;' : 'color:#999;';
    const tooltip = val > 0 ? `${val}${unit}` : '';
    cells += dayCell(day, bgColor, entry?.filePath, tooltip, textStyle);
  }

  let html = '';
  if (config.showTotal) {
    const label = config.totalLabel ?? (unit ? `합계` : '합계');
    html += `<div style="margin-bottom:6px;font-size:12px;color:var(--text-muted);">${label}: <span style="font-weight:600;color:var(--text-normal);">${total.toFixed(1)}${unit}</span></div>`;
  }
  html += wrapGrid(cells);
  return html;
}

export function renderTracker(
  config: TrackerConfig,
  data: Map<number, DayData>,
  daysInMonth: number,
): HTMLElement {
  const container = document.createElement('div');
  container.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

  let inner = '';
  if (config.type === 'boolean') {
    inner = renderBoolean(config, data, daysInMonth);
  } else if (config.type === 'colormap') {
    inner = renderColormap(config, data, daysInMonth);
  } else if (config.type === 'heatmap') {
    inner = renderHeatmap(config, data, daysInMonth);
  }

  container.innerHTML = inner;
  return container;
}
