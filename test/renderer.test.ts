// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from 'vitest';
import {
  renderTracker,
  renderBoolean,
  renderColormap,
  renderHeatmap,
  type DayData,
} from '../src/renderer';
import { t } from '../src/i18n';
import type { BooleanConfig, ColormapConfig, HeatmapConfig } from '../src/types';

// renderer.ts builds DOM via Obsidian's `activeDocument` global; point it at the
// happy-dom `document` so the cells can be constructed and inspected.
beforeAll(() => {
  (globalThis as unknown as { activeDocument: Document }).activeDocument = document;
});

const cellsOf = (el: HTMLElement) =>
  Array.from(el.querySelectorAll<HTMLElement>('.monthly-tracker-cell'));

describe('renderTracker', () => {
  it('wraps the tracker in a .monthly-tracker container with a row', () => {
    const el = renderTracker({ type: 'boolean', color: 'blue' } as BooleanConfig, new Map(), 30);
    expect(el.classList.contains('monthly-tracker')).toBe(true);
    expect(el.querySelector('.monthly-tracker-row')).not.toBeNull();
  });
});

describe('renderBoolean', () => {
  const config: BooleanConfig = { type: 'boolean', color: 'green' };

  it('renders one cell per day of the month', () => {
    expect(cellsOf(renderBoolean(config, new Map(), 30))).toHaveLength(30);
    expect(cellsOf(renderBoolean(config, new Map(), 28))).toHaveLength(28);
  });

  it('renders an active day with a file as a linked, colored cell', () => {
    const data = new Map<number, DayData>([
      [5, { day: 5, value: true, filePath: 'Daily/2026-06-05.md' }],
    ]);
    const cell = cellsOf(renderBoolean(config, data, 30))[4];
    expect(cell.tagName).toBe('A');
    expect(cell.classList.contains('is-active')).toBe(true);
    expect(cell.classList.contains('internal-link')).toBe(true);
    expect(cell.getAttribute('data-href')).toBe('Daily/2026-06-05.md');
    expect(cell.style.backgroundColor).not.toBe('');
    expect(cell.getAttribute('aria-label')).toBe(t().tooltipYes);
    expect(cell.textContent).toBe('5');
  });

  it('renders a day with no data as an empty div without color or tooltip', () => {
    const cell = cellsOf(renderBoolean(config, new Map(), 30))[0];
    expect(cell.tagName).toBe('DIV');
    expect(cell.classList.contains('is-empty')).toBe(true);
    expect(cell.style.backgroundColor).toBe('');
    expect(cell.hasAttribute('aria-label')).toBe(false);
  });

  it('treats a falsy value as inactive', () => {
    const data = new Map<number, DayData>([[3, { day: 3, value: false }]]);
    const cell = cellsOf(renderBoolean(config, data, 30))[2];
    expect(cell.classList.contains('is-empty')).toBe(true);
  });
});

describe('renderColormap', () => {
  const config: ColormapConfig = {
    type: 'colormap',
    property: 'mood',
    colors: { good: '#00ff00', bad: '#ff0000' },
  };

  it('colors a cell whose value matches the color map', () => {
    const data = new Map<number, DayData>([[1, { day: 1, value: 'good' }]]);
    const cell = cellsOf(renderColormap(config, data, 3))[0];
    expect(cell.classList.contains('is-active')).toBe(true);
    expect(cell.style.backgroundColor).not.toBe('');
    expect(cell.getAttribute('aria-label')).toBe('good');
  });

  it('leaves a cell empty when its value is not in the map', () => {
    const data = new Map<number, DayData>([[2, { day: 2, value: 'unknown' }]]);
    const cell = cellsOf(renderColormap(config, data, 3))[1];
    expect(cell.classList.contains('is-empty')).toBe(true);
    expect(cell.style.backgroundColor).toBe('');
  });

  it('ignores non-scalar values (objects/arrays)', () => {
    const data = new Map<number, DayData>([[1, { day: 1, value: { nested: true } }]]);
    const cell = cellsOf(renderColormap(config, data, 3))[0];
    expect(cell.classList.contains('is-empty')).toBe(true);
  });
});

describe('renderHeatmap', () => {
  const base: HeatmapConfig = {
    type: 'heatmap',
    property: 'steps',
    bins: [5, 10],
    colors: ['#eee', '#aaa', '#777', '#333'],
    unit: 'k',
  };

  const data = new Map<number, DayData>([
    [1, { day: 1, value: 3 }],
    [2, { day: 2, value: 8 }],
    [3, { day: 3, value: 20 }],
  ]);

  it('marks days with a positive value as active and labels them with the value', () => {
    const cells = cellsOf(renderHeatmap(base, data, 3));
    expect(cells[0].classList.contains('is-active')).toBe(true);
    expect(cells[0].getAttribute('aria-label')).toBe('3k');
    expect(cells[0].style.backgroundColor).not.toBe('');
  });

  it('leaves zero/empty days inactive', () => {
    const cells = cellsOf(renderHeatmap(base, new Map(), 3));
    expect(cells.every((c) => c.classList.contains('is-empty'))).toBe(true);
  });

  it('renders a total summary when showTotal is set', () => {
    const el = renderHeatmap({ ...base, showTotal: true }, data, 3);
    const value = el.querySelector('.monthly-tracker-summary-value');
    expect(value).not.toBeNull();
    // 3 + 8 + 20 = 31, with the configured unit.
    expect(value?.textContent).toBe('31k');
  });

  it('omits the summary when showTotal is not set', () => {
    const el = renderHeatmap(base, data, 3);
    expect(el.querySelector('.monthly-tracker-summary')).toBeNull();
  });

  it('formats a non-integer total to one decimal place', () => {
    const decimal = new Map<number, DayData>([
      [1, { day: 1, value: 1.5 }],
      [2, { day: 2, value: 2 }],
    ]);
    const el = renderHeatmap({ ...base, showTotal: true }, decimal, 3);
    expect(el.querySelector('.monthly-tracker-summary-value')?.textContent).toBe('3.5k');
  });
});
