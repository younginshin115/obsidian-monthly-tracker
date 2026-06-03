'use strict';

var obsidian = require('obsidian');

const DEFAULT_SETTINGS = {
    dailyNotesFolder: '',
    dateFormat: 'YYYY-MM-DD',
};

const en = {
    errorPrefix: 'Monthly Tracker Error',
    errMissingType: 'Missing required field: type (boolean | colormap | heatmap)',
    errMissingProperty: 'Missing required field: property',
    errMissingColors: 'Missing required field: colors (e.g. colors: {value: "#hex"})',
    errCannotResolveFile: 'Cannot resolve current file',
    errMissingYearMonth: "Current note must have 'year' and 'month' in frontmatter",
    errYearMonthType: "'year' and 'month' must be numbers in frontmatter",
    errInvalidMonth: (month) => `Invalid month: ${month} (must be 1–12)`,
    errHeatmapBins: 'heatmap requires "bins" (e.g. bins: [3, 5, 7, 10])',
    errBinsPositive: (value) => `bins values must be positive (got ${value})`,
    errBinsAscending: (prev, next) => `bins must be in ascending order (got ${prev}, ${next})`,
    tooltipYes: 'Yes',
    totalLabel: 'Total',
    settingsFolderName: 'Daily notes folder',
    settingsFolderDesc: 'Folder containing daily notes (e.g. Calendar/Days)',
    settingsDateFormatName: 'Date format',
    settingsDateFormatDesc: 'File name date format. Must match YYYY-MM-DD at the start of file names.',
};
const ko = {
    errorPrefix: 'Monthly Tracker 오류',
    errMissingType: '필수 항목 누락: type (boolean | colormap | heatmap)',
    errMissingProperty: '필수 항목 누락: property',
    errMissingColors: '필수 항목 누락: colors (예: colors: {value: "#hex"})',
    errCannotResolveFile: '현재 파일을 찾을 수 없습니다',
    errMissingYearMonth: "현재 노트의 프론트매터에 'year'와 'month'가 있어야 합니다",
    errYearMonthType: "프론트매터의 'year'와 'month'는 숫자여야 합니다",
    errInvalidMonth: (month) => `잘못된 month: ${month} (1–12 사이여야 합니다)`,
    errHeatmapBins: 'heatmap에는 "bins"가 필요합니다 (예: bins: [3, 5, 7, 10])',
    errBinsPositive: (value) => `bins 값은 양수여야 합니다 (입력값: ${value})`,
    errBinsAscending: (prev, next) => `bins는 오름차순이어야 합니다 (입력값: ${prev}, ${next})`,
    tooltipYes: '완료',
    totalLabel: '합계',
    settingsFolderName: '데일리 노트 폴더',
    settingsFolderDesc: '데일리 노트가 들어 있는 폴더 (예: Calendar/Days)',
    settingsDateFormatName: '날짜 형식',
    settingsDateFormatDesc: '파일 이름의 날짜 형식. 파일 이름 앞부분이 YYYY-MM-DD와 일치해야 합니다.',
};
function currentLocale() {
    const lang = window.localStorage.getItem('language');
    return lang === 'ko' ? 'ko' : 'en';
}
/** Returns the message table for the current Obsidian UI language. */
function t() {
    return currentLocale() === 'ko' ? ko : en;
}

class MonthlyTrackerSettingTab extends obsidian.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        const { containerEl } = this;
        const m = t();
        containerEl.empty();
        new obsidian.Setting(containerEl)
            .setName(m.settingsFolderName)
            .setDesc(m.settingsFolderDesc)
            .addText(text => text
            .setPlaceholder('Calendar/Days')
            .setValue(this.plugin.settings.dailyNotesFolder)
            .onChange(async (value) => {
            this.plugin.settings.dailyNotesFolder = value.trim();
            await this.plugin.saveSettings();
        }));
        new obsidian.Setting(containerEl)
            .setName(m.settingsDateFormatName)
            .setDesc(m.settingsDateFormatDesc)
            .addText(text => text
            .setPlaceholder('YYYY-MM-DD')
            .setValue(this.plugin.settings.dateFormat)
            .onChange(async (value) => {
            this.plugin.settings.dateFormat = value.trim();
            await this.plugin.saveSettings();
        }));
    }
}

/** Single-color presets for boolean tracker */
const COLOR_PRESETS = {
    blue: '#64b5f6',
    green: '#66bb6a',
    red: '#e57373',
    purple: '#ba68c8',
    orange: '#ffb74d',
    yellow: '#ffd54f',
    teal: '#4db6ac',
    indigo: '#7986cb',
    pink: '#f06292',
};
/**
 * Heatmap color-scheme presets.
 * Index 0 = no data, index 1..n = increasing intensity.
 */
const HEATMAP_SCHEMES = {
    blue: ['#ebedf0', '#bbdefb', '#90caf9', '#64b5f6', '#42a5f5', '#1e88e5'],
    green: ['#ebedf0', '#c8e6c9', '#a5d6a7', '#81c784', '#66bb6a', '#43a047'],
    red: ['#ebedf0', '#ffcdd2', '#ef9a9a', '#e57373', '#ef5350', '#e53935'],
    purple: ['#ebedf0', '#e1bee7', '#ce93d8', '#ba68c8', '#ab47bc', '#8e24aa'],
    orange: ['#ebedf0', '#ffe0b2', '#ffcc80', '#ffb74d', '#ffa726', '#fb8c00'],
    yellow: ['#ebedf0', '#fff9c4', '#fff59d', '#fff176', '#ffee58', '#fdd835'],
    teal: ['#ebedf0', '#b2dfdb', '#80cbc4', '#4db6ac', '#26a69a', '#00897b'],
    indigo: ['#ebedf0', '#e8eaf6', '#c5cae9', '#9fa8da', '#7986cb', '#5c6bc0'],
    pink: ['#ebedf0', '#fce4ec', '#f48fb1', '#f06292', '#ec407a', '#d81b60'],
};
/** Resolve a color string: if it's a known preset name, return the hex; otherwise return as-is. */
function resolveColor(color) {
    var _a;
    if (!color)
        return COLOR_PRESETS.blue;
    return (_a = COLOR_PRESETS[color.toLowerCase()]) !== null && _a !== void 0 ? _a : color;
}
/** Resolve heatmap colors array from colorScheme preset or explicit colors array. */
function resolveHeatmapColors(colors, colorScheme) {
    if (colors && colors.length > 0)
        return colors;
    if (colorScheme) {
        const scheme = HEATMAP_SCHEMES[colorScheme.toLowerCase()];
        if (scheme)
            return scheme;
    }
    return HEATMAP_SCHEMES['indigo'];
}

/**
 * Build a single day cell.
 * @param bgColor inline background color for active cells; null lets the theme
 *   (`.is-empty`) style empty cells so dark mode is respected.
 */
function dayCell(day, bgColor, active, filePath, tooltip) {
    const el = filePath
        ? document.createElement('a')
        : document.createElement('div');
    el.classList.add('monthly-tracker-cell', active ? 'is-active' : 'is-empty');
    if (bgColor)
        el.style.backgroundColor = bgColor;
    if (filePath) {
        const anchor = el;
        anchor.classList.add('internal-link');
        anchor.setAttribute('href', filePath);
        anchor.dataset.href = filePath;
    }
    el.title = tooltip;
    el.textContent = String(day);
    return el;
}
function wrapGrid(cells) {
    const row = document.createElement('div');
    row.classList.add('monthly-tracker-row');
    for (const cell of cells)
        row.appendChild(cell);
    return row;
}
function renderBoolean(config, data, daysInMonth) {
    const activeColor = resolveColor(config.color);
    const cells = [];
    for (let day = 1; day <= daysInMonth; day++) {
        const entry = data.get(day);
        const active = entry !== undefined && !!entry.value;
        cells.push(dayCell(day, active ? activeColor : null, active, entry === null || entry === void 0 ? void 0 : entry.filePath, active ? t().tooltipYes : ''));
    }
    return wrapGrid(cells);
}
function renderColormap(config, data, daysInMonth) {
    const colorMap = config.colors;
    const cells = [];
    for (let day = 1; day <= daysInMonth; day++) {
        const entry = data.get(day);
        const key = (entry === null || entry === void 0 ? void 0 : entry.value) != null ? String(entry.value) : undefined;
        const mappedColor = key != null ? colorMap[key] : undefined;
        cells.push(dayCell(day, mappedColor !== null && mappedColor !== void 0 ? mappedColor : null, !!mappedColor, entry === null || entry === void 0 ? void 0 : entry.filePath, key !== null && key !== void 0 ? key : ''));
    }
    return wrapGrid(cells);
}
function renderHeatmap(config, data, daysInMonth) {
    var _a, _b, _c;
    const colors = resolveHeatmapColors(config.colors, config.colorScheme);
    // bins are validated upstream in processBlock; non-null assertion is safe here.
    const bins = config.bins;
    const unit = (_a = config.unit) !== null && _a !== void 0 ? _a : '';
    function getIntensity(val) {
        if (val <= 0)
            return 0;
        for (let i = 0; i < bins.length; i++) {
            if (val < bins[i])
                return i + 1;
        }
        return bins.length + 1;
    }
    const maxIntensity = bins.length + 1;
    const safeColors = colors.length >= maxIntensity + 1 ? colors : [
        ...colors,
        ...Array(maxIntensity + 1 - colors.length).fill((_b = colors[colors.length - 1]) !== null && _b !== void 0 ? _b : ''),
    ];
    let total = 0;
    const cells = [];
    for (let day = 1; day <= daysInMonth; day++) {
        const entry = data.get(day);
        const raw = entry === null || entry === void 0 ? void 0 : entry.value;
        const val = typeof raw === 'number' && isFinite(raw) ? raw : 0;
        total += val;
        const intensity = getIntensity(val);
        const active = intensity > 0;
        const bgColor = active ? (safeColors[intensity] || null) : null;
        cells.push(dayCell(day, bgColor, active, entry === null || entry === void 0 ? void 0 : entry.filePath, val > 0 ? `${val}${unit}` : ''));
    }
    const container = document.createElement('div');
    if (config.showTotal) {
        const label = (_c = config.totalLabel) !== null && _c !== void 0 ? _c : t().totalLabel;
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
function renderTracker(config, data, daysInMonth) {
    const container = document.createElement('div');
    container.classList.add('monthly-tracker');
    let inner = null;
    if (config.type === 'boolean') {
        inner = renderBoolean(config, data, daysInMonth);
    }
    else if (config.type === 'colormap') {
        inner = renderColormap(config, data, daysInMonth);
    }
    else if (config.type === 'heatmap') {
        inner = renderHeatmap(config, data, daysInMonth);
    }
    if (inner)
        container.appendChild(inner);
    return container;
}

function buildDatePattern(dateFormat, year, month) {
    const mm = String(month).padStart(2, '0');
    const escaped = dateFormat
        .replace('YYYY', '\x00Y\x00')
        .replace('MM', '\x00M\x00')
        .replace('DD', '\x00D\x00')
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace('\x00Y\x00', String(year))
        .replace('\x00M\x00', mm)
        .replace('\x00D\x00', '(\\d{2})');
    return new RegExp(`^${escaped}`);
}
function detectDailyNotesFolder(app) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const internal = (_e = (_d = (_c = (_b = (_a = app.internalPlugins) === null || _a === void 0 ? void 0 : _a.plugins) === null || _b === void 0 ? void 0 : _b['daily-notes']) === null || _c === void 0 ? void 0 : _c.instance) === null || _d === void 0 ? void 0 : _d.options) === null || _e === void 0 ? void 0 : _e.folder;
    if (internal)
        return internal;
    const periodic = (_k = (_j = (_h = (_g = (_f = app.plugins) === null || _f === void 0 ? void 0 : _f.plugins) === null || _g === void 0 ? void 0 : _g['periodic-notes']) === null || _h === void 0 ? void 0 : _h.settings) === null || _j === void 0 ? void 0 : _j.daily) === null || _k === void 0 ? void 0 : _k.folder;
    if (periodic)
        return periodic;
    return '';
}
/** Validate config-level invariants up front so renderers can assume valid input. */
function validateConfig(config) {
    const m = t();
    if (!(config === null || config === void 0 ? void 0 : config.type)) {
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
class MonthlyTrackerPlugin extends obsidian.Plugin {
    async onload() {
        await this.loadSettings();
        this.addSettingTab(new MonthlyTrackerSettingTab(this.app, this));
        this.registerMarkdownCodeBlockProcessor('monthly-tracker', async (source, el, ctx) => {
            try {
                await this.processBlock(source, el, ctx);
            }
            catch (err) {
                el.createEl('pre', {
                    text: `${t().errorPrefix}:\n${err instanceof Error ? err.message : String(err)}`,
                    cls: 'monthly-tracker-error',
                });
            }
        });
    }
    async processBlock(source, el, ctx) {
        var _a, _b, _c;
        const config = obsidian.parseYaml(source.trim());
        validateConfig(config);
        // Read year/month from the current note's frontmatter
        const currentFile = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
        if (!(currentFile instanceof obsidian.TFile)) {
            throw new Error(t().errCannotResolveFile);
        }
        const fm = (_a = this.app.metadataCache.getFileCache(currentFile)) === null || _a === void 0 ? void 0 : _a.frontmatter;
        const year = fm === null || fm === void 0 ? void 0 : fm.year;
        const month = fm === null || fm === void 0 ? void 0 : fm.month;
        if (year == null || month == null) {
            throw new Error(t().errMissingYearMonth);
        }
        if (typeof year !== 'number' || typeof month !== 'number') {
            throw new Error(t().errYearMonthType);
        }
        if (month < 1 || month > 12) {
            throw new Error(t().errInvalidMonth(month));
        }
        const daysInMonth = new Date(year, month, 0).getDate();
        const folder = (_b = config.source) !== null && _b !== void 0 ? _b : (this.settings.dailyNotesFolder || detectDailyNotesFolder(this.app));
        const pattern = buildDatePattern(this.settings.dateFormat, year, month);
        // Scan vault folder for matching daily notes
        const data = new Map();
        const abstractFolder = this.app.vault.getAbstractFileByPath(folder);
        if (abstractFolder instanceof obsidian.TFolder) {
            for (const child of abstractFolder.children) {
                if (!(child instanceof obsidian.TFile))
                    continue;
                const match = child.name.match(pattern);
                if (!match)
                    continue;
                const day = parseInt(match[1], 10);
                const childFm = (_c = this.app.metadataCache.getFileCache(child)) === null || _c === void 0 ? void 0 : _c.frontmatter;
                let value = undefined;
                if (config.property === null || config.property === undefined) {
                    // File-existence mode (e.g. Morning Journal folder)
                    value = true;
                }
                else {
                    value = childFm === null || childFm === void 0 ? void 0 : childFm[config.property];
                }
                data.set(day, { day, value, filePath: child.path });
            }
        }
        const rendered = renderTracker(config, data, daysInMonth);
        // Delegate internal-link clicks to Obsidian so day cells open the note.
        this.registerDomEvent(rendered, 'click', (evt) => {
            const link = evt.target.closest('a.internal-link');
            const path = link === null || link === void 0 ? void 0 : link.getAttribute('data-href');
            if (!path)
                return;
            evt.preventDefault();
            this.app.workspace.openLinkText(path, ctx.sourcePath, evt.ctrlKey || evt.metaKey);
        });
        // Trigger Obsidian's page-preview on hover (data-href alone doesn't enable it).
        this.registerDomEvent(rendered, 'mouseover', (evt) => {
            const link = evt.target.closest('a.internal-link');
            const path = link === null || link === void 0 ? void 0 : link.getAttribute('data-href');
            if (!path)
                return;
            this.app.workspace.trigger('hover-link', {
                event: evt,
                source: 'monthly-tracker',
                hoverParent: rendered,
                targetEl: link,
                linktext: path,
                sourcePath: ctx.sourcePath,
            });
        });
        el.appendChild(rendered);
    }
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }
    async saveSettings() {
        await this.saveData(this.settings);
    }
}

module.exports = MonthlyTrackerPlugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsic3JjL3R5cGVzLnRzIiwic3JjL2kxOG4udHMiLCJzcmMvc2V0dGluZ3MudHMiLCJzcmMvcHJlc2V0cy50cyIsInNyYy9yZW5kZXJlci50cyIsInNyYy9tYWluLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBpbnRlcmZhY2UgQm9vbGVhbkNvbmZpZyB7XG4gIHR5cGU6ICdib29sZWFuJztcbiAgdGl0bGU/OiBzdHJpbmc7XG4gIHByb3BlcnR5Pzogc3RyaW5nO1xuICBzb3VyY2U/OiBzdHJpbmc7XG4gIC8qKiBoZXggY29sb3Igc3RyaW5nIG9yIHByZXNldCBuYW1lIChlLmcuIFwiYmx1ZVwiKSAqL1xuICBjb2xvcjogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIENvbG9ybWFwQ29uZmlnIHtcbiAgdHlwZTogJ2NvbG9ybWFwJztcbiAgdGl0bGU/OiBzdHJpbmc7XG4gIHByb3BlcnR5OiBzdHJpbmc7XG4gIHNvdXJjZT86IHN0cmluZztcbiAgY29sb3JzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEhlYXRtYXBDb25maWcge1xuICB0eXBlOiAnaGVhdG1hcCc7XG4gIHRpdGxlPzogc3RyaW5nO1xuICBwcm9wZXJ0eTogc3RyaW5nO1xuICBzb3VyY2U/OiBzdHJpbmc7XG4gIHVuaXQ/OiBzdHJpbmc7XG4gIC8qKlxuICAgKiBUaHJlc2hvbGRzIHNlcGFyYXRpbmcgaW50ZW5zaXR5IGxldmVscy5cbiAgICogZS5nLiBbMywgNSwgNywgMTBdIOKGkiA1IGJ1Y2tldHM6IFswLDMpLCBbMyw1KSwgWzUsNyksIFs3LDEwKSwgWzEwLOKInilcbiAgICovXG4gIGJpbnM/OiBudW1iZXJbXTtcbiAgLyoqIGFycmF5IG9mIGhleCBjb2xvcnMsIGxlbmd0aCA9IGJpbnMubGVuZ3RoICsgMSwgb3Igb21pdCBhbmQgdXNlIGNvbG9yU2NoZW1lICovXG4gIGNvbG9ycz86IHN0cmluZ1tdO1xuICAvKiogYnVpbHQtaW4gaGVhdG1hcCBjb2xvciBzY2hlbWUgbmFtZSAoZS5nLiBcImluZGlnb1wiKSAqL1xuICBjb2xvclNjaGVtZT86IHN0cmluZztcbiAgc2hvd1RvdGFsPzogYm9vbGVhbjtcbiAgLyoqIGxhYmVsIHNob3duIG5leHQgdG8gdG90YWwsIGRlZmF1bHRzIHRvIHByb3BlcnR5IG5hbWUgKi9cbiAgdG90YWxMYWJlbD86IHN0cmluZztcbn1cblxuZXhwb3J0IHR5cGUgVHJhY2tlckNvbmZpZyA9IEJvb2xlYW5Db25maWcgfCBDb2xvcm1hcENvbmZpZyB8IEhlYXRtYXBDb25maWc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGx1Z2luU2V0dGluZ3Mge1xuICBkYWlseU5vdGVzRm9sZGVyOiBzdHJpbmc7XG4gIGRhdGVGb3JtYXQ6IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IERFRkFVTFRfU0VUVElOR1M6IFBsdWdpblNldHRpbmdzID0ge1xuICBkYWlseU5vdGVzRm9sZGVyOiAnJyxcbiAgZGF0ZUZvcm1hdDogJ1lZWVktTU0tREQnLFxufTtcbiIsInR5cGUgTG9jYWxlID0gJ2VuJyB8ICdrbyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTWVzc2FnZXMge1xuICBlcnJvclByZWZpeDogc3RyaW5nO1xuICBlcnJNaXNzaW5nVHlwZTogc3RyaW5nO1xuICBlcnJNaXNzaW5nUHJvcGVydHk6IHN0cmluZztcbiAgZXJyTWlzc2luZ0NvbG9yczogc3RyaW5nO1xuICBlcnJDYW5ub3RSZXNvbHZlRmlsZTogc3RyaW5nO1xuICBlcnJNaXNzaW5nWWVhck1vbnRoOiBzdHJpbmc7XG4gIGVyclllYXJNb250aFR5cGU6IHN0cmluZztcbiAgZXJySW52YWxpZE1vbnRoOiAobW9udGg6IG51bWJlcikgPT4gc3RyaW5nO1xuICBlcnJIZWF0bWFwQmluczogc3RyaW5nO1xuICBlcnJCaW5zUG9zaXRpdmU6ICh2YWx1ZTogbnVtYmVyKSA9PiBzdHJpbmc7XG4gIGVyckJpbnNBc2NlbmRpbmc6IChwcmV2OiBudW1iZXIsIG5leHQ6IG51bWJlcikgPT4gc3RyaW5nO1xuICB0b29sdGlwWWVzOiBzdHJpbmc7XG4gIHRvdGFsTGFiZWw6IHN0cmluZztcbiAgc2V0dGluZ3NGb2xkZXJOYW1lOiBzdHJpbmc7XG4gIHNldHRpbmdzRm9sZGVyRGVzYzogc3RyaW5nO1xuICBzZXR0aW5nc0RhdGVGb3JtYXROYW1lOiBzdHJpbmc7XG4gIHNldHRpbmdzRGF0ZUZvcm1hdERlc2M6IHN0cmluZztcbn1cblxuY29uc3QgZW46IE1lc3NhZ2VzID0ge1xuICBlcnJvclByZWZpeDogJ01vbnRobHkgVHJhY2tlciBFcnJvcicsXG4gIGVyck1pc3NpbmdUeXBlOiAnTWlzc2luZyByZXF1aXJlZCBmaWVsZDogdHlwZSAoYm9vbGVhbiB8IGNvbG9ybWFwIHwgaGVhdG1hcCknLFxuICBlcnJNaXNzaW5nUHJvcGVydHk6ICdNaXNzaW5nIHJlcXVpcmVkIGZpZWxkOiBwcm9wZXJ0eScsXG4gIGVyck1pc3NpbmdDb2xvcnM6ICdNaXNzaW5nIHJlcXVpcmVkIGZpZWxkOiBjb2xvcnMgKGUuZy4gY29sb3JzOiB7dmFsdWU6IFwiI2hleFwifSknLFxuICBlcnJDYW5ub3RSZXNvbHZlRmlsZTogJ0Nhbm5vdCByZXNvbHZlIGN1cnJlbnQgZmlsZScsXG4gIGVyck1pc3NpbmdZZWFyTW9udGg6IFwiQ3VycmVudCBub3RlIG11c3QgaGF2ZSAneWVhcicgYW5kICdtb250aCcgaW4gZnJvbnRtYXR0ZXJcIixcbiAgZXJyWWVhck1vbnRoVHlwZTogXCIneWVhcicgYW5kICdtb250aCcgbXVzdCBiZSBudW1iZXJzIGluIGZyb250bWF0dGVyXCIsXG4gIGVyckludmFsaWRNb250aDogKG1vbnRoKSA9PiBgSW52YWxpZCBtb250aDogJHttb250aH0gKG11c3QgYmUgMeKAkzEyKWAsXG4gIGVyckhlYXRtYXBCaW5zOiAnaGVhdG1hcCByZXF1aXJlcyBcImJpbnNcIiAoZS5nLiBiaW5zOiBbMywgNSwgNywgMTBdKScsXG4gIGVyckJpbnNQb3NpdGl2ZTogKHZhbHVlKSA9PiBgYmlucyB2YWx1ZXMgbXVzdCBiZSBwb3NpdGl2ZSAoZ290ICR7dmFsdWV9KWAsXG4gIGVyckJpbnNBc2NlbmRpbmc6IChwcmV2LCBuZXh0KSA9PiBgYmlucyBtdXN0IGJlIGluIGFzY2VuZGluZyBvcmRlciAoZ290ICR7cHJldn0sICR7bmV4dH0pYCxcbiAgdG9vbHRpcFllczogJ1llcycsXG4gIHRvdGFsTGFiZWw6ICdUb3RhbCcsXG4gIHNldHRpbmdzRm9sZGVyTmFtZTogJ0RhaWx5IG5vdGVzIGZvbGRlcicsXG4gIHNldHRpbmdzRm9sZGVyRGVzYzogJ0ZvbGRlciBjb250YWluaW5nIGRhaWx5IG5vdGVzIChlLmcuIENhbGVuZGFyL0RheXMpJyxcbiAgc2V0dGluZ3NEYXRlRm9ybWF0TmFtZTogJ0RhdGUgZm9ybWF0JyxcbiAgc2V0dGluZ3NEYXRlRm9ybWF0RGVzYzogJ0ZpbGUgbmFtZSBkYXRlIGZvcm1hdC4gTXVzdCBtYXRjaCBZWVlZLU1NLUREIGF0IHRoZSBzdGFydCBvZiBmaWxlIG5hbWVzLicsXG59O1xuXG5jb25zdCBrbzogTWVzc2FnZXMgPSB7XG4gIGVycm9yUHJlZml4OiAnTW9udGhseSBUcmFja2VyIOyYpOulmCcsXG4gIGVyck1pc3NpbmdUeXBlOiAn7ZWE7IiYIO2VreuqqSDriITrnb06IHR5cGUgKGJvb2xlYW4gfCBjb2xvcm1hcCB8IGhlYXRtYXApJyxcbiAgZXJyTWlzc2luZ1Byb3BlcnR5OiAn7ZWE7IiYIO2VreuqqSDriITrnb06IHByb3BlcnR5JyxcbiAgZXJyTWlzc2luZ0NvbG9yczogJ+2VhOyImCDtla3rqqkg64iE6529OiBjb2xvcnMgKOyYiDogY29sb3JzOiB7dmFsdWU6IFwiI2hleFwifSknLFxuICBlcnJDYW5ub3RSZXNvbHZlRmlsZTogJ+2YhOyerCDtjIzsnbzsnYQg7LC+7J2EIOyImCDsl4bsirXri4jri6QnLFxuICBlcnJNaXNzaW5nWWVhck1vbnRoOiBcIu2YhOyerCDrhbjtirjsnZgg7ZSE66Gg7Yq466ek7YSw7JeQICd5ZWFyJ+yZgCAnbW9udGgn6rCAIOyeiOyWtOyVvCDtlanri4jri6RcIixcbiAgZXJyWWVhck1vbnRoVHlwZTogXCLtlITroaDtirjrp6TthLDsnZggJ3llYXIn7JmAICdtb250aCfripQg7Iir7J6Q7Jes7JW8IO2VqeuLiOuLpFwiLFxuICBlcnJJbnZhbGlkTW9udGg6IChtb250aCkgPT4gYOyemOuqu+uQnCBtb250aDogJHttb250aH0gKDHigJMxMiDsgqzsnbTsl6zslbwg7ZWp64uI64ukKWAsXG4gIGVyckhlYXRtYXBCaW5zOiAnaGVhdG1hcOyXkOuKlCBcImJpbnNcIuqwgCDtlYTsmpTtlanri4jri6QgKOyYiDogYmluczogWzMsIDUsIDcsIDEwXSknLFxuICBlcnJCaW5zUG9zaXRpdmU6ICh2YWx1ZSkgPT4gYGJpbnMg6rCS7J2AIOyWkeyImOyXrOyVvCDtlanri4jri6QgKOyeheugpeqwkjogJHt2YWx1ZX0pYCxcbiAgZXJyQmluc0FzY2VuZGluZzogKHByZXYsIG5leHQpID0+IGBiaW5z64qUIOyYpOumhOywqOyInOydtOyWtOyVvCDtlanri4jri6QgKOyeheugpeqwkjogJHtwcmV2fSwgJHtuZXh0fSlgLFxuICB0b29sdGlwWWVzOiAn7JmE66OMJyxcbiAgdG90YWxMYWJlbDogJ+2VqeqzhCcsXG4gIHNldHRpbmdzRm9sZGVyTmFtZTogJ+uNsOydvOumrCDrhbjtirgg7Y+0642UJyxcbiAgc2V0dGluZ3NGb2xkZXJEZXNjOiAn642w7J2866asIOuFuO2KuOqwgCDrk6TslrQg7J6I64qUIO2PtOuNlCAo7JiIOiBDYWxlbmRhci9EYXlzKScsXG4gIHNldHRpbmdzRGF0ZUZvcm1hdE5hbWU6ICfrgqDsp5wg7ZiV7IudJyxcbiAgc2V0dGluZ3NEYXRlRm9ybWF0RGVzYzogJ+2MjOydvCDsnbTrpoTsnZgg64Kg7KecIO2YleyLnS4g7YyM7J28IOydtOumhCDslZ7rtoDrtoTsnbQgWVlZWS1NTS1EROyZgCDsnbzsuZjtlbTslbwg7ZWp64uI64ukLicsXG59O1xuXG5mdW5jdGlvbiBjdXJyZW50TG9jYWxlKCk6IExvY2FsZSB7XG4gIGNvbnN0IGxhbmcgPSB3aW5kb3cubG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2xhbmd1YWdlJyk7XG4gIHJldHVybiBsYW5nID09PSAna28nID8gJ2tvJyA6ICdlbic7XG59XG5cbi8qKiBSZXR1cm5zIHRoZSBtZXNzYWdlIHRhYmxlIGZvciB0aGUgY3VycmVudCBPYnNpZGlhbiBVSSBsYW5ndWFnZS4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0KCk6IE1lc3NhZ2VzIHtcbiAgcmV0dXJuIGN1cnJlbnRMb2NhbGUoKSA9PT0gJ2tvJyA/IGtvIDogZW47XG59XG4iLCJpbXBvcnQgeyBBcHAsIFBsdWdpblNldHRpbmdUYWIsIFNldHRpbmcgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgdHlwZSBNb250aGx5VHJhY2tlclBsdWdpbiBmcm9tICcuL21haW4nO1xuaW1wb3J0IHsgdCB9IGZyb20gJy4vaTE4bic7XG5cbmV4cG9ydCBjbGFzcyBNb250aGx5VHJhY2tlclNldHRpbmdUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcbiAgcGx1Z2luOiBNb250aGx5VHJhY2tlclBsdWdpbjtcblxuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBNb250aGx5VHJhY2tlclBsdWdpbikge1xuICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcbiAgfVxuXG4gIGRpc3BsYXkoKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250YWluZXJFbCB9ID0gdGhpcztcbiAgICBjb25zdCBtID0gdCgpO1xuICAgIGNvbnRhaW5lckVsLmVtcHR5KCk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKG0uc2V0dGluZ3NGb2xkZXJOYW1lKVxuICAgICAgLnNldERlc2MobS5zZXR0aW5nc0ZvbGRlckRlc2MpXG4gICAgICAuYWRkVGV4dCh0ZXh0ID0+XG4gICAgICAgIHRleHRcbiAgICAgICAgICAuc2V0UGxhY2Vob2xkZXIoJ0NhbGVuZGFyL0RheXMnKVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5kYWlseU5vdGVzRm9sZGVyKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmRhaWx5Tm90ZXNGb2xkZXIgPSB2YWx1ZS50cmltKCk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KSxcbiAgICAgICk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKG0uc2V0dGluZ3NEYXRlRm9ybWF0TmFtZSlcbiAgICAgIC5zZXREZXNjKG0uc2V0dGluZ3NEYXRlRm9ybWF0RGVzYylcbiAgICAgIC5hZGRUZXh0KHRleHQgPT5cbiAgICAgICAgdGV4dFxuICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcignWVlZWS1NTS1ERCcpXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmRhdGVGb3JtYXQpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZGF0ZUZvcm1hdCA9IHZhbHVlLnRyaW0oKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIH0pLFxuICAgICAgKTtcbiAgfVxufVxuIiwiLyoqIFNpbmdsZS1jb2xvciBwcmVzZXRzIGZvciBib29sZWFuIHRyYWNrZXIgKi9cbmV4cG9ydCBjb25zdCBDT0xPUl9QUkVTRVRTOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICBibHVlOiAnIzY0YjVmNicsXG4gIGdyZWVuOiAnIzY2YmI2YScsXG4gIHJlZDogJyNlNTczNzMnLFxuICBwdXJwbGU6ICcjYmE2OGM4JyxcbiAgb3JhbmdlOiAnI2ZmYjc0ZCcsXG4gIHllbGxvdzogJyNmZmQ1NGYnLFxuICB0ZWFsOiAnIzRkYjZhYycsXG4gIGluZGlnbzogJyM3OTg2Y2InLFxuICBwaW5rOiAnI2YwNjI5MicsXG59O1xuXG4vKipcbiAqIEhlYXRtYXAgY29sb3Itc2NoZW1lIHByZXNldHMuXG4gKiBJbmRleCAwID0gbm8gZGF0YSwgaW5kZXggMS4ubiA9IGluY3JlYXNpbmcgaW50ZW5zaXR5LlxuICovXG5leHBvcnQgY29uc3QgSEVBVE1BUF9TQ0hFTUVTOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmdbXT4gPSB7XG4gIGJsdWU6IFsnI2ViZWRmMCcsICcjYmJkZWZiJywgJyM5MGNhZjknLCAnIzY0YjVmNicsICcjNDJhNWY1JywgJyMxZTg4ZTUnXSxcbiAgZ3JlZW46IFsnI2ViZWRmMCcsICcjYzhlNmM5JywgJyNhNWQ2YTcnLCAnIzgxYzc4NCcsICcjNjZiYjZhJywgJyM0M2EwNDcnXSxcbiAgcmVkOiBbJyNlYmVkZjAnLCAnI2ZmY2RkMicsICcjZWY5YTlhJywgJyNlNTczNzMnLCAnI2VmNTM1MCcsICcjZTUzOTM1J10sXG4gIHB1cnBsZTogWycjZWJlZGYwJywgJyNlMWJlZTcnLCAnI2NlOTNkOCcsICcjYmE2OGM4JywgJyNhYjQ3YmMnLCAnIzhlMjRhYSddLFxuICBvcmFuZ2U6IFsnI2ViZWRmMCcsICcjZmZlMGIyJywgJyNmZmNjODAnLCAnI2ZmYjc0ZCcsICcjZmZhNzI2JywgJyNmYjhjMDAnXSxcbiAgeWVsbG93OiBbJyNlYmVkZjAnLCAnI2ZmZjljNCcsICcjZmZmNTlkJywgJyNmZmYxNzYnLCAnI2ZmZWU1OCcsICcjZmRkODM1J10sXG4gIHRlYWw6IFsnI2ViZWRmMCcsICcjYjJkZmRiJywgJyM4MGNiYzQnLCAnIzRkYjZhYycsICcjMjZhNjlhJywgJyMwMDg5N2InXSxcbiAgaW5kaWdvOiBbJyNlYmVkZjAnLCAnI2U4ZWFmNicsICcjYzVjYWU5JywgJyM5ZmE4ZGEnLCAnIzc5ODZjYicsICcjNWM2YmMwJ10sXG4gIHBpbms6IFsnI2ViZWRmMCcsICcjZmNlNGVjJywgJyNmNDhmYjEnLCAnI2YwNjI5MicsICcjZWM0MDdhJywgJyNkODFiNjAnXSxcbn07XG5cbi8qKiBSZXNvbHZlIGEgY29sb3Igc3RyaW5nOiBpZiBpdCdzIGEga25vd24gcHJlc2V0IG5hbWUsIHJldHVybiB0aGUgaGV4OyBvdGhlcndpc2UgcmV0dXJuIGFzLWlzLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVDb2xvcihjb2xvcj86IHN0cmluZyk6IHN0cmluZyB7XG4gIGlmICghY29sb3IpIHJldHVybiBDT0xPUl9QUkVTRVRTLmJsdWU7XG4gIHJldHVybiBDT0xPUl9QUkVTRVRTW2NvbG9yLnRvTG93ZXJDYXNlKCldID8/IGNvbG9yO1xufVxuXG4vKiogUmVzb2x2ZSBoZWF0bWFwIGNvbG9ycyBhcnJheSBmcm9tIGNvbG9yU2NoZW1lIHByZXNldCBvciBleHBsaWNpdCBjb2xvcnMgYXJyYXkuICovXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZUhlYXRtYXBDb2xvcnMoY29sb3JzPzogc3RyaW5nW10sIGNvbG9yU2NoZW1lPzogc3RyaW5nKTogc3RyaW5nW10ge1xuICBpZiAoY29sb3JzICYmIGNvbG9ycy5sZW5ndGggPiAwKSByZXR1cm4gY29sb3JzO1xuICBpZiAoY29sb3JTY2hlbWUpIHtcbiAgICBjb25zdCBzY2hlbWUgPSBIRUFUTUFQX1NDSEVNRVNbY29sb3JTY2hlbWUudG9Mb3dlckNhc2UoKV07XG4gICAgaWYgKHNjaGVtZSkgcmV0dXJuIHNjaGVtZTtcbiAgfVxuICByZXR1cm4gSEVBVE1BUF9TQ0hFTUVTWydpbmRpZ28nXTtcbn1cblxuIiwiaW1wb3J0IHsgVHJhY2tlckNvbmZpZywgQm9vbGVhbkNvbmZpZywgQ29sb3JtYXBDb25maWcsIEhlYXRtYXBDb25maWcgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IHJlc29sdmVDb2xvciwgcmVzb2x2ZUhlYXRtYXBDb2xvcnMgfSBmcm9tICcuL3ByZXNldHMnO1xuaW1wb3J0IHsgdCB9IGZyb20gJy4vaTE4bic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRGF5RGF0YSB7XG4gIGRheTogbnVtYmVyO1xuICB2YWx1ZTogdW5rbm93bjtcbiAgZmlsZVBhdGg/OiBzdHJpbmc7XG59XG5cbi8qKlxuICogQnVpbGQgYSBzaW5nbGUgZGF5IGNlbGwuXG4gKiBAcGFyYW0gYmdDb2xvciBpbmxpbmUgYmFja2dyb3VuZCBjb2xvciBmb3IgYWN0aXZlIGNlbGxzOyBudWxsIGxldHMgdGhlIHRoZW1lXG4gKiAgIChgLmlzLWVtcHR5YCkgc3R5bGUgZW1wdHkgY2VsbHMgc28gZGFyayBtb2RlIGlzIHJlc3BlY3RlZC5cbiAqL1xuZnVuY3Rpb24gZGF5Q2VsbChcbiAgZGF5OiBudW1iZXIsXG4gIGJnQ29sb3I6IHN0cmluZyB8IG51bGwsXG4gIGFjdGl2ZTogYm9vbGVhbixcbiAgZmlsZVBhdGg6IHN0cmluZyB8IHVuZGVmaW5lZCxcbiAgdG9vbHRpcDogc3RyaW5nLFxuKTogSFRNTEVsZW1lbnQge1xuICBjb25zdCBlbDogSFRNTEVsZW1lbnQgPSBmaWxlUGF0aFxuICAgID8gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpXG4gICAgOiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblxuICBlbC5jbGFzc0xpc3QuYWRkKCdtb250aGx5LXRyYWNrZXItY2VsbCcsIGFjdGl2ZSA/ICdpcy1hY3RpdmUnIDogJ2lzLWVtcHR5Jyk7XG4gIGlmIChiZ0NvbG9yKSBlbC5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBiZ0NvbG9yO1xuXG4gIGlmIChmaWxlUGF0aCkge1xuICAgIGNvbnN0IGFuY2hvciA9IGVsIGFzIEhUTUxBbmNob3JFbGVtZW50O1xuICAgIGFuY2hvci5jbGFzc0xpc3QuYWRkKCdpbnRlcm5hbC1saW5rJyk7XG4gICAgYW5jaG9yLnNldEF0dHJpYnV0ZSgnaHJlZicsIGZpbGVQYXRoKTtcbiAgICBhbmNob3IuZGF0YXNldC5ocmVmID0gZmlsZVBhdGg7XG4gIH1cblxuICBlbC50aXRsZSA9IHRvb2x0aXA7XG4gIGVsLnRleHRDb250ZW50ID0gU3RyaW5nKGRheSk7XG4gIHJldHVybiBlbDtcbn1cblxuZnVuY3Rpb24gd3JhcEdyaWQoY2VsbHM6IEhUTUxFbGVtZW50W10pOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IHJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICByb3cuY2xhc3NMaXN0LmFkZCgnbW9udGhseS10cmFja2VyLXJvdycpO1xuICBmb3IgKGNvbnN0IGNlbGwgb2YgY2VsbHMpIHJvdy5hcHBlbmRDaGlsZChjZWxsKTtcbiAgcmV0dXJuIHJvdztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlckJvb2xlYW4oY29uZmlnOiBCb29sZWFuQ29uZmlnLCBkYXRhOiBNYXA8bnVtYmVyLCBEYXlEYXRhPiwgZGF5c0luTW9udGg6IG51bWJlcik6IEhUTUxFbGVtZW50IHtcbiAgY29uc3QgYWN0aXZlQ29sb3IgPSByZXNvbHZlQ29sb3IoY29uZmlnLmNvbG9yKTtcbiAgY29uc3QgY2VsbHM6IEhUTUxFbGVtZW50W10gPSBbXTtcblxuICBmb3IgKGxldCBkYXkgPSAxOyBkYXkgPD0gZGF5c0luTW9udGg7IGRheSsrKSB7XG4gICAgY29uc3QgZW50cnkgPSBkYXRhLmdldChkYXkpO1xuICAgIGNvbnN0IGFjdGl2ZSA9IGVudHJ5ICE9PSB1bmRlZmluZWQgJiYgISFlbnRyeS52YWx1ZTtcbiAgICBjZWxscy5wdXNoKGRheUNlbGwoZGF5LCBhY3RpdmUgPyBhY3RpdmVDb2xvciA6IG51bGwsIGFjdGl2ZSwgZW50cnk/LmZpbGVQYXRoLCBhY3RpdmUgPyB0KCkudG9vbHRpcFllcyA6ICcnKSk7XG4gIH1cblxuICByZXR1cm4gd3JhcEdyaWQoY2VsbHMpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyQ29sb3JtYXAoY29uZmlnOiBDb2xvcm1hcENvbmZpZywgZGF0YTogTWFwPG51bWJlciwgRGF5RGF0YT4sIGRheXNJbk1vbnRoOiBudW1iZXIpOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IGNvbG9yTWFwID0gY29uZmlnLmNvbG9ycztcbiAgY29uc3QgY2VsbHM6IEhUTUxFbGVtZW50W10gPSBbXTtcblxuICBmb3IgKGxldCBkYXkgPSAxOyBkYXkgPD0gZGF5c0luTW9udGg7IGRheSsrKSB7XG4gICAgY29uc3QgZW50cnkgPSBkYXRhLmdldChkYXkpO1xuICAgIGNvbnN0IGtleSA9IGVudHJ5Py52YWx1ZSAhPSBudWxsID8gU3RyaW5nKGVudHJ5LnZhbHVlKSA6IHVuZGVmaW5lZDtcbiAgICBjb25zdCBtYXBwZWRDb2xvciA9IGtleSAhPSBudWxsID8gY29sb3JNYXBba2V5XSA6IHVuZGVmaW5lZDtcbiAgICBjZWxscy5wdXNoKGRheUNlbGwoZGF5LCBtYXBwZWRDb2xvciA/PyBudWxsLCAhIW1hcHBlZENvbG9yLCBlbnRyeT8uZmlsZVBhdGgsIGtleSA/PyAnJykpO1xuICB9XG5cbiAgcmV0dXJuIHdyYXBHcmlkKGNlbGxzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlckhlYXRtYXAoY29uZmlnOiBIZWF0bWFwQ29uZmlnLCBkYXRhOiBNYXA8bnVtYmVyLCBEYXlEYXRhPiwgZGF5c0luTW9udGg6IG51bWJlcik6IEhUTUxFbGVtZW50IHtcbiAgY29uc3QgY29sb3JzID0gcmVzb2x2ZUhlYXRtYXBDb2xvcnMoY29uZmlnLmNvbG9ycywgY29uZmlnLmNvbG9yU2NoZW1lKTtcbiAgLy8gYmlucyBhcmUgdmFsaWRhdGVkIHVwc3RyZWFtIGluIHByb2Nlc3NCbG9jazsgbm9uLW51bGwgYXNzZXJ0aW9uIGlzIHNhZmUgaGVyZS5cbiAgY29uc3QgYmlucyA9IGNvbmZpZy5iaW5zITtcbiAgY29uc3QgdW5pdCA9IGNvbmZpZy51bml0ID8/ICcnO1xuXG4gIGZ1bmN0aW9uIGdldEludGVuc2l0eSh2YWw6IG51bWJlcik6IG51bWJlciB7XG4gICAgaWYgKHZhbCA8PSAwKSByZXR1cm4gMDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGJpbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmICh2YWwgPCBiaW5zW2ldKSByZXR1cm4gaSArIDE7XG4gICAgfVxuICAgIHJldHVybiBiaW5zLmxlbmd0aCArIDE7XG4gIH1cblxuICBjb25zdCBtYXhJbnRlbnNpdHkgPSBiaW5zLmxlbmd0aCArIDE7XG4gIGNvbnN0IHNhZmVDb2xvcnMgPSBjb2xvcnMubGVuZ3RoID49IG1heEludGVuc2l0eSArIDEgPyBjb2xvcnMgOiBbXG4gICAgLi4uY29sb3JzLFxuICAgIC4uLkFycmF5KG1heEludGVuc2l0eSArIDEgLSBjb2xvcnMubGVuZ3RoKS5maWxsKGNvbG9yc1tjb2xvcnMubGVuZ3RoIC0gMV0gPz8gJycpLFxuICBdO1xuXG4gIGxldCB0b3RhbCA9IDA7XG4gIGNvbnN0IGNlbGxzOiBIVE1MRWxlbWVudFtdID0gW107XG5cbiAgZm9yIChsZXQgZGF5ID0gMTsgZGF5IDw9IGRheXNJbk1vbnRoOyBkYXkrKykge1xuICAgIGNvbnN0IGVudHJ5ID0gZGF0YS5nZXQoZGF5KTtcbiAgICBjb25zdCByYXcgPSBlbnRyeT8udmFsdWU7XG4gICAgY29uc3QgdmFsID0gdHlwZW9mIHJhdyA9PT0gJ251bWJlcicgJiYgaXNGaW5pdGUocmF3KSA/IHJhdyA6IDA7XG4gICAgdG90YWwgKz0gdmFsO1xuICAgIGNvbnN0IGludGVuc2l0eSA9IGdldEludGVuc2l0eSh2YWwpO1xuICAgIGNvbnN0IGFjdGl2ZSA9IGludGVuc2l0eSA+IDA7XG4gICAgY29uc3QgYmdDb2xvciA9IGFjdGl2ZSA/IChzYWZlQ29sb3JzW2ludGVuc2l0eV0gfHwgbnVsbCkgOiBudWxsO1xuICAgIGNlbGxzLnB1c2goZGF5Q2VsbChkYXksIGJnQ29sb3IsIGFjdGl2ZSwgZW50cnk/LmZpbGVQYXRoLCB2YWwgPiAwID8gYCR7dmFsfSR7dW5pdH1gIDogJycpKTtcbiAgfVxuXG4gIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXG4gIGlmIChjb25maWcuc2hvd1RvdGFsKSB7XG4gICAgY29uc3QgbGFiZWwgPSBjb25maWcudG90YWxMYWJlbCA/PyB0KCkudG90YWxMYWJlbDtcbiAgICBjb25zdCBzdW1tYXJ5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgc3VtbWFyeS5jbGFzc0xpc3QuYWRkKCdtb250aGx5LXRyYWNrZXItc3VtbWFyeScpO1xuICAgIHN1bW1hcnkudGV4dENvbnRlbnQgPSBgJHtsYWJlbH06IGA7XG4gICAgY29uc3QgdmFsdWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gICAgdmFsdWUuY2xhc3NMaXN0LmFkZCgnbW9udGhseS10cmFja2VyLXN1bW1hcnktdmFsdWUnKTtcbiAgICBjb25zdCBkaXNwbGF5VG90YWwgPSBOdW1iZXIuaXNJbnRlZ2VyKHRvdGFsKSA/IFN0cmluZyh0b3RhbCkgOiB0b3RhbC50b0ZpeGVkKDEpO1xuICAgIHZhbHVlLnRleHRDb250ZW50ID0gYCR7ZGlzcGxheVRvdGFsfSR7dW5pdH1gO1xuICAgIHN1bW1hcnkuYXBwZW5kQ2hpbGQodmFsdWUpO1xuICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZChzdW1tYXJ5KTtcbiAgfVxuXG4gIGNvbnRhaW5lci5hcHBlbmRDaGlsZCh3cmFwR3JpZChjZWxscykpO1xuICByZXR1cm4gY29udGFpbmVyO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyVHJhY2tlcihcbiAgY29uZmlnOiBUcmFja2VyQ29uZmlnLFxuICBkYXRhOiBNYXA8bnVtYmVyLCBEYXlEYXRhPixcbiAgZGF5c0luTW9udGg6IG51bWJlcixcbik6IEhUTUxFbGVtZW50IHtcbiAgY29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIGNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdtb250aGx5LXRyYWNrZXInKTtcblxuICBsZXQgaW5uZXI6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG4gIGlmIChjb25maWcudHlwZSA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgaW5uZXIgPSByZW5kZXJCb29sZWFuKGNvbmZpZywgZGF0YSwgZGF5c0luTW9udGgpO1xuICB9IGVsc2UgaWYgKGNvbmZpZy50eXBlID09PSAnY29sb3JtYXAnKSB7XG4gICAgaW5uZXIgPSByZW5kZXJDb2xvcm1hcChjb25maWcsIGRhdGEsIGRheXNJbk1vbnRoKTtcbiAgfSBlbHNlIGlmIChjb25maWcudHlwZSA9PT0gJ2hlYXRtYXAnKSB7XG4gICAgaW5uZXIgPSByZW5kZXJIZWF0bWFwKGNvbmZpZywgZGF0YSwgZGF5c0luTW9udGgpO1xuICB9XG5cbiAgaWYgKGlubmVyKSBjb250YWluZXIuYXBwZW5kQ2hpbGQoaW5uZXIpO1xuICByZXR1cm4gY29udGFpbmVyO1xufVxuIiwiaW1wb3J0IHsgQXBwLCBQbHVnaW4sIE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQsIFRGaWxlLCBURm9sZGVyLCBwYXJzZVlhbWwgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBQbHVnaW5TZXR0aW5ncywgREVGQVVMVF9TRVRUSU5HUywgVHJhY2tlckNvbmZpZyB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgTW9udGhseVRyYWNrZXJTZXR0aW5nVGFiIH0gZnJvbSAnLi9zZXR0aW5ncyc7XG5pbXBvcnQgeyByZW5kZXJUcmFja2VyLCBEYXlEYXRhIH0gZnJvbSAnLi9yZW5kZXJlcic7XG5pbXBvcnQgeyB0IH0gZnJvbSAnLi9pMThuJztcblxuZnVuY3Rpb24gYnVpbGREYXRlUGF0dGVybihkYXRlRm9ybWF0OiBzdHJpbmcsIHllYXI6IG51bWJlciwgbW9udGg6IG51bWJlcik6IFJlZ0V4cCB7XG4gIGNvbnN0IG1tID0gU3RyaW5nKG1vbnRoKS5wYWRTdGFydCgyLCAnMCcpO1xuICBjb25zdCBlc2NhcGVkID0gZGF0ZUZvcm1hdFxuICAgIC5yZXBsYWNlKCdZWVlZJywgJ1xceDAwWVxceDAwJylcbiAgICAucmVwbGFjZSgnTU0nLCAnXFx4MDBNXFx4MDAnKVxuICAgIC5yZXBsYWNlKCdERCcsICdcXHgwMERcXHgwMCcpXG4gICAgLnJlcGxhY2UoL1suKis/XiR7fSgpfFtcXF1cXFxcXS9nLCAnXFxcXCQmJylcbiAgICAucmVwbGFjZSgnXFx4MDBZXFx4MDAnLCBTdHJpbmcoeWVhcikpXG4gICAgLnJlcGxhY2UoJ1xceDAwTVxceDAwJywgbW0pXG4gICAgLnJlcGxhY2UoJ1xceDAwRFxceDAwJywgJyhcXFxcZHsyfSknKTtcbiAgcmV0dXJuIG5ldyBSZWdFeHAoYF4ke2VzY2FwZWR9YCk7XG59XG5cbmZ1bmN0aW9uIGRldGVjdERhaWx5Tm90ZXNGb2xkZXIoYXBwOiBBcHApOiBzdHJpbmcge1xuICBjb25zdCBpbnRlcm5hbCA9IChhcHAgYXMgYW55KS5pbnRlcm5hbFBsdWdpbnM/LnBsdWdpbnM/LlsnZGFpbHktbm90ZXMnXT8uaW5zdGFuY2U/Lm9wdGlvbnM/LmZvbGRlcjtcbiAgaWYgKGludGVybmFsKSByZXR1cm4gaW50ZXJuYWw7XG4gIGNvbnN0IHBlcmlvZGljID0gKGFwcCBhcyBhbnkpLnBsdWdpbnM/LnBsdWdpbnM/LlsncGVyaW9kaWMtbm90ZXMnXT8uc2V0dGluZ3M/LmRhaWx5Py5mb2xkZXI7XG4gIGlmIChwZXJpb2RpYykgcmV0dXJuIHBlcmlvZGljO1xuICByZXR1cm4gJyc7XG59XG5cbi8qKiBWYWxpZGF0ZSBjb25maWctbGV2ZWwgaW52YXJpYW50cyB1cCBmcm9udCBzbyByZW5kZXJlcnMgY2FuIGFzc3VtZSB2YWxpZCBpbnB1dC4gKi9cbmZ1bmN0aW9uIHZhbGlkYXRlQ29uZmlnKGNvbmZpZzogVHJhY2tlckNvbmZpZyk6IHZvaWQge1xuICBjb25zdCBtID0gdCgpO1xuICBpZiAoIWNvbmZpZz8udHlwZSkge1xuICAgIHRocm93IG5ldyBFcnJvcihtLmVyck1pc3NpbmdUeXBlKTtcbiAgfVxuICBpZiAoIWNvbmZpZy5wcm9wZXJ0eSAmJiBjb25maWcudHlwZSAhPT0gJ2Jvb2xlYW4nKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKG0uZXJyTWlzc2luZ1Byb3BlcnR5KTtcbiAgfVxuICBpZiAoY29uZmlnLnR5cGUgPT09ICdjb2xvcm1hcCcgJiYgIWNvbmZpZy5jb2xvcnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IobS5lcnJNaXNzaW5nQ29sb3JzKTtcbiAgfVxuICBpZiAoY29uZmlnLnR5cGUgPT09ICdoZWF0bWFwJykge1xuICAgIGNvbnN0IGJpbnMgPSBjb25maWcuYmlucztcbiAgICBpZiAoIWJpbnMgfHwgYmlucy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihtLmVyckhlYXRtYXBCaW5zKTtcbiAgICB9XG4gICAgaWYgKGJpbnNbMF0gPD0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKG0uZXJyQmluc1Bvc2l0aXZlKGJpbnNbMF0pKTtcbiAgICB9XG4gICAgZm9yIChsZXQgaSA9IDE7IGkgPCBiaW5zLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoYmluc1tpXSA8PSBiaW5zW2kgLSAxXSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IobS5lcnJCaW5zQXNjZW5kaW5nKGJpbnNbaSAtIDFdLCBiaW5zW2ldKSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE1vbnRobHlUcmFja2VyUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcbiAgc2V0dGluZ3MhOiBQbHVnaW5TZXR0aW5ncztcblxuICBhc3luYyBvbmxvYWQoKSB7XG4gICAgYXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcbiAgICB0aGlzLmFkZFNldHRpbmdUYWIobmV3IE1vbnRobHlUcmFja2VyU2V0dGluZ1RhYih0aGlzLmFwcCwgdGhpcykpO1xuXG4gICAgdGhpcy5yZWdpc3Rlck1hcmtkb3duQ29kZUJsb2NrUHJvY2Vzc29yKFxuICAgICAgJ21vbnRobHktdHJhY2tlcicsXG4gICAgICBhc3luYyAoc291cmNlLCBlbCwgY3R4KSA9PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgYXdhaXQgdGhpcy5wcm9jZXNzQmxvY2soc291cmNlLCBlbCwgY3R4KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgZWwuY3JlYXRlRWwoJ3ByZScsIHtcbiAgICAgICAgICAgIHRleHQ6IGAke3QoKS5lcnJvclByZWZpeH06XFxuJHtlcnIgaW5zdGFuY2VvZiBFcnJvciA/IGVyci5tZXNzYWdlIDogU3RyaW5nKGVycil9YCxcbiAgICAgICAgICAgIGNsczogJ21vbnRobHktdHJhY2tlci1lcnJvcicsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcHJvY2Vzc0Jsb2NrKFxuICAgIHNvdXJjZTogc3RyaW5nLFxuICAgIGVsOiBIVE1MRWxlbWVudCxcbiAgICBjdHg6IE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQsXG4gICk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGNvbmZpZyA9IHBhcnNlWWFtbChzb3VyY2UudHJpbSgpKSBhcyBUcmFja2VyQ29uZmlnO1xuICAgIHZhbGlkYXRlQ29uZmlnKGNvbmZpZyk7XG5cbiAgICAvLyBSZWFkIHllYXIvbW9udGggZnJvbSB0aGUgY3VycmVudCBub3RlJ3MgZnJvbnRtYXR0ZXJcbiAgICBjb25zdCBjdXJyZW50RmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChjdHguc291cmNlUGF0aCk7XG4gICAgaWYgKCEoY3VycmVudEZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcih0KCkuZXJyQ2Fubm90UmVzb2x2ZUZpbGUpO1xuICAgIH1cbiAgICBjb25zdCBmbSA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGN1cnJlbnRGaWxlKT8uZnJvbnRtYXR0ZXI7XG4gICAgY29uc3QgeWVhciA9IGZtPy55ZWFyO1xuICAgIGNvbnN0IG1vbnRoID0gZm0/Lm1vbnRoO1xuICAgIGlmICh5ZWFyID09IG51bGwgfHwgbW9udGggPT0gbnVsbCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKHQoKS5lcnJNaXNzaW5nWWVhck1vbnRoKTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiB5ZWFyICE9PSAnbnVtYmVyJyB8fCB0eXBlb2YgbW9udGggIT09ICdudW1iZXInKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IodCgpLmVyclllYXJNb250aFR5cGUpO1xuICAgIH1cbiAgICBpZiAobW9udGggPCAxIHx8IG1vbnRoID4gMTIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcih0KCkuZXJySW52YWxpZE1vbnRoKG1vbnRoKSk7XG4gICAgfVxuXG4gICAgY29uc3QgZGF5c0luTW9udGggPSBuZXcgRGF0ZSh5ZWFyLCBtb250aCwgMCkuZ2V0RGF0ZSgpO1xuICAgIGNvbnN0IGZvbGRlciA9IGNvbmZpZy5zb3VyY2UgPz8gKHRoaXMuc2V0dGluZ3MuZGFpbHlOb3Rlc0ZvbGRlciB8fCBkZXRlY3REYWlseU5vdGVzRm9sZGVyKHRoaXMuYXBwKSk7XG4gICAgY29uc3QgcGF0dGVybiA9IGJ1aWxkRGF0ZVBhdHRlcm4odGhpcy5zZXR0aW5ncy5kYXRlRm9ybWF0LCB5ZWFyLCBtb250aCk7XG5cbiAgICAvLyBTY2FuIHZhdWx0IGZvbGRlciBmb3IgbWF0Y2hpbmcgZGFpbHkgbm90ZXNcbiAgICBjb25zdCBkYXRhID0gbmV3IE1hcDxudW1iZXIsIERheURhdGE+KCk7XG4gICAgY29uc3QgYWJzdHJhY3RGb2xkZXIgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoZm9sZGVyKTtcblxuICAgIGlmIChhYnN0cmFjdEZvbGRlciBpbnN0YW5jZW9mIFRGb2xkZXIpIHtcbiAgICAgIGZvciAoY29uc3QgY2hpbGQgb2YgYWJzdHJhY3RGb2xkZXIuY2hpbGRyZW4pIHtcbiAgICAgICAgaWYgKCEoY2hpbGQgaW5zdGFuY2VvZiBURmlsZSkpIGNvbnRpbnVlO1xuICAgICAgICBjb25zdCBtYXRjaCA9IGNoaWxkLm5hbWUubWF0Y2gocGF0dGVybik7XG4gICAgICAgIGlmICghbWF0Y2gpIGNvbnRpbnVlO1xuICAgICAgICBjb25zdCBkYXkgPSBwYXJzZUludChtYXRjaFsxXSwgMTApO1xuXG4gICAgICAgIGNvbnN0IGNoaWxkRm0gPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShjaGlsZCk/LmZyb250bWF0dGVyO1xuICAgICAgICBsZXQgdmFsdWU6IHVua25vd24gPSB1bmRlZmluZWQ7XG5cbiAgICAgICAgaWYgKGNvbmZpZy5wcm9wZXJ0eSA9PT0gbnVsbCB8fCBjb25maWcucHJvcGVydHkgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIC8vIEZpbGUtZXhpc3RlbmNlIG1vZGUgKGUuZy4gTW9ybmluZyBKb3VybmFsIGZvbGRlcilcbiAgICAgICAgICB2YWx1ZSA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFsdWUgPSBjaGlsZEZtPy5bY29uZmlnLnByb3BlcnR5XTtcbiAgICAgICAgfVxuXG4gICAgICAgIGRhdGEuc2V0KGRheSwgeyBkYXksIHZhbHVlLCBmaWxlUGF0aDogY2hpbGQucGF0aCB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCByZW5kZXJlZCA9IHJlbmRlclRyYWNrZXIoY29uZmlnLCBkYXRhLCBkYXlzSW5Nb250aCk7XG5cbiAgICAvLyBEZWxlZ2F0ZSBpbnRlcm5hbC1saW5rIGNsaWNrcyB0byBPYnNpZGlhbiBzbyBkYXkgY2VsbHMgb3BlbiB0aGUgbm90ZS5cbiAgICB0aGlzLnJlZ2lzdGVyRG9tRXZlbnQocmVuZGVyZWQsICdjbGljaycsIChldnQpID0+IHtcbiAgICAgIGNvbnN0IGxpbmsgPSAoZXZ0LnRhcmdldCBhcyBIVE1MRWxlbWVudCkuY2xvc2VzdCgnYS5pbnRlcm5hbC1saW5rJyk7XG4gICAgICBjb25zdCBwYXRoID0gbGluaz8uZ2V0QXR0cmlidXRlKCdkYXRhLWhyZWYnKTtcbiAgICAgIGlmICghcGF0aCkgcmV0dXJuO1xuICAgICAgZXZ0LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub3BlbkxpbmtUZXh0KHBhdGgsIGN0eC5zb3VyY2VQYXRoLCBldnQuY3RybEtleSB8fCBldnQubWV0YUtleSk7XG4gICAgfSk7XG5cbiAgICAvLyBUcmlnZ2VyIE9ic2lkaWFuJ3MgcGFnZS1wcmV2aWV3IG9uIGhvdmVyIChkYXRhLWhyZWYgYWxvbmUgZG9lc24ndCBlbmFibGUgaXQpLlxuICAgIHRoaXMucmVnaXN0ZXJEb21FdmVudChyZW5kZXJlZCwgJ21vdXNlb3ZlcicsIChldnQpID0+IHtcbiAgICAgIGNvbnN0IGxpbmsgPSAoZXZ0LnRhcmdldCBhcyBIVE1MRWxlbWVudCkuY2xvc2VzdCgnYS5pbnRlcm5hbC1saW5rJyk7XG4gICAgICBjb25zdCBwYXRoID0gbGluaz8uZ2V0QXR0cmlidXRlKCdkYXRhLWhyZWYnKTtcbiAgICAgIGlmICghcGF0aCkgcmV0dXJuO1xuICAgICAgdGhpcy5hcHAud29ya3NwYWNlLnRyaWdnZXIoJ2hvdmVyLWxpbmsnLCB7XG4gICAgICAgIGV2ZW50OiBldnQsXG4gICAgICAgIHNvdXJjZTogJ21vbnRobHktdHJhY2tlcicsXG4gICAgICAgIGhvdmVyUGFyZW50OiByZW5kZXJlZCxcbiAgICAgICAgdGFyZ2V0RWw6IGxpbmssXG4gICAgICAgIGxpbmt0ZXh0OiBwYXRoLFxuICAgICAgICBzb3VyY2VQYXRoOiBjdHguc291cmNlUGF0aCxcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgZWwuYXBwZW5kQ2hpbGQocmVuZGVyZWQpO1xuICB9XG5cbiAgYXN5bmMgbG9hZFNldHRpbmdzKCkge1xuICAgIHRoaXMuc2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKHt9LCBERUZBVUxUX1NFVFRJTkdTLCBhd2FpdCB0aGlzLmxvYWREYXRhKCkpO1xuICB9XG5cbiAgYXN5bmMgc2F2ZVNldHRpbmdzKCkge1xuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zZXR0aW5ncyk7XG4gIH1cbn1cbiJdLCJuYW1lcyI6WyJQbHVnaW5TZXR0aW5nVGFi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
