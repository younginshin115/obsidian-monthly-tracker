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

const EMPTY_COLOR = '#ebedf0';
function applyBaseStyle(el, bgColor, textStyle) {
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
function dayCell(day, bgColor, filePath, tooltip, textStyle) {
    const el = filePath
        ? document.createElement('a')
        : document.createElement('div');
    if (filePath) {
        const anchor = el;
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
function wrapGrid(cells) {
    const row = document.createElement('div');
    Object.assign(row.style, { display: 'flex', gap: '2px', marginBottom: '8px' });
    for (const cell of cells)
        row.appendChild(cell);
    return row;
}
const ACTIVE_STYLE = { fontWeight: '600', color: 'white' };
const EMPTY_STYLE = { color: '#999' };
function renderBoolean(config, data, daysInMonth) {
    const activeColor = resolveColor(config.color);
    const cells = [];
    for (let day = 1; day <= daysInMonth; day++) {
        const entry = data.get(day);
        const active = entry !== undefined && !!entry.value;
        cells.push(dayCell(day, active ? activeColor : EMPTY_COLOR, entry === null || entry === void 0 ? void 0 : entry.filePath, active ? t().tooltipYes : '', active ? ACTIVE_STYLE : EMPTY_STYLE));
    }
    return wrapGrid(cells);
}
function renderColormap(config, data, daysInMonth) {
    const colorMap = config.colors;
    const cells = [];
    for (let day = 1; day <= daysInMonth; day++) {
        const entry = data.get(day);
        const val = entry === null || entry === void 0 ? void 0 : entry.value;
        const mappedColor = val != null ? colorMap[val] : undefined;
        const bgColor = mappedColor !== null && mappedColor !== void 0 ? mappedColor : EMPTY_COLOR;
        cells.push(dayCell(day, bgColor, entry === null || entry === void 0 ? void 0 : entry.filePath, val !== null && val !== void 0 ? val : '', mappedColor ? ACTIVE_STYLE : EMPTY_STYLE));
    }
    return wrapGrid(cells);
}
function renderHeatmap(config, data, daysInMonth) {
    var _a, _b, _c, _d;
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
        ...Array(maxIntensity + 1 - colors.length).fill((_b = colors[colors.length - 1]) !== null && _b !== void 0 ? _b : EMPTY_COLOR),
    ];
    let total = 0;
    const cells = [];
    for (let day = 1; day <= daysInMonth; day++) {
        const entry = data.get(day);
        const raw = entry === null || entry === void 0 ? void 0 : entry.value;
        const val = typeof raw === 'number' && isFinite(raw) ? raw : 0;
        total += val;
        const intensity = getIntensity(val);
        const bgColor = (_c = safeColors[intensity]) !== null && _c !== void 0 ? _c : EMPTY_COLOR;
        cells.push(dayCell(day, bgColor, entry === null || entry === void 0 ? void 0 : entry.filePath, val > 0 ? `${val}${unit}` : '', intensity > 0 ? ACTIVE_STYLE : EMPTY_STYLE));
    }
    const container = document.createElement('div');
    if (config.showTotal) {
        const label = (_d = config.totalLabel) !== null && _d !== void 0 ? _d : t().totalLabel;
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
function renderTracker(config, data, daysInMonth) {
    const container = document.createElement('div');
    container.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
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
        // Delegate internal-link clicks to Obsidian so day cells open the note
        // (and so hover preview works via data-href).
        this.registerDomEvent(rendered, 'click', (evt) => {
            const link = evt.target.closest('a.internal-link');
            const path = link === null || link === void 0 ? void 0 : link.getAttribute('data-href');
            if (!path)
                return;
            evt.preventDefault();
            this.app.workspace.openLinkText(path, ctx.sourcePath, evt.ctrlKey || evt.metaKey);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsic3JjL3R5cGVzLnRzIiwic3JjL2kxOG4udHMiLCJzcmMvc2V0dGluZ3MudHMiLCJzcmMvcHJlc2V0cy50cyIsInNyYy9yZW5kZXJlci50cyIsInNyYy9tYWluLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBpbnRlcmZhY2UgQm9vbGVhbkNvbmZpZyB7XG4gIHR5cGU6ICdib29sZWFuJztcbiAgdGl0bGU/OiBzdHJpbmc7XG4gIHByb3BlcnR5Pzogc3RyaW5nO1xuICBzb3VyY2U/OiBzdHJpbmc7XG4gIC8qKiBoZXggY29sb3Igc3RyaW5nIG9yIHByZXNldCBuYW1lIChlLmcuIFwiYmx1ZVwiKSAqL1xuICBjb2xvcjogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIENvbG9ybWFwQ29uZmlnIHtcbiAgdHlwZTogJ2NvbG9ybWFwJztcbiAgdGl0bGU/OiBzdHJpbmc7XG4gIHByb3BlcnR5OiBzdHJpbmc7XG4gIHNvdXJjZT86IHN0cmluZztcbiAgY29sb3JzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEhlYXRtYXBDb25maWcge1xuICB0eXBlOiAnaGVhdG1hcCc7XG4gIHRpdGxlPzogc3RyaW5nO1xuICBwcm9wZXJ0eTogc3RyaW5nO1xuICBzb3VyY2U/OiBzdHJpbmc7XG4gIHVuaXQ/OiBzdHJpbmc7XG4gIC8qKlxuICAgKiBUaHJlc2hvbGRzIHNlcGFyYXRpbmcgaW50ZW5zaXR5IGxldmVscy5cbiAgICogZS5nLiBbMywgNSwgNywgMTBdIOKGkiA1IGJ1Y2tldHM6IFswLDMpLCBbMyw1KSwgWzUsNyksIFs3LDEwKSwgWzEwLOKInilcbiAgICovXG4gIGJpbnM/OiBudW1iZXJbXTtcbiAgLyoqIGFycmF5IG9mIGhleCBjb2xvcnMsIGxlbmd0aCA9IGJpbnMubGVuZ3RoICsgMSwgb3Igb21pdCBhbmQgdXNlIGNvbG9yU2NoZW1lICovXG4gIGNvbG9ycz86IHN0cmluZ1tdO1xuICAvKiogYnVpbHQtaW4gaGVhdG1hcCBjb2xvciBzY2hlbWUgbmFtZSAoZS5nLiBcImluZGlnb1wiKSAqL1xuICBjb2xvclNjaGVtZT86IHN0cmluZztcbiAgc2hvd1RvdGFsPzogYm9vbGVhbjtcbiAgLyoqIGxhYmVsIHNob3duIG5leHQgdG8gdG90YWwsIGRlZmF1bHRzIHRvIHByb3BlcnR5IG5hbWUgKi9cbiAgdG90YWxMYWJlbD86IHN0cmluZztcbn1cblxuZXhwb3J0IHR5cGUgVHJhY2tlckNvbmZpZyA9IEJvb2xlYW5Db25maWcgfCBDb2xvcm1hcENvbmZpZyB8IEhlYXRtYXBDb25maWc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGx1Z2luU2V0dGluZ3Mge1xuICBkYWlseU5vdGVzRm9sZGVyOiBzdHJpbmc7XG4gIGRhdGVGb3JtYXQ6IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IERFRkFVTFRfU0VUVElOR1M6IFBsdWdpblNldHRpbmdzID0ge1xuICBkYWlseU5vdGVzRm9sZGVyOiAnJyxcbiAgZGF0ZUZvcm1hdDogJ1lZWVktTU0tREQnLFxufTtcbiIsInR5cGUgTG9jYWxlID0gJ2VuJyB8ICdrbyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTWVzc2FnZXMge1xuICBlcnJvclByZWZpeDogc3RyaW5nO1xuICBlcnJNaXNzaW5nVHlwZTogc3RyaW5nO1xuICBlcnJNaXNzaW5nUHJvcGVydHk6IHN0cmluZztcbiAgZXJyTWlzc2luZ0NvbG9yczogc3RyaW5nO1xuICBlcnJDYW5ub3RSZXNvbHZlRmlsZTogc3RyaW5nO1xuICBlcnJNaXNzaW5nWWVhck1vbnRoOiBzdHJpbmc7XG4gIGVyclllYXJNb250aFR5cGU6IHN0cmluZztcbiAgZXJySW52YWxpZE1vbnRoOiAobW9udGg6IG51bWJlcikgPT4gc3RyaW5nO1xuICBlcnJIZWF0bWFwQmluczogc3RyaW5nO1xuICBlcnJCaW5zUG9zaXRpdmU6ICh2YWx1ZTogbnVtYmVyKSA9PiBzdHJpbmc7XG4gIGVyckJpbnNBc2NlbmRpbmc6IChwcmV2OiBudW1iZXIsIG5leHQ6IG51bWJlcikgPT4gc3RyaW5nO1xuICB0b29sdGlwWWVzOiBzdHJpbmc7XG4gIHRvdGFsTGFiZWw6IHN0cmluZztcbiAgc2V0dGluZ3NGb2xkZXJOYW1lOiBzdHJpbmc7XG4gIHNldHRpbmdzRm9sZGVyRGVzYzogc3RyaW5nO1xuICBzZXR0aW5nc0RhdGVGb3JtYXROYW1lOiBzdHJpbmc7XG4gIHNldHRpbmdzRGF0ZUZvcm1hdERlc2M6IHN0cmluZztcbn1cblxuY29uc3QgZW46IE1lc3NhZ2VzID0ge1xuICBlcnJvclByZWZpeDogJ01vbnRobHkgVHJhY2tlciBFcnJvcicsXG4gIGVyck1pc3NpbmdUeXBlOiAnTWlzc2luZyByZXF1aXJlZCBmaWVsZDogdHlwZSAoYm9vbGVhbiB8IGNvbG9ybWFwIHwgaGVhdG1hcCknLFxuICBlcnJNaXNzaW5nUHJvcGVydHk6ICdNaXNzaW5nIHJlcXVpcmVkIGZpZWxkOiBwcm9wZXJ0eScsXG4gIGVyck1pc3NpbmdDb2xvcnM6ICdNaXNzaW5nIHJlcXVpcmVkIGZpZWxkOiBjb2xvcnMgKGUuZy4gY29sb3JzOiB7dmFsdWU6IFwiI2hleFwifSknLFxuICBlcnJDYW5ub3RSZXNvbHZlRmlsZTogJ0Nhbm5vdCByZXNvbHZlIGN1cnJlbnQgZmlsZScsXG4gIGVyck1pc3NpbmdZZWFyTW9udGg6IFwiQ3VycmVudCBub3RlIG11c3QgaGF2ZSAneWVhcicgYW5kICdtb250aCcgaW4gZnJvbnRtYXR0ZXJcIixcbiAgZXJyWWVhck1vbnRoVHlwZTogXCIneWVhcicgYW5kICdtb250aCcgbXVzdCBiZSBudW1iZXJzIGluIGZyb250bWF0dGVyXCIsXG4gIGVyckludmFsaWRNb250aDogKG1vbnRoKSA9PiBgSW52YWxpZCBtb250aDogJHttb250aH0gKG11c3QgYmUgMeKAkzEyKWAsXG4gIGVyckhlYXRtYXBCaW5zOiAnaGVhdG1hcCByZXF1aXJlcyBcImJpbnNcIiAoZS5nLiBiaW5zOiBbMywgNSwgNywgMTBdKScsXG4gIGVyckJpbnNQb3NpdGl2ZTogKHZhbHVlKSA9PiBgYmlucyB2YWx1ZXMgbXVzdCBiZSBwb3NpdGl2ZSAoZ290ICR7dmFsdWV9KWAsXG4gIGVyckJpbnNBc2NlbmRpbmc6IChwcmV2LCBuZXh0KSA9PiBgYmlucyBtdXN0IGJlIGluIGFzY2VuZGluZyBvcmRlciAoZ290ICR7cHJldn0sICR7bmV4dH0pYCxcbiAgdG9vbHRpcFllczogJ1llcycsXG4gIHRvdGFsTGFiZWw6ICdUb3RhbCcsXG4gIHNldHRpbmdzRm9sZGVyTmFtZTogJ0RhaWx5IG5vdGVzIGZvbGRlcicsXG4gIHNldHRpbmdzRm9sZGVyRGVzYzogJ0ZvbGRlciBjb250YWluaW5nIGRhaWx5IG5vdGVzIChlLmcuIENhbGVuZGFyL0RheXMpJyxcbiAgc2V0dGluZ3NEYXRlRm9ybWF0TmFtZTogJ0RhdGUgZm9ybWF0JyxcbiAgc2V0dGluZ3NEYXRlRm9ybWF0RGVzYzogJ0ZpbGUgbmFtZSBkYXRlIGZvcm1hdC4gTXVzdCBtYXRjaCBZWVlZLU1NLUREIGF0IHRoZSBzdGFydCBvZiBmaWxlIG5hbWVzLicsXG59O1xuXG5jb25zdCBrbzogTWVzc2FnZXMgPSB7XG4gIGVycm9yUHJlZml4OiAnTW9udGhseSBUcmFja2VyIOyYpOulmCcsXG4gIGVyck1pc3NpbmdUeXBlOiAn7ZWE7IiYIO2VreuqqSDriITrnb06IHR5cGUgKGJvb2xlYW4gfCBjb2xvcm1hcCB8IGhlYXRtYXApJyxcbiAgZXJyTWlzc2luZ1Byb3BlcnR5OiAn7ZWE7IiYIO2VreuqqSDriITrnb06IHByb3BlcnR5JyxcbiAgZXJyTWlzc2luZ0NvbG9yczogJ+2VhOyImCDtla3rqqkg64iE6529OiBjb2xvcnMgKOyYiDogY29sb3JzOiB7dmFsdWU6IFwiI2hleFwifSknLFxuICBlcnJDYW5ub3RSZXNvbHZlRmlsZTogJ+2YhOyerCDtjIzsnbzsnYQg7LC+7J2EIOyImCDsl4bsirXri4jri6QnLFxuICBlcnJNaXNzaW5nWWVhck1vbnRoOiBcIu2YhOyerCDrhbjtirjsnZgg7ZSE66Gg7Yq466ek7YSw7JeQICd5ZWFyJ+yZgCAnbW9udGgn6rCAIOyeiOyWtOyVvCDtlanri4jri6RcIixcbiAgZXJyWWVhck1vbnRoVHlwZTogXCLtlITroaDtirjrp6TthLDsnZggJ3llYXIn7JmAICdtb250aCfripQg7Iir7J6Q7Jes7JW8IO2VqeuLiOuLpFwiLFxuICBlcnJJbnZhbGlkTW9udGg6IChtb250aCkgPT4gYOyemOuqu+uQnCBtb250aDogJHttb250aH0gKDHigJMxMiDsgqzsnbTsl6zslbwg7ZWp64uI64ukKWAsXG4gIGVyckhlYXRtYXBCaW5zOiAnaGVhdG1hcOyXkOuKlCBcImJpbnNcIuqwgCDtlYTsmpTtlanri4jri6QgKOyYiDogYmluczogWzMsIDUsIDcsIDEwXSknLFxuICBlcnJCaW5zUG9zaXRpdmU6ICh2YWx1ZSkgPT4gYGJpbnMg6rCS7J2AIOyWkeyImOyXrOyVvCDtlanri4jri6QgKOyeheugpeqwkjogJHt2YWx1ZX0pYCxcbiAgZXJyQmluc0FzY2VuZGluZzogKHByZXYsIG5leHQpID0+IGBiaW5z64qUIOyYpOumhOywqOyInOydtOyWtOyVvCDtlanri4jri6QgKOyeheugpeqwkjogJHtwcmV2fSwgJHtuZXh0fSlgLFxuICB0b29sdGlwWWVzOiAn7JmE66OMJyxcbiAgdG90YWxMYWJlbDogJ+2VqeqzhCcsXG4gIHNldHRpbmdzRm9sZGVyTmFtZTogJ+uNsOydvOumrCDrhbjtirgg7Y+0642UJyxcbiAgc2V0dGluZ3NGb2xkZXJEZXNjOiAn642w7J2866asIOuFuO2KuOqwgCDrk6TslrQg7J6I64qUIO2PtOuNlCAo7JiIOiBDYWxlbmRhci9EYXlzKScsXG4gIHNldHRpbmdzRGF0ZUZvcm1hdE5hbWU6ICfrgqDsp5wg7ZiV7IudJyxcbiAgc2V0dGluZ3NEYXRlRm9ybWF0RGVzYzogJ+2MjOydvCDsnbTrpoTsnZgg64Kg7KecIO2YleyLnS4g7YyM7J28IOydtOumhCDslZ7rtoDrtoTsnbQgWVlZWS1NTS1EROyZgCDsnbzsuZjtlbTslbwg7ZWp64uI64ukLicsXG59O1xuXG5mdW5jdGlvbiBjdXJyZW50TG9jYWxlKCk6IExvY2FsZSB7XG4gIGNvbnN0IGxhbmcgPSB3aW5kb3cubG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2xhbmd1YWdlJyk7XG4gIHJldHVybiBsYW5nID09PSAna28nID8gJ2tvJyA6ICdlbic7XG59XG5cbi8qKiBSZXR1cm5zIHRoZSBtZXNzYWdlIHRhYmxlIGZvciB0aGUgY3VycmVudCBPYnNpZGlhbiBVSSBsYW5ndWFnZS4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0KCk6IE1lc3NhZ2VzIHtcbiAgcmV0dXJuIGN1cnJlbnRMb2NhbGUoKSA9PT0gJ2tvJyA/IGtvIDogZW47XG59XG4iLCJpbXBvcnQgeyBBcHAsIFBsdWdpblNldHRpbmdUYWIsIFNldHRpbmcgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgdHlwZSBNb250aGx5VHJhY2tlclBsdWdpbiBmcm9tICcuL21haW4nO1xuaW1wb3J0IHsgdCB9IGZyb20gJy4vaTE4bic7XG5cbmV4cG9ydCBjbGFzcyBNb250aGx5VHJhY2tlclNldHRpbmdUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcbiAgcGx1Z2luOiBNb250aGx5VHJhY2tlclBsdWdpbjtcblxuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBNb250aGx5VHJhY2tlclBsdWdpbikge1xuICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcbiAgfVxuXG4gIGRpc3BsYXkoKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250YWluZXJFbCB9ID0gdGhpcztcbiAgICBjb25zdCBtID0gdCgpO1xuICAgIGNvbnRhaW5lckVsLmVtcHR5KCk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKG0uc2V0dGluZ3NGb2xkZXJOYW1lKVxuICAgICAgLnNldERlc2MobS5zZXR0aW5nc0ZvbGRlckRlc2MpXG4gICAgICAuYWRkVGV4dCh0ZXh0ID0+XG4gICAgICAgIHRleHRcbiAgICAgICAgICAuc2V0UGxhY2Vob2xkZXIoJ0NhbGVuZGFyL0RheXMnKVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5kYWlseU5vdGVzRm9sZGVyKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmRhaWx5Tm90ZXNGb2xkZXIgPSB2YWx1ZS50cmltKCk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KSxcbiAgICAgICk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKG0uc2V0dGluZ3NEYXRlRm9ybWF0TmFtZSlcbiAgICAgIC5zZXREZXNjKG0uc2V0dGluZ3NEYXRlRm9ybWF0RGVzYylcbiAgICAgIC5hZGRUZXh0KHRleHQgPT5cbiAgICAgICAgdGV4dFxuICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcignWVlZWS1NTS1ERCcpXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmRhdGVGb3JtYXQpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZGF0ZUZvcm1hdCA9IHZhbHVlLnRyaW0oKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIH0pLFxuICAgICAgKTtcbiAgfVxufVxuIiwiLyoqIFNpbmdsZS1jb2xvciBwcmVzZXRzIGZvciBib29sZWFuIHRyYWNrZXIgKi9cbmV4cG9ydCBjb25zdCBDT0xPUl9QUkVTRVRTOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICBibHVlOiAgICcjNjRiNWY2JyxcbiAgZ3JlZW46ICAnIzY2YmI2YScsXG4gIHJlZDogICAgJyNlNTczNzMnLFxuICBwdXJwbGU6ICcjYmE2OGM4JyxcbiAgb3JhbmdlOiAnI2ZmYjc0ZCcsXG4gIHllbGxvdzogJyNmZmQ1NGYnLFxuICB0ZWFsOiAgICcjNGRiNmFjJyxcbiAgaW5kaWdvOiAnIzc5ODZjYicsXG4gIHBpbms6ICAgJyNmMDYyOTInLFxufTtcblxuLyoqXG4gKiBIZWF0bWFwIGNvbG9yLXNjaGVtZSBwcmVzZXRzLlxuICogSW5kZXggMCA9IG5vIGRhdGEsIGluZGV4IDEuLm4gPSBpbmNyZWFzaW5nIGludGVuc2l0eS5cbiAqL1xuZXhwb3J0IGNvbnN0IEhFQVRNQVBfU0NIRU1FUzogUmVjb3JkPHN0cmluZywgc3RyaW5nW10+ID0ge1xuICBibHVlOiAgIFsnI2ViZWRmMCcsICcjYmJkZWZiJywgJyM5MGNhZjknLCAnIzY0YjVmNicsICcjNDJhNWY1JywgJyMxZTg4ZTUnXSxcbiAgZ3JlZW46ICBbJyNlYmVkZjAnLCAnI2M4ZTZjOScsICcjYTVkNmE3JywgJyM4MWM3ODQnLCAnIzY2YmI2YScsICcjNDNhMDQ3J10sXG4gIHJlZDogICAgWycjZWJlZGYwJywgJyNmZmNkZDInLCAnI2VmOWE5YScsICcjZTU3MzczJywgJyNlZjUzNTAnLCAnI2U1MzkzNSddLFxuICBwdXJwbGU6IFsnI2ViZWRmMCcsICcjZTFiZWU3JywgJyNjZTkzZDgnLCAnI2JhNjhjOCcsICcjYWI0N2JjJywgJyM4ZTI0YWEnXSxcbiAgb3JhbmdlOiBbJyNlYmVkZjAnLCAnI2ZmZTBiMicsICcjZmZjYzgwJywgJyNmZmI3NGQnLCAnI2ZmYTcyNicsICcjZmI4YzAwJ10sXG4gIHllbGxvdzogWycjZWJlZGYwJywgJyNmZmY5YzQnLCAnI2ZmZjU5ZCcsICcjZmZmMTc2JywgJyNmZmVlNTgnLCAnI2ZkZDgzNSddLFxuICB0ZWFsOiAgIFsnI2ViZWRmMCcsICcjYjJkZmRiJywgJyM4MGNiYzQnLCAnIzRkYjZhYycsICcjMjZhNjlhJywgJyMwMDg5N2InXSxcbiAgaW5kaWdvOiBbJyNlYmVkZjAnLCAnI2U4ZWFmNicsICcjYzVjYWU5JywgJyM5ZmE4ZGEnLCAnIzc5ODZjYicsICcjNWM2YmMwJ10sXG4gIHBpbms6ICAgWycjZWJlZGYwJywgJyNmY2U0ZWMnLCAnI2Y0OGZiMScsICcjZjA2MjkyJywgJyNlYzQwN2EnLCAnI2Q4MWI2MCddLFxufTtcblxuLyoqIFJlc29sdmUgYSBjb2xvciBzdHJpbmc6IGlmIGl0J3MgYSBrbm93biBwcmVzZXQgbmFtZSwgcmV0dXJuIHRoZSBoZXg7IG90aGVyd2lzZSByZXR1cm4gYXMtaXMuICovXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZUNvbG9yKGNvbG9yPzogc3RyaW5nKTogc3RyaW5nIHtcbiAgaWYgKCFjb2xvcikgcmV0dXJuIENPTE9SX1BSRVNFVFMuYmx1ZTtcbiAgcmV0dXJuIENPTE9SX1BSRVNFVFNbY29sb3IudG9Mb3dlckNhc2UoKV0gPz8gY29sb3I7XG59XG5cbi8qKiBSZXNvbHZlIGhlYXRtYXAgY29sb3JzIGFycmF5IGZyb20gY29sb3JTY2hlbWUgcHJlc2V0IG9yIGV4cGxpY2l0IGNvbG9ycyBhcnJheS4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlSGVhdG1hcENvbG9ycyhjb2xvcnM/OiBzdHJpbmdbXSwgY29sb3JTY2hlbWU/OiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gIGlmIChjb2xvcnMgJiYgY29sb3JzLmxlbmd0aCA+IDApIHJldHVybiBjb2xvcnM7XG4gIGlmIChjb2xvclNjaGVtZSkge1xuICAgIGNvbnN0IHNjaGVtZSA9IEhFQVRNQVBfU0NIRU1FU1tjb2xvclNjaGVtZS50b0xvd2VyQ2FzZSgpXTtcbiAgICBpZiAoc2NoZW1lKSByZXR1cm4gc2NoZW1lO1xuICB9XG4gIHJldHVybiBIRUFUTUFQX1NDSEVNRVNbJ2luZGlnbyddO1xufVxuXG4iLCJpbXBvcnQgeyBUcmFja2VyQ29uZmlnLCBCb29sZWFuQ29uZmlnLCBDb2xvcm1hcENvbmZpZywgSGVhdG1hcENvbmZpZyB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgcmVzb2x2ZUNvbG9yLCByZXNvbHZlSGVhdG1hcENvbG9ycyB9IGZyb20gJy4vcHJlc2V0cyc7XG5pbXBvcnQgeyB0IH0gZnJvbSAnLi9pMThuJztcblxuZXhwb3J0IGludGVyZmFjZSBEYXlEYXRhIHtcbiAgZGF5OiBudW1iZXI7XG4gIHZhbHVlOiB1bmtub3duO1xuICBmaWxlUGF0aD86IHN0cmluZztcbn1cblxuY29uc3QgRU1QVFlfQ09MT1IgPSAnI2ViZWRmMCc7XG5cbmZ1bmN0aW9uIGFwcGx5QmFzZVN0eWxlKGVsOiBIVE1MRWxlbWVudCwgYmdDb2xvcjogc3RyaW5nLCB0ZXh0U3R5bGU6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4pOiB2b2lkIHtcbiAgT2JqZWN0LmFzc2lnbihlbC5zdHlsZSwge1xuICAgIGJhY2tncm91bmRDb2xvcjogYmdDb2xvcixcbiAgICBkaXNwbGF5OiAnZmxleCcsXG4gICAgYWxpZ25JdGVtczogJ2NlbnRlcicsXG4gICAganVzdGlmeUNvbnRlbnQ6ICdjZW50ZXInLFxuICAgIHBhZGRpbmc6ICc0cHggMCcsXG4gICAgYm9yZGVyUmFkaXVzOiAnMnB4JyxcbiAgICBmb250U2l6ZTogJzlweCcsXG4gICAgZmxleDogJzEnLFxuICAgIG1pbldpZHRoOiAnMCcsXG4gICAgYm94U2l6aW5nOiAnYm9yZGVyLWJveCcsXG4gICAgLi4udGV4dFN0eWxlLFxuICB9KTtcbn1cblxuZnVuY3Rpb24gZGF5Q2VsbChcbiAgZGF5OiBudW1iZXIsXG4gIGJnQ29sb3I6IHN0cmluZyxcbiAgZmlsZVBhdGg6IHN0cmluZyB8IHVuZGVmaW5lZCxcbiAgdG9vbHRpcDogc3RyaW5nLFxuICB0ZXh0U3R5bGU6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4sXG4pOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IGVsOiBIVE1MRWxlbWVudCA9IGZpbGVQYXRoXG4gICAgPyBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJylcbiAgICA6IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXG4gIGlmIChmaWxlUGF0aCkge1xuICAgIGNvbnN0IGFuY2hvciA9IGVsIGFzIEhUTUxBbmNob3JFbGVtZW50O1xuICAgIGFuY2hvci5jbGFzc0xpc3QuYWRkKCdpbnRlcm5hbC1saW5rJyk7XG4gICAgYW5jaG9yLnNldEF0dHJpYnV0ZSgnaHJlZicsIGZpbGVQYXRoKTtcbiAgICBhbmNob3IuZGF0YXNldC5ocmVmID0gZmlsZVBhdGg7XG4gICAgYW5jaG9yLnN0eWxlLnRleHREZWNvcmF0aW9uID0gJ25vbmUnO1xuICB9XG5cbiAgZWwudGl0bGUgPSB0b29sdGlwO1xuICBlbC50ZXh0Q29udGVudCA9IFN0cmluZyhkYXkpO1xuICBhcHBseUJhc2VTdHlsZShlbCwgYmdDb2xvciwgdGV4dFN0eWxlKTtcbiAgcmV0dXJuIGVsO1xufVxuXG5mdW5jdGlvbiB3cmFwR3JpZChjZWxsczogSFRNTEVsZW1lbnRbXSk6IEhUTUxFbGVtZW50IHtcbiAgY29uc3Qgcm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIE9iamVjdC5hc3NpZ24ocm93LnN0eWxlLCB7IGRpc3BsYXk6ICdmbGV4JywgZ2FwOiAnMnB4JywgbWFyZ2luQm90dG9tOiAnOHB4JyB9KTtcbiAgZm9yIChjb25zdCBjZWxsIG9mIGNlbGxzKSByb3cuYXBwZW5kQ2hpbGQoY2VsbCk7XG4gIHJldHVybiByb3c7XG59XG5cbmNvbnN0IEFDVElWRV9TVFlMRTogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHsgZm9udFdlaWdodDogJzYwMCcsIGNvbG9yOiAnd2hpdGUnIH07XG5jb25zdCBFTVBUWV9TVFlMRTogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHsgY29sb3I6ICcjOTk5JyB9O1xuXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyQm9vbGVhbihjb25maWc6IEJvb2xlYW5Db25maWcsIGRhdGE6IE1hcDxudW1iZXIsIERheURhdGE+LCBkYXlzSW5Nb250aDogbnVtYmVyKTogSFRNTEVsZW1lbnQge1xuICBjb25zdCBhY3RpdmVDb2xvciA9IHJlc29sdmVDb2xvcihjb25maWcuY29sb3IpO1xuICBjb25zdCBjZWxsczogSFRNTEVsZW1lbnRbXSA9IFtdO1xuXG4gIGZvciAobGV0IGRheSA9IDE7IGRheSA8PSBkYXlzSW5Nb250aDsgZGF5KyspIHtcbiAgICBjb25zdCBlbnRyeSA9IGRhdGEuZ2V0KGRheSk7XG4gICAgY29uc3QgYWN0aXZlID0gZW50cnkgIT09IHVuZGVmaW5lZCAmJiAhIWVudHJ5LnZhbHVlO1xuICAgIGNlbGxzLnB1c2goZGF5Q2VsbChkYXksIGFjdGl2ZSA/IGFjdGl2ZUNvbG9yIDogRU1QVFlfQ09MT1IsIGVudHJ5Py5maWxlUGF0aCwgYWN0aXZlID8gdCgpLnRvb2x0aXBZZXMgOiAnJywgYWN0aXZlID8gQUNUSVZFX1NUWUxFIDogRU1QVFlfU1RZTEUpKTtcbiAgfVxuXG4gIHJldHVybiB3cmFwR3JpZChjZWxscyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJDb2xvcm1hcChjb25maWc6IENvbG9ybWFwQ29uZmlnLCBkYXRhOiBNYXA8bnVtYmVyLCBEYXlEYXRhPiwgZGF5c0luTW9udGg6IG51bWJlcik6IEhUTUxFbGVtZW50IHtcbiAgY29uc3QgY29sb3JNYXAgPSBjb25maWcuY29sb3JzO1xuICBjb25zdCBjZWxsczogSFRNTEVsZW1lbnRbXSA9IFtdO1xuXG4gIGZvciAobGV0IGRheSA9IDE7IGRheSA8PSBkYXlzSW5Nb250aDsgZGF5KyspIHtcbiAgICBjb25zdCBlbnRyeSA9IGRhdGEuZ2V0KGRheSk7XG4gICAgY29uc3QgdmFsID0gZW50cnk/LnZhbHVlIGFzIHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICBjb25zdCBtYXBwZWRDb2xvciA9IHZhbCAhPSBudWxsID8gY29sb3JNYXBbdmFsXSA6IHVuZGVmaW5lZDtcbiAgICBjb25zdCBiZ0NvbG9yID0gbWFwcGVkQ29sb3IgPz8gRU1QVFlfQ09MT1I7XG4gICAgY2VsbHMucHVzaChkYXlDZWxsKGRheSwgYmdDb2xvciwgZW50cnk/LmZpbGVQYXRoLCB2YWwgPz8gJycsIG1hcHBlZENvbG9yID8gQUNUSVZFX1NUWUxFIDogRU1QVFlfU1RZTEUpKTtcbiAgfVxuXG4gIHJldHVybiB3cmFwR3JpZChjZWxscyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJIZWF0bWFwKGNvbmZpZzogSGVhdG1hcENvbmZpZywgZGF0YTogTWFwPG51bWJlciwgRGF5RGF0YT4sIGRheXNJbk1vbnRoOiBudW1iZXIpOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IGNvbG9ycyA9IHJlc29sdmVIZWF0bWFwQ29sb3JzKGNvbmZpZy5jb2xvcnMsIGNvbmZpZy5jb2xvclNjaGVtZSk7XG4gIC8vIGJpbnMgYXJlIHZhbGlkYXRlZCB1cHN0cmVhbSBpbiBwcm9jZXNzQmxvY2s7IG5vbi1udWxsIGFzc2VydGlvbiBpcyBzYWZlIGhlcmUuXG4gIGNvbnN0IGJpbnMgPSBjb25maWcuYmlucyE7XG4gIGNvbnN0IHVuaXQgPSBjb25maWcudW5pdCA/PyAnJztcblxuICBmdW5jdGlvbiBnZXRJbnRlbnNpdHkodmFsOiBudW1iZXIpOiBudW1iZXIge1xuICAgIGlmICh2YWwgPD0gMCkgcmV0dXJuIDA7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBiaW5zLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAodmFsIDwgYmluc1tpXSkgcmV0dXJuIGkgKyAxO1xuICAgIH1cbiAgICByZXR1cm4gYmlucy5sZW5ndGggKyAxO1xuICB9XG5cbiAgY29uc3QgbWF4SW50ZW5zaXR5ID0gYmlucy5sZW5ndGggKyAxO1xuICBjb25zdCBzYWZlQ29sb3JzID0gY29sb3JzLmxlbmd0aCA+PSBtYXhJbnRlbnNpdHkgKyAxID8gY29sb3JzIDogW1xuICAgIC4uLmNvbG9ycyxcbiAgICAuLi5BcnJheShtYXhJbnRlbnNpdHkgKyAxIC0gY29sb3JzLmxlbmd0aCkuZmlsbChjb2xvcnNbY29sb3JzLmxlbmd0aCAtIDFdID8/IEVNUFRZX0NPTE9SKSxcbiAgXTtcblxuICBsZXQgdG90YWwgPSAwO1xuICBjb25zdCBjZWxsczogSFRNTEVsZW1lbnRbXSA9IFtdO1xuXG4gIGZvciAobGV0IGRheSA9IDE7IGRheSA8PSBkYXlzSW5Nb250aDsgZGF5KyspIHtcbiAgICBjb25zdCBlbnRyeSA9IGRhdGEuZ2V0KGRheSk7XG4gICAgY29uc3QgcmF3ID0gZW50cnk/LnZhbHVlO1xuICAgIGNvbnN0IHZhbCA9IHR5cGVvZiByYXcgPT09ICdudW1iZXInICYmIGlzRmluaXRlKHJhdykgPyByYXcgOiAwO1xuICAgIHRvdGFsICs9IHZhbDtcbiAgICBjb25zdCBpbnRlbnNpdHkgPSBnZXRJbnRlbnNpdHkodmFsKTtcbiAgICBjb25zdCBiZ0NvbG9yID0gc2FmZUNvbG9yc1tpbnRlbnNpdHldID8/IEVNUFRZX0NPTE9SO1xuICAgIGNlbGxzLnB1c2goZGF5Q2VsbChkYXksIGJnQ29sb3IsIGVudHJ5Py5maWxlUGF0aCwgdmFsID4gMCA/IGAke3ZhbH0ke3VuaXR9YCA6ICcnLCBpbnRlbnNpdHkgPiAwID8gQUNUSVZFX1NUWUxFIDogRU1QVFlfU1RZTEUpKTtcbiAgfVxuXG4gIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXG4gIGlmIChjb25maWcuc2hvd1RvdGFsKSB7XG4gICAgY29uc3QgbGFiZWwgPSBjb25maWcudG90YWxMYWJlbCA/PyB0KCkudG90YWxMYWJlbDtcbiAgICBjb25zdCBzdW1tYXJ5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgT2JqZWN0LmFzc2lnbihzdW1tYXJ5LnN0eWxlLCB7IG1hcmdpbkJvdHRvbTogJzZweCcsIGZvbnRTaXplOiAnMTJweCcsIGNvbG9yOiAndmFyKC0tdGV4dC1tdXRlZCknIH0pO1xuICAgIHN1bW1hcnkudGV4dENvbnRlbnQgPSBgJHtsYWJlbH06IGA7XG4gICAgY29uc3QgdmFsdWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gICAgT2JqZWN0LmFzc2lnbih2YWx1ZS5zdHlsZSwgeyBmb250V2VpZ2h0OiAnNjAwJywgY29sb3I6ICd2YXIoLS10ZXh0LW5vcm1hbCknIH0pO1xuICAgIGNvbnN0IGRpc3BsYXlUb3RhbCA9IE51bWJlci5pc0ludGVnZXIodG90YWwpID8gU3RyaW5nKHRvdGFsKSA6IHRvdGFsLnRvRml4ZWQoMSk7XG4gICAgdmFsdWUudGV4dENvbnRlbnQgPSBgJHtkaXNwbGF5VG90YWx9JHt1bml0fWA7XG4gICAgc3VtbWFyeS5hcHBlbmRDaGlsZCh2YWx1ZSk7XG4gICAgY29udGFpbmVyLmFwcGVuZENoaWxkKHN1bW1hcnkpO1xuICB9XG5cbiAgY29udGFpbmVyLmFwcGVuZENoaWxkKHdyYXBHcmlkKGNlbGxzKSk7XG4gIHJldHVybiBjb250YWluZXI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJUcmFja2VyKFxuICBjb25maWc6IFRyYWNrZXJDb25maWcsXG4gIGRhdGE6IE1hcDxudW1iZXIsIERheURhdGE+LFxuICBkYXlzSW5Nb250aDogbnVtYmVyLFxuKTogSFRNTEVsZW1lbnQge1xuICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgY29udGFpbmVyLnN0eWxlLmZvbnRGYW1pbHkgPSBcIi1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lzdGVtRm9udCwgJ1NlZ29lIFVJJywgc2Fucy1zZXJpZlwiO1xuXG4gIGxldCBpbm5lcjogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgaWYgKGNvbmZpZy50eXBlID09PSAnYm9vbGVhbicpIHtcbiAgICBpbm5lciA9IHJlbmRlckJvb2xlYW4oY29uZmlnLCBkYXRhLCBkYXlzSW5Nb250aCk7XG4gIH0gZWxzZSBpZiAoY29uZmlnLnR5cGUgPT09ICdjb2xvcm1hcCcpIHtcbiAgICBpbm5lciA9IHJlbmRlckNvbG9ybWFwKGNvbmZpZywgZGF0YSwgZGF5c0luTW9udGgpO1xuICB9IGVsc2UgaWYgKGNvbmZpZy50eXBlID09PSAnaGVhdG1hcCcpIHtcbiAgICBpbm5lciA9IHJlbmRlckhlYXRtYXAoY29uZmlnLCBkYXRhLCBkYXlzSW5Nb250aCk7XG4gIH1cblxuICBpZiAoaW5uZXIpIGNvbnRhaW5lci5hcHBlbmRDaGlsZChpbm5lcik7XG4gIHJldHVybiBjb250YWluZXI7XG59XG4iLCJpbXBvcnQgeyBBcHAsIFBsdWdpbiwgTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCwgVEZpbGUsIFRGb2xkZXIsIHBhcnNlWWFtbCB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCB7IFBsdWdpblNldHRpbmdzLCBERUZBVUxUX1NFVFRJTkdTLCBUcmFja2VyQ29uZmlnIH0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgeyBNb250aGx5VHJhY2tlclNldHRpbmdUYWIgfSBmcm9tICcuL3NldHRpbmdzJztcbmltcG9ydCB7IHJlbmRlclRyYWNrZXIsIERheURhdGEgfSBmcm9tICcuL3JlbmRlcmVyJztcbmltcG9ydCB7IHQgfSBmcm9tICcuL2kxOG4nO1xuXG5mdW5jdGlvbiBidWlsZERhdGVQYXR0ZXJuKGRhdGVGb3JtYXQ6IHN0cmluZywgeWVhcjogbnVtYmVyLCBtb250aDogbnVtYmVyKTogUmVnRXhwIHtcbiAgY29uc3QgbW0gPSBTdHJpbmcobW9udGgpLnBhZFN0YXJ0KDIsICcwJyk7XG4gIGNvbnN0IGVzY2FwZWQgPSBkYXRlRm9ybWF0XG4gICAgLnJlcGxhY2UoJ1lZWVknLCAnXFx4MDBZXFx4MDAnKVxuICAgIC5yZXBsYWNlKCdNTScsICdcXHgwME1cXHgwMCcpXG4gICAgLnJlcGxhY2UoJ0REJywgJ1xceDAwRFxceDAwJylcbiAgICAucmVwbGFjZSgvWy4qKz9eJHt9KCl8W1xcXVxcXFxdL2csICdcXFxcJCYnKVxuICAgIC5yZXBsYWNlKCdcXHgwMFlcXHgwMCcsIFN0cmluZyh5ZWFyKSlcbiAgICAucmVwbGFjZSgnXFx4MDBNXFx4MDAnLCBtbSlcbiAgICAucmVwbGFjZSgnXFx4MDBEXFx4MDAnLCAnKFxcXFxkezJ9KScpO1xuICByZXR1cm4gbmV3IFJlZ0V4cChgXiR7ZXNjYXBlZH1gKTtcbn1cblxuZnVuY3Rpb24gZGV0ZWN0RGFpbHlOb3Rlc0ZvbGRlcihhcHA6IEFwcCk6IHN0cmluZyB7XG4gIGNvbnN0IGludGVybmFsID0gKGFwcCBhcyBhbnkpLmludGVybmFsUGx1Z2lucz8ucGx1Z2lucz8uWydkYWlseS1ub3RlcyddPy5pbnN0YW5jZT8ub3B0aW9ucz8uZm9sZGVyO1xuICBpZiAoaW50ZXJuYWwpIHJldHVybiBpbnRlcm5hbDtcbiAgY29uc3QgcGVyaW9kaWMgPSAoYXBwIGFzIGFueSkucGx1Z2lucz8ucGx1Z2lucz8uWydwZXJpb2RpYy1ub3RlcyddPy5zZXR0aW5ncz8uZGFpbHk/LmZvbGRlcjtcbiAgaWYgKHBlcmlvZGljKSByZXR1cm4gcGVyaW9kaWM7XG4gIHJldHVybiAnJztcbn1cblxuLyoqIFZhbGlkYXRlIGNvbmZpZy1sZXZlbCBpbnZhcmlhbnRzIHVwIGZyb250IHNvIHJlbmRlcmVycyBjYW4gYXNzdW1lIHZhbGlkIGlucHV0LiAqL1xuZnVuY3Rpb24gdmFsaWRhdGVDb25maWcoY29uZmlnOiBUcmFja2VyQ29uZmlnKTogdm9pZCB7XG4gIGNvbnN0IG0gPSB0KCk7XG4gIGlmICghY29uZmlnPy50eXBlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKG0uZXJyTWlzc2luZ1R5cGUpO1xuICB9XG4gIGlmICghY29uZmlnLnByb3BlcnR5ICYmIGNvbmZpZy50eXBlICE9PSAnYm9vbGVhbicpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IobS5lcnJNaXNzaW5nUHJvcGVydHkpO1xuICB9XG4gIGlmIChjb25maWcudHlwZSA9PT0gJ2NvbG9ybWFwJyAmJiAhY29uZmlnLmNvbG9ycykge1xuICAgIHRocm93IG5ldyBFcnJvcihtLmVyck1pc3NpbmdDb2xvcnMpO1xuICB9XG4gIGlmIChjb25maWcudHlwZSA9PT0gJ2hlYXRtYXAnKSB7XG4gICAgY29uc3QgYmlucyA9IGNvbmZpZy5iaW5zO1xuICAgIGlmICghYmlucyB8fCBiaW5zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKG0uZXJySGVhdG1hcEJpbnMpO1xuICAgIH1cbiAgICBpZiAoYmluc1swXSA8PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IobS5lcnJCaW5zUG9zaXRpdmUoYmluc1swXSkpO1xuICAgIH1cbiAgICBmb3IgKGxldCBpID0gMTsgaSA8IGJpbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChiaW5zW2ldIDw9IGJpbnNbaSAtIDFdKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihtLmVyckJpbnNBc2NlbmRpbmcoYmluc1tpIC0gMV0sIGJpbnNbaV0pKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTW9udGhseVRyYWNrZXJQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuICBzZXR0aW5ncyE6IFBsdWdpblNldHRpbmdzO1xuXG4gIGFzeW5jIG9ubG9hZCgpIHtcbiAgICBhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xuICAgIHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgTW9udGhseVRyYWNrZXJTZXR0aW5nVGFiKHRoaXMuYXBwLCB0aGlzKSk7XG5cbiAgICB0aGlzLnJlZ2lzdGVyTWFya2Rvd25Db2RlQmxvY2tQcm9jZXNzb3IoXG4gICAgICAnbW9udGhseS10cmFja2VyJyxcbiAgICAgIGFzeW5jIChzb3VyY2UsIGVsLCBjdHgpID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBhd2FpdCB0aGlzLnByb2Nlc3NCbG9jayhzb3VyY2UsIGVsLCBjdHgpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBlbC5jcmVhdGVFbCgncHJlJywge1xuICAgICAgICAgICAgdGV4dDogYCR7dCgpLmVycm9yUHJlZml4fTpcXG4ke2VyciBpbnN0YW5jZW9mIEVycm9yID8gZXJyLm1lc3NhZ2UgOiBTdHJpbmcoZXJyKX1gLFxuICAgICAgICAgICAgY2xzOiAnbW9udGhseS10cmFja2VyLWVycm9yJyxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICApO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBwcm9jZXNzQmxvY2soXG4gICAgc291cmNlOiBzdHJpbmcsXG4gICAgZWw6IEhUTUxFbGVtZW50LFxuICAgIGN0eDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgY29uZmlnID0gcGFyc2VZYW1sKHNvdXJjZS50cmltKCkpIGFzIFRyYWNrZXJDb25maWc7XG4gICAgdmFsaWRhdGVDb25maWcoY29uZmlnKTtcblxuICAgIC8vIFJlYWQgeWVhci9tb250aCBmcm9tIHRoZSBjdXJyZW50IG5vdGUncyBmcm9udG1hdHRlclxuICAgIGNvbnN0IGN1cnJlbnRGaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGN0eC5zb3VyY2VQYXRoKTtcbiAgICBpZiAoIShjdXJyZW50RmlsZSBpbnN0YW5jZW9mIFRGaWxlKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKHQoKS5lcnJDYW5ub3RSZXNvbHZlRmlsZSk7XG4gICAgfVxuICAgIGNvbnN0IGZtID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoY3VycmVudEZpbGUpPy5mcm9udG1hdHRlcjtcbiAgICBjb25zdCB5ZWFyID0gZm0/LnllYXI7XG4gICAgY29uc3QgbW9udGggPSBmbT8ubW9udGg7XG4gICAgaWYgKHllYXIgPT0gbnVsbCB8fCBtb250aCA9PSBudWxsKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IodCgpLmVyck1pc3NpbmdZZWFyTW9udGgpO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIHllYXIgIT09ICdudW1iZXInIHx8IHR5cGVvZiBtb250aCAhPT0gJ251bWJlcicpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcih0KCkuZXJyWWVhck1vbnRoVHlwZSk7XG4gICAgfVxuICAgIGlmIChtb250aCA8IDEgfHwgbW9udGggPiAxMikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKHQoKS5lcnJJbnZhbGlkTW9udGgobW9udGgpKTtcbiAgICB9XG5cbiAgICBjb25zdCBkYXlzSW5Nb250aCA9IG5ldyBEYXRlKHllYXIsIG1vbnRoLCAwKS5nZXREYXRlKCk7XG4gICAgY29uc3QgZm9sZGVyID0gY29uZmlnLnNvdXJjZSA/PyAodGhpcy5zZXR0aW5ncy5kYWlseU5vdGVzRm9sZGVyIHx8IGRldGVjdERhaWx5Tm90ZXNGb2xkZXIodGhpcy5hcHApKTtcbiAgICBjb25zdCBwYXR0ZXJuID0gYnVpbGREYXRlUGF0dGVybih0aGlzLnNldHRpbmdzLmRhdGVGb3JtYXQsIHllYXIsIG1vbnRoKTtcblxuICAgIC8vIFNjYW4gdmF1bHQgZm9sZGVyIGZvciBtYXRjaGluZyBkYWlseSBub3Rlc1xuICAgIGNvbnN0IGRhdGEgPSBuZXcgTWFwPG51bWJlciwgRGF5RGF0YT4oKTtcbiAgICBjb25zdCBhYnN0cmFjdEZvbGRlciA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChmb2xkZXIpO1xuXG4gICAgaWYgKGFic3RyYWN0Rm9sZGVyIGluc3RhbmNlb2YgVEZvbGRlcikge1xuICAgICAgZm9yIChjb25zdCBjaGlsZCBvZiBhYnN0cmFjdEZvbGRlci5jaGlsZHJlbikge1xuICAgICAgICBpZiAoIShjaGlsZCBpbnN0YW5jZW9mIFRGaWxlKSkgY29udGludWU7XG4gICAgICAgIGNvbnN0IG1hdGNoID0gY2hpbGQubmFtZS5tYXRjaChwYXR0ZXJuKTtcbiAgICAgICAgaWYgKCFtYXRjaCkgY29udGludWU7XG4gICAgICAgIGNvbnN0IGRheSA9IHBhcnNlSW50KG1hdGNoWzFdLCAxMCk7XG5cbiAgICAgICAgY29uc3QgY2hpbGRGbSA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGNoaWxkKT8uZnJvbnRtYXR0ZXI7XG4gICAgICAgIGxldCB2YWx1ZTogdW5rbm93biA9IHVuZGVmaW5lZDtcblxuICAgICAgICBpZiAoY29uZmlnLnByb3BlcnR5ID09PSBudWxsIHx8IGNvbmZpZy5wcm9wZXJ0eSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgLy8gRmlsZS1leGlzdGVuY2UgbW9kZSAoZS5nLiBNb3JuaW5nIEpvdXJuYWwgZm9sZGVyKVxuICAgICAgICAgIHZhbHVlID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YWx1ZSA9IGNoaWxkRm0/Lltjb25maWcucHJvcGVydHldO1xuICAgICAgICB9XG5cbiAgICAgICAgZGF0YS5zZXQoZGF5LCB7IGRheSwgdmFsdWUsIGZpbGVQYXRoOiBjaGlsZC5wYXRoIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHJlbmRlcmVkID0gcmVuZGVyVHJhY2tlcihjb25maWcsIGRhdGEsIGRheXNJbk1vbnRoKTtcblxuICAgIC8vIERlbGVnYXRlIGludGVybmFsLWxpbmsgY2xpY2tzIHRvIE9ic2lkaWFuIHNvIGRheSBjZWxscyBvcGVuIHRoZSBub3RlXG4gICAgLy8gKGFuZCBzbyBob3ZlciBwcmV2aWV3IHdvcmtzIHZpYSBkYXRhLWhyZWYpLlxuICAgIHRoaXMucmVnaXN0ZXJEb21FdmVudChyZW5kZXJlZCwgJ2NsaWNrJywgKGV2dCkgPT4ge1xuICAgICAgY29uc3QgbGluayA9IChldnQudGFyZ2V0IGFzIEhUTUxFbGVtZW50KS5jbG9zZXN0KCdhLmludGVybmFsLWxpbmsnKTtcbiAgICAgIGNvbnN0IHBhdGggPSBsaW5rPy5nZXRBdHRyaWJ1dGUoJ2RhdGEtaHJlZicpO1xuICAgICAgaWYgKCFwYXRoKSByZXR1cm47XG4gICAgICBldnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vcGVuTGlua1RleHQocGF0aCwgY3R4LnNvdXJjZVBhdGgsIGV2dC5jdHJsS2V5IHx8IGV2dC5tZXRhS2V5KTtcbiAgICB9KTtcblxuICAgIGVsLmFwcGVuZENoaWxkKHJlbmRlcmVkKTtcbiAgfVxuXG4gIGFzeW5jIGxvYWRTZXR0aW5ncygpIHtcbiAgICB0aGlzLnNldHRpbmdzID0gT2JqZWN0LmFzc2lnbih7fSwgREVGQVVMVF9TRVRUSU5HUywgYXdhaXQgdGhpcy5sb2FkRGF0YSgpKTtcbiAgfVxuXG4gIGFzeW5jIHNhdmVTZXR0aW5ncygpIHtcbiAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xuICB9XG59XG4iXSwibmFtZXMiOlsiUGx1Z2luU2V0dGluZ1RhYiIsIlNldHRpbmciLCJQbHVnaW4iLCJwYXJzZVlhbWwiLCJURmlsZSIsIlRGb2xkZXIiXSwibWFwcGluZ3MiOiI7Ozs7QUE0Q08sTUFBTSxnQkFBZ0IsR0FBbUI7QUFDOUMsSUFBQSxnQkFBZ0IsRUFBRSxFQUFFO0FBQ3BCLElBQUEsVUFBVSxFQUFFLFlBQVk7Q0FDekI7O0FDekJELE1BQU0sRUFBRSxHQUFhO0FBQ25CLElBQUEsV0FBVyxFQUFFLHVCQUF1QjtBQUNwQyxJQUFBLGNBQWMsRUFBRSw2REFBNkQ7QUFDN0UsSUFBQSxrQkFBa0IsRUFBRSxrQ0FBa0M7QUFDdEQsSUFBQSxnQkFBZ0IsRUFBRSwrREFBK0Q7QUFDakYsSUFBQSxvQkFBb0IsRUFBRSw2QkFBNkI7QUFDbkQsSUFBQSxtQkFBbUIsRUFBRSwwREFBMEQ7QUFDL0UsSUFBQSxnQkFBZ0IsRUFBRSxtREFBbUQ7SUFDckUsZUFBZSxFQUFFLENBQUMsS0FBSyxLQUFLLENBQUEsZUFBQSxFQUFrQixLQUFLLENBQWlCLGVBQUEsQ0FBQTtBQUNwRSxJQUFBLGNBQWMsRUFBRSxvREFBb0Q7SUFDcEUsZUFBZSxFQUFFLENBQUMsS0FBSyxLQUFLLENBQUEsa0NBQUEsRUFBcUMsS0FBSyxDQUFHLENBQUEsQ0FBQTtBQUN6RSxJQUFBLGdCQUFnQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksS0FBSyxDQUF3QyxxQ0FBQSxFQUFBLElBQUksQ0FBSyxFQUFBLEVBQUEsSUFBSSxDQUFHLENBQUEsQ0FBQTtBQUMxRixJQUFBLFVBQVUsRUFBRSxLQUFLO0FBQ2pCLElBQUEsVUFBVSxFQUFFLE9BQU87QUFDbkIsSUFBQSxrQkFBa0IsRUFBRSxvQkFBb0I7QUFDeEMsSUFBQSxrQkFBa0IsRUFBRSxvREFBb0Q7QUFD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
