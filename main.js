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
        el.href = filePath;
        el.classList.add('internal-link');
        el.style.textDecoration = 'none';
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
    if (!config.bins || config.bins.length === 0)
        throw new Error(t().errHeatmapBins);
    const bins = config.bins;
    if (bins[0] <= 0)
        throw new Error(t().errBinsPositive(bins[0]));
    for (let i = 1; i < bins.length; i++) {
        if (bins[i] <= bins[i - 1])
            throw new Error(t().errBinsAscending(bins[i - 1], bins[i]));
    }
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
        value.textContent = `${total.toFixed(1)}${unit}`;
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
        var _a, _b, _c, _d;
        const config = obsidian.parseYaml(source.trim());
        if (!(config === null || config === void 0 ? void 0 : config.type)) {
            throw new Error(t().errMissingType);
        }
        if (!config.property && config.type !== 'boolean') {
            throw new Error(t().errMissingProperty);
        }
        if (config.type === 'colormap' && !config.colors) {
            throw new Error(t().errMissingColors);
        }
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
        const pattern = buildDatePattern(this.settings.dateFormat, year, Number(month));
        // Scan vault folder for matching daily notes
        const data = new Map();
        const abstractFolder = this.app.vault.getAbstractFileByPath(folder);
        if (abstractFolder) {
            // @ts-ignore — TFolder has children
            const children = (_c = abstractFolder.children) !== null && _c !== void 0 ? _c : [];
            for (const child of children) {
                if (!(child instanceof obsidian.TFile))
                    continue;
                const match = child.name.match(pattern);
                if (!match)
                    continue;
                const day = parseInt(match[1], 10);
                const childFm = (_d = this.app.metadataCache.getFileCache(child)) === null || _d === void 0 ? void 0 : _d.frontmatter;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsic3JjL3R5cGVzLnRzIiwic3JjL2kxOG4udHMiLCJzcmMvc2V0dGluZ3MudHMiLCJzcmMvcHJlc2V0cy50cyIsInNyYy9yZW5kZXJlci50cyIsInNyYy9tYWluLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBpbnRlcmZhY2UgQm9vbGVhbkNvbmZpZyB7XG4gIHR5cGU6ICdib29sZWFuJztcbiAgdGl0bGU/OiBzdHJpbmc7XG4gIHByb3BlcnR5Pzogc3RyaW5nO1xuICBzb3VyY2U/OiBzdHJpbmc7XG4gIC8qKiBoZXggY29sb3Igc3RyaW5nIG9yIHByZXNldCBuYW1lIChlLmcuIFwiYmx1ZVwiKSAqL1xuICBjb2xvcjogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIENvbG9ybWFwQ29uZmlnIHtcbiAgdHlwZTogJ2NvbG9ybWFwJztcbiAgdGl0bGU/OiBzdHJpbmc7XG4gIHByb3BlcnR5OiBzdHJpbmc7XG4gIHNvdXJjZT86IHN0cmluZztcbiAgY29sb3JzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEhlYXRtYXBDb25maWcge1xuICB0eXBlOiAnaGVhdG1hcCc7XG4gIHRpdGxlPzogc3RyaW5nO1xuICBwcm9wZXJ0eTogc3RyaW5nO1xuICBzb3VyY2U/OiBzdHJpbmc7XG4gIHVuaXQ/OiBzdHJpbmc7XG4gIC8qKlxuICAgKiBUaHJlc2hvbGRzIHNlcGFyYXRpbmcgaW50ZW5zaXR5IGxldmVscy5cbiAgICogZS5nLiBbMywgNSwgNywgMTBdIOKGkiA1IGJ1Y2tldHM6IFswLDMpLCBbMyw1KSwgWzUsNyksIFs3LDEwKSwgWzEwLOKInilcbiAgICovXG4gIGJpbnM/OiBudW1iZXJbXTtcbiAgLyoqIGFycmF5IG9mIGhleCBjb2xvcnMsIGxlbmd0aCA9IGJpbnMubGVuZ3RoICsgMSwgb3Igb21pdCBhbmQgdXNlIGNvbG9yU2NoZW1lICovXG4gIGNvbG9ycz86IHN0cmluZ1tdO1xuICAvKiogYnVpbHQtaW4gaGVhdG1hcCBjb2xvciBzY2hlbWUgbmFtZSAoZS5nLiBcImluZGlnb1wiKSAqL1xuICBjb2xvclNjaGVtZT86IHN0cmluZztcbiAgc2hvd1RvdGFsPzogYm9vbGVhbjtcbiAgLyoqIGxhYmVsIHNob3duIG5leHQgdG8gdG90YWwsIGRlZmF1bHRzIHRvIHByb3BlcnR5IG5hbWUgKi9cbiAgdG90YWxMYWJlbD86IHN0cmluZztcbn1cblxuZXhwb3J0IHR5cGUgVHJhY2tlckNvbmZpZyA9IEJvb2xlYW5Db25maWcgfCBDb2xvcm1hcENvbmZpZyB8IEhlYXRtYXBDb25maWc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGx1Z2luU2V0dGluZ3Mge1xuICBkYWlseU5vdGVzRm9sZGVyOiBzdHJpbmc7XG4gIGRhdGVGb3JtYXQ6IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IERFRkFVTFRfU0VUVElOR1M6IFBsdWdpblNldHRpbmdzID0ge1xuICBkYWlseU5vdGVzRm9sZGVyOiAnJyxcbiAgZGF0ZUZvcm1hdDogJ1lZWVktTU0tREQnLFxufTtcbiIsInR5cGUgTG9jYWxlID0gJ2VuJyB8ICdrbyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTWVzc2FnZXMge1xuICBlcnJvclByZWZpeDogc3RyaW5nO1xuICBlcnJNaXNzaW5nVHlwZTogc3RyaW5nO1xuICBlcnJNaXNzaW5nUHJvcGVydHk6IHN0cmluZztcbiAgZXJyTWlzc2luZ0NvbG9yczogc3RyaW5nO1xuICBlcnJDYW5ub3RSZXNvbHZlRmlsZTogc3RyaW5nO1xuICBlcnJNaXNzaW5nWWVhck1vbnRoOiBzdHJpbmc7XG4gIGVyclllYXJNb250aFR5cGU6IHN0cmluZztcbiAgZXJySW52YWxpZE1vbnRoOiAobW9udGg6IG51bWJlcikgPT4gc3RyaW5nO1xuICBlcnJIZWF0bWFwQmluczogc3RyaW5nO1xuICBlcnJCaW5zUG9zaXRpdmU6ICh2YWx1ZTogbnVtYmVyKSA9PiBzdHJpbmc7XG4gIGVyckJpbnNBc2NlbmRpbmc6IChwcmV2OiBudW1iZXIsIG5leHQ6IG51bWJlcikgPT4gc3RyaW5nO1xuICB0b29sdGlwWWVzOiBzdHJpbmc7XG4gIHRvdGFsTGFiZWw6IHN0cmluZztcbiAgc2V0dGluZ3NGb2xkZXJOYW1lOiBzdHJpbmc7XG4gIHNldHRpbmdzRm9sZGVyRGVzYzogc3RyaW5nO1xuICBzZXR0aW5nc0RhdGVGb3JtYXROYW1lOiBzdHJpbmc7XG4gIHNldHRpbmdzRGF0ZUZvcm1hdERlc2M6IHN0cmluZztcbn1cblxuY29uc3QgZW46IE1lc3NhZ2VzID0ge1xuICBlcnJvclByZWZpeDogJ01vbnRobHkgVHJhY2tlciBFcnJvcicsXG4gIGVyck1pc3NpbmdUeXBlOiAnTWlzc2luZyByZXF1aXJlZCBmaWVsZDogdHlwZSAoYm9vbGVhbiB8IGNvbG9ybWFwIHwgaGVhdG1hcCknLFxuICBlcnJNaXNzaW5nUHJvcGVydHk6ICdNaXNzaW5nIHJlcXVpcmVkIGZpZWxkOiBwcm9wZXJ0eScsXG4gIGVyck1pc3NpbmdDb2xvcnM6ICdNaXNzaW5nIHJlcXVpcmVkIGZpZWxkOiBjb2xvcnMgKGUuZy4gY29sb3JzOiB7dmFsdWU6IFwiI2hleFwifSknLFxuICBlcnJDYW5ub3RSZXNvbHZlRmlsZTogJ0Nhbm5vdCByZXNvbHZlIGN1cnJlbnQgZmlsZScsXG4gIGVyck1pc3NpbmdZZWFyTW9udGg6IFwiQ3VycmVudCBub3RlIG11c3QgaGF2ZSAneWVhcicgYW5kICdtb250aCcgaW4gZnJvbnRtYXR0ZXJcIixcbiAgZXJyWWVhck1vbnRoVHlwZTogXCIneWVhcicgYW5kICdtb250aCcgbXVzdCBiZSBudW1iZXJzIGluIGZyb250bWF0dGVyXCIsXG4gIGVyckludmFsaWRNb250aDogKG1vbnRoKSA9PiBgSW52YWxpZCBtb250aDogJHttb250aH0gKG11c3QgYmUgMeKAkzEyKWAsXG4gIGVyckhlYXRtYXBCaW5zOiAnaGVhdG1hcCByZXF1aXJlcyBcImJpbnNcIiAoZS5nLiBiaW5zOiBbMywgNSwgNywgMTBdKScsXG4gIGVyckJpbnNQb3NpdGl2ZTogKHZhbHVlKSA9PiBgYmlucyB2YWx1ZXMgbXVzdCBiZSBwb3NpdGl2ZSAoZ290ICR7dmFsdWV9KWAsXG4gIGVyckJpbnNBc2NlbmRpbmc6IChwcmV2LCBuZXh0KSA9PiBgYmlucyBtdXN0IGJlIGluIGFzY2VuZGluZyBvcmRlciAoZ290ICR7cHJldn0sICR7bmV4dH0pYCxcbiAgdG9vbHRpcFllczogJ1llcycsXG4gIHRvdGFsTGFiZWw6ICdUb3RhbCcsXG4gIHNldHRpbmdzRm9sZGVyTmFtZTogJ0RhaWx5IG5vdGVzIGZvbGRlcicsXG4gIHNldHRpbmdzRm9sZGVyRGVzYzogJ0ZvbGRlciBjb250YWluaW5nIGRhaWx5IG5vdGVzIChlLmcuIENhbGVuZGFyL0RheXMpJyxcbiAgc2V0dGluZ3NEYXRlRm9ybWF0TmFtZTogJ0RhdGUgZm9ybWF0JyxcbiAgc2V0dGluZ3NEYXRlRm9ybWF0RGVzYzogJ0ZpbGUgbmFtZSBkYXRlIGZvcm1hdC4gTXVzdCBtYXRjaCBZWVlZLU1NLUREIGF0IHRoZSBzdGFydCBvZiBmaWxlIG5hbWVzLicsXG59O1xuXG5jb25zdCBrbzogTWVzc2FnZXMgPSB7XG4gIGVycm9yUHJlZml4OiAnTW9udGhseSBUcmFja2VyIOyYpOulmCcsXG4gIGVyck1pc3NpbmdUeXBlOiAn7ZWE7IiYIO2VreuqqSDriITrnb06IHR5cGUgKGJvb2xlYW4gfCBjb2xvcm1hcCB8IGhlYXRtYXApJyxcbiAgZXJyTWlzc2luZ1Byb3BlcnR5OiAn7ZWE7IiYIO2VreuqqSDriITrnb06IHByb3BlcnR5JyxcbiAgZXJyTWlzc2luZ0NvbG9yczogJ+2VhOyImCDtla3rqqkg64iE6529OiBjb2xvcnMgKOyYiDogY29sb3JzOiB7dmFsdWU6IFwiI2hleFwifSknLFxuICBlcnJDYW5ub3RSZXNvbHZlRmlsZTogJ+2YhOyerCDtjIzsnbzsnYQg7LC+7J2EIOyImCDsl4bsirXri4jri6QnLFxuICBlcnJNaXNzaW5nWWVhck1vbnRoOiBcIu2YhOyerCDrhbjtirjsnZgg7ZSE66Gg7Yq466ek7YSw7JeQICd5ZWFyJ+yZgCAnbW9udGgn6rCAIOyeiOyWtOyVvCDtlanri4jri6RcIixcbiAgZXJyWWVhck1vbnRoVHlwZTogXCLtlITroaDtirjrp6TthLDsnZggJ3llYXIn7JmAICdtb250aCfripQg7Iir7J6Q7Jes7JW8IO2VqeuLiOuLpFwiLFxuICBlcnJJbnZhbGlkTW9udGg6IChtb250aCkgPT4gYOyemOuqu+uQnCBtb250aDogJHttb250aH0gKDHigJMxMiDsgqzsnbTsl6zslbwg7ZWp64uI64ukKWAsXG4gIGVyckhlYXRtYXBCaW5zOiAnaGVhdG1hcOyXkOuKlCBcImJpbnNcIuqwgCDtlYTsmpTtlanri4jri6QgKOyYiDogYmluczogWzMsIDUsIDcsIDEwXSknLFxuICBlcnJCaW5zUG9zaXRpdmU6ICh2YWx1ZSkgPT4gYGJpbnMg6rCS7J2AIOyWkeyImOyXrOyVvCDtlanri4jri6QgKOyeheugpeqwkjogJHt2YWx1ZX0pYCxcbiAgZXJyQmluc0FzY2VuZGluZzogKHByZXYsIG5leHQpID0+IGBiaW5z64qUIOyYpOumhOywqOyInOydtOyWtOyVvCDtlanri4jri6QgKOyeheugpeqwkjogJHtwcmV2fSwgJHtuZXh0fSlgLFxuICB0b29sdGlwWWVzOiAn7JmE66OMJyxcbiAgdG90YWxMYWJlbDogJ+2VqeqzhCcsXG4gIHNldHRpbmdzRm9sZGVyTmFtZTogJ+uNsOydvOumrCDrhbjtirgg7Y+0642UJyxcbiAgc2V0dGluZ3NGb2xkZXJEZXNjOiAn642w7J2866asIOuFuO2KuOqwgCDrk6TslrQg7J6I64qUIO2PtOuNlCAo7JiIOiBDYWxlbmRhci9EYXlzKScsXG4gIHNldHRpbmdzRGF0ZUZvcm1hdE5hbWU6ICfrgqDsp5wg7ZiV7IudJyxcbiAgc2V0dGluZ3NEYXRlRm9ybWF0RGVzYzogJ+2MjOydvCDsnbTrpoTsnZgg64Kg7KecIO2YleyLnS4g7YyM7J28IOydtOumhCDslZ7rtoDrtoTsnbQgWVlZWS1NTS1EROyZgCDsnbzsuZjtlbTslbwg7ZWp64uI64ukLicsXG59O1xuXG5mdW5jdGlvbiBjdXJyZW50TG9jYWxlKCk6IExvY2FsZSB7XG4gIGNvbnN0IGxhbmcgPSB3aW5kb3cubG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2xhbmd1YWdlJyk7XG4gIHJldHVybiBsYW5nID09PSAna28nID8gJ2tvJyA6ICdlbic7XG59XG5cbi8qKiBSZXR1cm5zIHRoZSBtZXNzYWdlIHRhYmxlIGZvciB0aGUgY3VycmVudCBPYnNpZGlhbiBVSSBsYW5ndWFnZS4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0KCk6IE1lc3NhZ2VzIHtcbiAgcmV0dXJuIGN1cnJlbnRMb2NhbGUoKSA9PT0gJ2tvJyA/IGtvIDogZW47XG59XG4iLCJpbXBvcnQgeyBBcHAsIFBsdWdpblNldHRpbmdUYWIsIFNldHRpbmcgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgdHlwZSBNb250aGx5VHJhY2tlclBsdWdpbiBmcm9tICcuL21haW4nO1xuaW1wb3J0IHsgdCB9IGZyb20gJy4vaTE4bic7XG5cbmV4cG9ydCBjbGFzcyBNb250aGx5VHJhY2tlclNldHRpbmdUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcbiAgcGx1Z2luOiBNb250aGx5VHJhY2tlclBsdWdpbjtcblxuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBNb250aGx5VHJhY2tlclBsdWdpbikge1xuICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcbiAgfVxuXG4gIGRpc3BsYXkoKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250YWluZXJFbCB9ID0gdGhpcztcbiAgICBjb25zdCBtID0gdCgpO1xuICAgIGNvbnRhaW5lckVsLmVtcHR5KCk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKG0uc2V0dGluZ3NGb2xkZXJOYW1lKVxuICAgICAgLnNldERlc2MobS5zZXR0aW5nc0ZvbGRlckRlc2MpXG4gICAgICAuYWRkVGV4dCh0ZXh0ID0+XG4gICAgICAgIHRleHRcbiAgICAgICAgICAuc2V0UGxhY2Vob2xkZXIoJ0NhbGVuZGFyL0RheXMnKVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5kYWlseU5vdGVzRm9sZGVyKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmRhaWx5Tm90ZXNGb2xkZXIgPSB2YWx1ZS50cmltKCk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KSxcbiAgICAgICk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKG0uc2V0dGluZ3NEYXRlRm9ybWF0TmFtZSlcbiAgICAgIC5zZXREZXNjKG0uc2V0dGluZ3NEYXRlRm9ybWF0RGVzYylcbiAgICAgIC5hZGRUZXh0KHRleHQgPT5cbiAgICAgICAgdGV4dFxuICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcignWVlZWS1NTS1ERCcpXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmRhdGVGb3JtYXQpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZGF0ZUZvcm1hdCA9IHZhbHVlLnRyaW0oKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIH0pLFxuICAgICAgKTtcbiAgfVxufVxuIiwiLyoqIFNpbmdsZS1jb2xvciBwcmVzZXRzIGZvciBib29sZWFuIHRyYWNrZXIgKi9cbmV4cG9ydCBjb25zdCBDT0xPUl9QUkVTRVRTOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICBibHVlOiAgICcjNjRiNWY2JyxcbiAgZ3JlZW46ICAnIzY2YmI2YScsXG4gIHJlZDogICAgJyNlNTczNzMnLFxuICBwdXJwbGU6ICcjYmE2OGM4JyxcbiAgb3JhbmdlOiAnI2ZmYjc0ZCcsXG4gIHllbGxvdzogJyNmZmQ1NGYnLFxuICB0ZWFsOiAgICcjNGRiNmFjJyxcbiAgaW5kaWdvOiAnIzc5ODZjYicsXG4gIHBpbms6ICAgJyNmMDYyOTInLFxufTtcblxuLyoqXG4gKiBIZWF0bWFwIGNvbG9yLXNjaGVtZSBwcmVzZXRzLlxuICogSW5kZXggMCA9IG5vIGRhdGEsIGluZGV4IDEuLm4gPSBpbmNyZWFzaW5nIGludGVuc2l0eS5cbiAqL1xuZXhwb3J0IGNvbnN0IEhFQVRNQVBfU0NIRU1FUzogUmVjb3JkPHN0cmluZywgc3RyaW5nW10+ID0ge1xuICBibHVlOiAgIFsnI2ViZWRmMCcsICcjYmJkZWZiJywgJyM5MGNhZjknLCAnIzY0YjVmNicsICcjNDJhNWY1JywgJyMxZTg4ZTUnXSxcbiAgZ3JlZW46ICBbJyNlYmVkZjAnLCAnI2M4ZTZjOScsICcjYTVkNmE3JywgJyM4MWM3ODQnLCAnIzY2YmI2YScsICcjNDNhMDQ3J10sXG4gIHJlZDogICAgWycjZWJlZGYwJywgJyNmZmNkZDInLCAnI2VmOWE5YScsICcjZTU3MzczJywgJyNlZjUzNTAnLCAnI2U1MzkzNSddLFxuICBwdXJwbGU6IFsnI2ViZWRmMCcsICcjZTFiZWU3JywgJyNjZTkzZDgnLCAnI2JhNjhjOCcsICcjYWI0N2JjJywgJyM4ZTI0YWEnXSxcbiAgb3JhbmdlOiBbJyNlYmVkZjAnLCAnI2ZmZTBiMicsICcjZmZjYzgwJywgJyNmZmI3NGQnLCAnI2ZmYTcyNicsICcjZmI4YzAwJ10sXG4gIHllbGxvdzogWycjZWJlZGYwJywgJyNmZmY5YzQnLCAnI2ZmZjU5ZCcsICcjZmZmMTc2JywgJyNmZmVlNTgnLCAnI2ZkZDgzNSddLFxuICB0ZWFsOiAgIFsnI2ViZWRmMCcsICcjYjJkZmRiJywgJyM4MGNiYzQnLCAnIzRkYjZhYycsICcjMjZhNjlhJywgJyMwMDg5N2InXSxcbiAgaW5kaWdvOiBbJyNlYmVkZjAnLCAnI2U4ZWFmNicsICcjYzVjYWU5JywgJyM5ZmE4ZGEnLCAnIzc5ODZjYicsICcjNWM2YmMwJ10sXG4gIHBpbms6ICAgWycjZWJlZGYwJywgJyNmY2U0ZWMnLCAnI2Y0OGZiMScsICcjZjA2MjkyJywgJyNlYzQwN2EnLCAnI2Q4MWI2MCddLFxufTtcblxuLyoqIFJlc29sdmUgYSBjb2xvciBzdHJpbmc6IGlmIGl0J3MgYSBrbm93biBwcmVzZXQgbmFtZSwgcmV0dXJuIHRoZSBoZXg7IG90aGVyd2lzZSByZXR1cm4gYXMtaXMuICovXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZUNvbG9yKGNvbG9yOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gQ09MT1JfUFJFU0VUU1tjb2xvci50b0xvd2VyQ2FzZSgpXSA/PyBjb2xvcjtcbn1cblxuLyoqIFJlc29sdmUgaGVhdG1hcCBjb2xvcnMgYXJyYXkgZnJvbSBjb2xvclNjaGVtZSBwcmVzZXQgb3IgZXhwbGljaXQgY29sb3JzIGFycmF5LiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVIZWF0bWFwQ29sb3JzKGNvbG9ycz86IHN0cmluZ1tdLCBjb2xvclNjaGVtZT86IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgaWYgKGNvbG9ycyAmJiBjb2xvcnMubGVuZ3RoID4gMCkgcmV0dXJuIGNvbG9ycztcbiAgaWYgKGNvbG9yU2NoZW1lKSB7XG4gICAgY29uc3Qgc2NoZW1lID0gSEVBVE1BUF9TQ0hFTUVTW2NvbG9yU2NoZW1lLnRvTG93ZXJDYXNlKCldO1xuICAgIGlmIChzY2hlbWUpIHJldHVybiBzY2hlbWU7XG4gIH1cbiAgcmV0dXJuIEhFQVRNQVBfU0NIRU1FU1snaW5kaWdvJ107XG59XG5cbiIsImltcG9ydCB7IFRyYWNrZXJDb25maWcsIEJvb2xlYW5Db25maWcsIENvbG9ybWFwQ29uZmlnLCBIZWF0bWFwQ29uZmlnIH0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgeyByZXNvbHZlQ29sb3IsIHJlc29sdmVIZWF0bWFwQ29sb3JzIH0gZnJvbSAnLi9wcmVzZXRzJztcbmltcG9ydCB7IHQgfSBmcm9tICcuL2kxOG4nO1xuXG5leHBvcnQgaW50ZXJmYWNlIERheURhdGEge1xuICBkYXk6IG51bWJlcjtcbiAgdmFsdWU6IHVua25vd247XG4gIGZpbGVQYXRoPzogc3RyaW5nO1xufVxuXG5jb25zdCBFTVBUWV9DT0xPUiA9ICcjZWJlZGYwJztcblxuZnVuY3Rpb24gYXBwbHlCYXNlU3R5bGUoZWw6IEhUTUxFbGVtZW50LCBiZ0NvbG9yOiBzdHJpbmcsIHRleHRTdHlsZTogUmVjb3JkPHN0cmluZywgc3RyaW5nPik6IHZvaWQge1xuICBPYmplY3QuYXNzaWduKGVsLnN0eWxlLCB7XG4gICAgYmFja2dyb3VuZENvbG9yOiBiZ0NvbG9yLFxuICAgIGRpc3BsYXk6ICdmbGV4JyxcbiAgICBhbGlnbkl0ZW1zOiAnY2VudGVyJyxcbiAgICBqdXN0aWZ5Q29udGVudDogJ2NlbnRlcicsXG4gICAgcGFkZGluZzogJzRweCAwJyxcbiAgICBib3JkZXJSYWRpdXM6ICcycHgnLFxuICAgIGZvbnRTaXplOiAnOXB4JyxcbiAgICBmbGV4OiAnMScsXG4gICAgbWluV2lkdGg6ICcwJyxcbiAgICBib3hTaXppbmc6ICdib3JkZXItYm94JyxcbiAgICAuLi50ZXh0U3R5bGUsXG4gIH0pO1xufVxuXG5mdW5jdGlvbiBkYXlDZWxsKFxuICBkYXk6IG51bWJlcixcbiAgYmdDb2xvcjogc3RyaW5nLFxuICBmaWxlUGF0aDogc3RyaW5nIHwgdW5kZWZpbmVkLFxuICB0b29sdGlwOiBzdHJpbmcsXG4gIHRleHRTdHlsZTogUmVjb3JkPHN0cmluZywgc3RyaW5nPixcbik6IEhUTUxFbGVtZW50IHtcbiAgY29uc3QgZWw6IEhUTUxFbGVtZW50ID0gZmlsZVBhdGhcbiAgICA/IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKVxuICAgIDogZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cbiAgaWYgKGZpbGVQYXRoKSB7XG4gICAgKGVsIGFzIEhUTUxBbmNob3JFbGVtZW50KS5ocmVmID0gZmlsZVBhdGg7XG4gICAgZWwuY2xhc3NMaXN0LmFkZCgnaW50ZXJuYWwtbGluaycpO1xuICAgIGVsLnN0eWxlLnRleHREZWNvcmF0aW9uID0gJ25vbmUnO1xuICB9XG5cbiAgZWwudGl0bGUgPSB0b29sdGlwO1xuICBlbC50ZXh0Q29udGVudCA9IFN0cmluZyhkYXkpO1xuICBhcHBseUJhc2VTdHlsZShlbCwgYmdDb2xvciwgdGV4dFN0eWxlKTtcbiAgcmV0dXJuIGVsO1xufVxuXG5mdW5jdGlvbiB3cmFwR3JpZChjZWxsczogSFRNTEVsZW1lbnRbXSk6IEhUTUxFbGVtZW50IHtcbiAgY29uc3Qgcm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIE9iamVjdC5hc3NpZ24ocm93LnN0eWxlLCB7IGRpc3BsYXk6ICdmbGV4JywgZ2FwOiAnMnB4JywgbWFyZ2luQm90dG9tOiAnOHB4JyB9KTtcbiAgZm9yIChjb25zdCBjZWxsIG9mIGNlbGxzKSByb3cuYXBwZW5kQ2hpbGQoY2VsbCk7XG4gIHJldHVybiByb3c7XG59XG5cbmNvbnN0IEFDVElWRV9TVFlMRTogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHsgZm9udFdlaWdodDogJzYwMCcsIGNvbG9yOiAnd2hpdGUnIH07XG5jb25zdCBFTVBUWV9TVFlMRTogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHsgY29sb3I6ICcjOTk5JyB9O1xuXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyQm9vbGVhbihjb25maWc6IEJvb2xlYW5Db25maWcsIGRhdGE6IE1hcDxudW1iZXIsIERheURhdGE+LCBkYXlzSW5Nb250aDogbnVtYmVyKTogSFRNTEVsZW1lbnQge1xuICBjb25zdCBhY3RpdmVDb2xvciA9IHJlc29sdmVDb2xvcihjb25maWcuY29sb3IpO1xuICBjb25zdCBjZWxsczogSFRNTEVsZW1lbnRbXSA9IFtdO1xuXG4gIGZvciAobGV0IGRheSA9IDE7IGRheSA8PSBkYXlzSW5Nb250aDsgZGF5KyspIHtcbiAgICBjb25zdCBlbnRyeSA9IGRhdGEuZ2V0KGRheSk7XG4gICAgY29uc3QgYWN0aXZlID0gZW50cnkgIT09IHVuZGVmaW5lZCAmJiAhIWVudHJ5LnZhbHVlO1xuICAgIGNlbGxzLnB1c2goZGF5Q2VsbChkYXksIGFjdGl2ZSA/IGFjdGl2ZUNvbG9yIDogRU1QVFlfQ09MT1IsIGVudHJ5Py5maWxlUGF0aCwgYWN0aXZlID8gdCgpLnRvb2x0aXBZZXMgOiAnJywgYWN0aXZlID8gQUNUSVZFX1NUWUxFIDogRU1QVFlfU1RZTEUpKTtcbiAgfVxuXG4gIHJldHVybiB3cmFwR3JpZChjZWxscyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJDb2xvcm1hcChjb25maWc6IENvbG9ybWFwQ29uZmlnLCBkYXRhOiBNYXA8bnVtYmVyLCBEYXlEYXRhPiwgZGF5c0luTW9udGg6IG51bWJlcik6IEhUTUxFbGVtZW50IHtcbiAgY29uc3QgY29sb3JNYXAgPSBjb25maWcuY29sb3JzO1xuICBjb25zdCBjZWxsczogSFRNTEVsZW1lbnRbXSA9IFtdO1xuXG4gIGZvciAobGV0IGRheSA9IDE7IGRheSA8PSBkYXlzSW5Nb250aDsgZGF5KyspIHtcbiAgICBjb25zdCBlbnRyeSA9IGRhdGEuZ2V0KGRheSk7XG4gICAgY29uc3QgdmFsID0gZW50cnk/LnZhbHVlIGFzIHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICBjb25zdCBtYXBwZWRDb2xvciA9IHZhbCAhPSBudWxsID8gY29sb3JNYXBbdmFsXSA6IHVuZGVmaW5lZDtcbiAgICBjb25zdCBiZ0NvbG9yID0gbWFwcGVkQ29sb3IgPz8gRU1QVFlfQ09MT1I7XG4gICAgY2VsbHMucHVzaChkYXlDZWxsKGRheSwgYmdDb2xvciwgZW50cnk/LmZpbGVQYXRoLCB2YWwgPz8gJycsIG1hcHBlZENvbG9yID8gQUNUSVZFX1NUWUxFIDogRU1QVFlfU1RZTEUpKTtcbiAgfVxuXG4gIHJldHVybiB3cmFwR3JpZChjZWxscyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJIZWF0bWFwKGNvbmZpZzogSGVhdG1hcENvbmZpZywgZGF0YTogTWFwPG51bWJlciwgRGF5RGF0YT4sIGRheXNJbk1vbnRoOiBudW1iZXIpOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IGNvbG9ycyA9IHJlc29sdmVIZWF0bWFwQ29sb3JzKGNvbmZpZy5jb2xvcnMsIGNvbmZpZy5jb2xvclNjaGVtZSk7XG4gIGlmICghY29uZmlnLmJpbnMgfHwgY29uZmlnLmJpbnMubGVuZ3RoID09PSAwKSB0aHJvdyBuZXcgRXJyb3IodCgpLmVyckhlYXRtYXBCaW5zKTtcbiAgY29uc3QgYmlucyA9IGNvbmZpZy5iaW5zO1xuICBpZiAoYmluc1swXSA8PSAwKSB0aHJvdyBuZXcgRXJyb3IodCgpLmVyckJpbnNQb3NpdGl2ZShiaW5zWzBdKSk7XG4gIGZvciAobGV0IGkgPSAxOyBpIDwgYmlucy5sZW5ndGg7IGkrKykge1xuICAgIGlmIChiaW5zW2ldIDw9IGJpbnNbaSAtIDFdKSB0aHJvdyBuZXcgRXJyb3IodCgpLmVyckJpbnNBc2NlbmRpbmcoYmluc1tpIC0gMV0sIGJpbnNbaV0pKTtcbiAgfVxuICBjb25zdCB1bml0ID0gY29uZmlnLnVuaXQgPz8gJyc7XG5cbiAgZnVuY3Rpb24gZ2V0SW50ZW5zaXR5KHZhbDogbnVtYmVyKTogbnVtYmVyIHtcbiAgICBpZiAodmFsIDw9IDApIHJldHVybiAwO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYmlucy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHZhbCA8IGJpbnNbaV0pIHJldHVybiBpICsgMTtcbiAgICB9XG4gICAgcmV0dXJuIGJpbnMubGVuZ3RoICsgMTtcbiAgfVxuXG4gIGNvbnN0IG1heEludGVuc2l0eSA9IGJpbnMubGVuZ3RoICsgMTtcbiAgY29uc3Qgc2FmZUNvbG9ycyA9IGNvbG9ycy5sZW5ndGggPj0gbWF4SW50ZW5zaXR5ICsgMSA/IGNvbG9ycyA6IFtcbiAgICAuLi5jb2xvcnMsXG4gICAgLi4uQXJyYXkobWF4SW50ZW5zaXR5ICsgMSAtIGNvbG9ycy5sZW5ndGgpLmZpbGwoY29sb3JzW2NvbG9ycy5sZW5ndGggLSAxXSA/PyBFTVBUWV9DT0xPUiksXG4gIF07XG5cbiAgbGV0IHRvdGFsID0gMDtcbiAgY29uc3QgY2VsbHM6IEhUTUxFbGVtZW50W10gPSBbXTtcblxuICBmb3IgKGxldCBkYXkgPSAxOyBkYXkgPD0gZGF5c0luTW9udGg7IGRheSsrKSB7XG4gICAgY29uc3QgZW50cnkgPSBkYXRhLmdldChkYXkpO1xuICAgIGNvbnN0IHJhdyA9IGVudHJ5Py52YWx1ZTtcbiAgICBjb25zdCB2YWwgPSB0eXBlb2YgcmF3ID09PSAnbnVtYmVyJyAmJiBpc0Zpbml0ZShyYXcpID8gcmF3IDogMDtcbiAgICB0b3RhbCArPSB2YWw7XG4gICAgY29uc3QgaW50ZW5zaXR5ID0gZ2V0SW50ZW5zaXR5KHZhbCk7XG4gICAgY29uc3QgYmdDb2xvciA9IHNhZmVDb2xvcnNbaW50ZW5zaXR5XSA/PyBFTVBUWV9DT0xPUjtcbiAgICBjZWxscy5wdXNoKGRheUNlbGwoZGF5LCBiZ0NvbG9yLCBlbnRyeT8uZmlsZVBhdGgsIHZhbCA+IDAgPyBgJHt2YWx9JHt1bml0fWAgOiAnJywgaW50ZW5zaXR5ID4gMCA/IEFDVElWRV9TVFlMRSA6IEVNUFRZX1NUWUxFKSk7XG4gIH1cblxuICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblxuICBpZiAoY29uZmlnLnNob3dUb3RhbCkge1xuICAgIGNvbnN0IGxhYmVsID0gY29uZmlnLnRvdGFsTGFiZWwgPz8gdCgpLnRvdGFsTGFiZWw7XG4gICAgY29uc3Qgc3VtbWFyeSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIE9iamVjdC5hc3NpZ24oc3VtbWFyeS5zdHlsZSwgeyBtYXJnaW5Cb3R0b206ICc2cHgnLCBmb250U2l6ZTogJzEycHgnLCBjb2xvcjogJ3ZhcigtLXRleHQtbXV0ZWQpJyB9KTtcbiAgICBzdW1tYXJ5LnRleHRDb250ZW50ID0gYCR7bGFiZWx9OiBgO1xuICAgIGNvbnN0IHZhbHVlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICAgIE9iamVjdC5hc3NpZ24odmFsdWUuc3R5bGUsIHsgZm9udFdlaWdodDogJzYwMCcsIGNvbG9yOiAndmFyKC0tdGV4dC1ub3JtYWwpJyB9KTtcbiAgICB2YWx1ZS50ZXh0Q29udGVudCA9IGAke3RvdGFsLnRvRml4ZWQoMSl9JHt1bml0fWA7XG4gICAgc3VtbWFyeS5hcHBlbmRDaGlsZCh2YWx1ZSk7XG4gICAgY29udGFpbmVyLmFwcGVuZENoaWxkKHN1bW1hcnkpO1xuICB9XG5cbiAgY29udGFpbmVyLmFwcGVuZENoaWxkKHdyYXBHcmlkKGNlbGxzKSk7XG4gIHJldHVybiBjb250YWluZXI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJUcmFja2VyKFxuICBjb25maWc6IFRyYWNrZXJDb25maWcsXG4gIGRhdGE6IE1hcDxudW1iZXIsIERheURhdGE+LFxuICBkYXlzSW5Nb250aDogbnVtYmVyLFxuKTogSFRNTEVsZW1lbnQge1xuICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgY29udGFpbmVyLnN0eWxlLmZvbnRGYW1pbHkgPSBcIi1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lzdGVtRm9udCwgJ1NlZ29lIFVJJywgc2Fucy1zZXJpZlwiO1xuXG4gIGxldCBpbm5lcjogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgaWYgKGNvbmZpZy50eXBlID09PSAnYm9vbGVhbicpIHtcbiAgICBpbm5lciA9IHJlbmRlckJvb2xlYW4oY29uZmlnLCBkYXRhLCBkYXlzSW5Nb250aCk7XG4gIH0gZWxzZSBpZiAoY29uZmlnLnR5cGUgPT09ICdjb2xvcm1hcCcpIHtcbiAgICBpbm5lciA9IHJlbmRlckNvbG9ybWFwKGNvbmZpZywgZGF0YSwgZGF5c0luTW9udGgpO1xuICB9IGVsc2UgaWYgKGNvbmZpZy50eXBlID09PSAnaGVhdG1hcCcpIHtcbiAgICBpbm5lciA9IHJlbmRlckhlYXRtYXAoY29uZmlnLCBkYXRhLCBkYXlzSW5Nb250aCk7XG4gIH1cblxuICBpZiAoaW5uZXIpIGNvbnRhaW5lci5hcHBlbmRDaGlsZChpbm5lcik7XG4gIHJldHVybiBjb250YWluZXI7XG59XG4iLCJpbXBvcnQgeyBQbHVnaW4sIE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQsIFRGaWxlLCBwYXJzZVlhbWwgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBQbHVnaW5TZXR0aW5ncywgREVGQVVMVF9TRVRUSU5HUywgVHJhY2tlckNvbmZpZyB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgTW9udGhseVRyYWNrZXJTZXR0aW5nVGFiIH0gZnJvbSAnLi9zZXR0aW5ncyc7XG5pbXBvcnQgeyByZW5kZXJUcmFja2VyLCBEYXlEYXRhIH0gZnJvbSAnLi9yZW5kZXJlcic7XG5pbXBvcnQgeyB0IH0gZnJvbSAnLi9pMThuJztcblxuZnVuY3Rpb24gYnVpbGREYXRlUGF0dGVybihkYXRlRm9ybWF0OiBzdHJpbmcsIHllYXI6IG51bWJlciwgbW9udGg6IG51bWJlcik6IFJlZ0V4cCB7XG4gIGNvbnN0IG1tID0gU3RyaW5nKG1vbnRoKS5wYWRTdGFydCgyLCAnMCcpO1xuICBjb25zdCBlc2NhcGVkID0gZGF0ZUZvcm1hdFxuICAgIC5yZXBsYWNlKCdZWVlZJywgJ1xceDAwWVxceDAwJylcbiAgICAucmVwbGFjZSgnTU0nLCAnXFx4MDBNXFx4MDAnKVxuICAgIC5yZXBsYWNlKCdERCcsICdcXHgwMERcXHgwMCcpXG4gICAgLnJlcGxhY2UoL1suKis/XiR7fSgpfFtcXF1cXFxcXS9nLCAnXFxcXCQmJylcbiAgICAucmVwbGFjZSgnXFx4MDBZXFx4MDAnLCBTdHJpbmcoeWVhcikpXG4gICAgLnJlcGxhY2UoJ1xceDAwTVxceDAwJywgbW0pXG4gICAgLnJlcGxhY2UoJ1xceDAwRFxceDAwJywgJyhcXFxcZHsyfSknKTtcbiAgcmV0dXJuIG5ldyBSZWdFeHAoYF4ke2VzY2FwZWR9YCk7XG59XG5cbmZ1bmN0aW9uIGRldGVjdERhaWx5Tm90ZXNGb2xkZXIoYXBwOiBhbnkpOiBzdHJpbmcge1xuICBjb25zdCBpbnRlcm5hbCA9IGFwcC5pbnRlcm5hbFBsdWdpbnM/LnBsdWdpbnM/LlsnZGFpbHktbm90ZXMnXT8uaW5zdGFuY2U/Lm9wdGlvbnM/LmZvbGRlcjtcbiAgaWYgKGludGVybmFsKSByZXR1cm4gaW50ZXJuYWw7XG4gIGNvbnN0IHBlcmlvZGljID0gYXBwLnBsdWdpbnM/LnBsdWdpbnM/LlsncGVyaW9kaWMtbm90ZXMnXT8uc2V0dGluZ3M/LmRhaWx5Py5mb2xkZXI7XG4gIGlmIChwZXJpb2RpYykgcmV0dXJuIHBlcmlvZGljO1xuICByZXR1cm4gJyc7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE1vbnRobHlUcmFja2VyUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcbiAgc2V0dGluZ3MhOiBQbHVnaW5TZXR0aW5ncztcblxuICBhc3luYyBvbmxvYWQoKSB7XG4gICAgYXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcbiAgICB0aGlzLmFkZFNldHRpbmdUYWIobmV3IE1vbnRobHlUcmFja2VyU2V0dGluZ1RhYih0aGlzLmFwcCwgdGhpcykpO1xuXG4gICAgdGhpcy5yZWdpc3Rlck1hcmtkb3duQ29kZUJsb2NrUHJvY2Vzc29yKFxuICAgICAgJ21vbnRobHktdHJhY2tlcicsXG4gICAgICBhc3luYyAoc291cmNlLCBlbCwgY3R4KSA9PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgYXdhaXQgdGhpcy5wcm9jZXNzQmxvY2soc291cmNlLCBlbCwgY3R4KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgZWwuY3JlYXRlRWwoJ3ByZScsIHtcbiAgICAgICAgICAgIHRleHQ6IGAke3QoKS5lcnJvclByZWZpeH06XFxuJHtlcnIgaW5zdGFuY2VvZiBFcnJvciA/IGVyci5tZXNzYWdlIDogU3RyaW5nKGVycil9YCxcbiAgICAgICAgICAgIGNsczogJ21vbnRobHktdHJhY2tlci1lcnJvcicsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcHJvY2Vzc0Jsb2NrKFxuICAgIHNvdXJjZTogc3RyaW5nLFxuICAgIGVsOiBIVE1MRWxlbWVudCxcbiAgICBjdHg6IE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQsXG4gICk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGNvbmZpZyA9IHBhcnNlWWFtbChzb3VyY2UudHJpbSgpKSBhcyBUcmFja2VyQ29uZmlnO1xuICAgIGlmICghY29uZmlnPy50eXBlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IodCgpLmVyck1pc3NpbmdUeXBlKTtcbiAgICB9XG4gICAgaWYgKCFjb25maWcucHJvcGVydHkgJiYgY29uZmlnLnR5cGUgIT09ICdib29sZWFuJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKHQoKS5lcnJNaXNzaW5nUHJvcGVydHkpO1xuICAgIH1cbiAgICBpZiAoY29uZmlnLnR5cGUgPT09ICdjb2xvcm1hcCcgJiYgIWNvbmZpZy5jb2xvcnMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcih0KCkuZXJyTWlzc2luZ0NvbG9ycyk7XG4gICAgfVxuXG4gICAgLy8gUmVhZCB5ZWFyL21vbnRoIGZyb20gdGhlIGN1cnJlbnQgbm90ZSdzIGZyb250bWF0dGVyXG4gICAgY29uc3QgY3VycmVudEZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoY3R4LnNvdXJjZVBhdGgpO1xuICAgIGlmICghKGN1cnJlbnRGaWxlIGluc3RhbmNlb2YgVEZpbGUpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IodCgpLmVyckNhbm5vdFJlc29sdmVGaWxlKTtcbiAgICB9XG4gICAgY29uc3QgZm0gPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShjdXJyZW50RmlsZSk/LmZyb250bWF0dGVyO1xuICAgIGNvbnN0IHllYXIgPSBmbT8ueWVhcjtcbiAgICBjb25zdCBtb250aCA9IGZtPy5tb250aDtcbiAgICBpZiAoeWVhciA9PSBudWxsIHx8IG1vbnRoID09IG51bGwpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcih0KCkuZXJyTWlzc2luZ1llYXJNb250aCk7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgeWVhciAhPT0gJ251bWJlcicgfHwgdHlwZW9mIG1vbnRoICE9PSAnbnVtYmVyJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKHQoKS5lcnJZZWFyTW9udGhUeXBlKTtcbiAgICB9XG4gICAgaWYgKG1vbnRoIDwgMSB8fCBtb250aCA+IDEyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IodCgpLmVyckludmFsaWRNb250aChtb250aCkpO1xuICAgIH1cblxuICAgIGNvbnN0IGRheXNJbk1vbnRoID0gbmV3IERhdGUoeWVhciwgbW9udGgsIDApLmdldERhdGUoKTtcbiAgICBjb25zdCBmb2xkZXIgPSBjb25maWcuc291cmNlID8/ICh0aGlzLnNldHRpbmdzLmRhaWx5Tm90ZXNGb2xkZXIgfHwgZGV0ZWN0RGFpbHlOb3Rlc0ZvbGRlcih0aGlzLmFwcCkpO1xuICAgIGNvbnN0IHBhdHRlcm4gPSBidWlsZERhdGVQYXR0ZXJuKHRoaXMuc2V0dGluZ3MuZGF0ZUZvcm1hdCwgeWVhciwgTnVtYmVyKG1vbnRoKSk7XG5cbiAgICAvLyBTY2FuIHZhdWx0IGZvbGRlciBmb3IgbWF0Y2hpbmcgZGFpbHkgbm90ZXNcbiAgICBjb25zdCBkYXRhID0gbmV3IE1hcDxudW1iZXIsIERheURhdGE+KCk7XG4gICAgY29uc3QgYWJzdHJhY3RGb2xkZXIgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoZm9sZGVyKTtcblxuICAgIGlmIChhYnN0cmFjdEZvbGRlcikge1xuICAgICAgLy8gQHRzLWlnbm9yZSDigJQgVEZvbGRlciBoYXMgY2hpbGRyZW5cbiAgICAgIGNvbnN0IGNoaWxkcmVuOiB1bmtub3duW10gPSBhYnN0cmFjdEZvbGRlci5jaGlsZHJlbiA/PyBbXTtcbiAgICAgIGZvciAoY29uc3QgY2hpbGQgb2YgY2hpbGRyZW4pIHtcbiAgICAgICAgaWYgKCEoY2hpbGQgaW5zdGFuY2VvZiBURmlsZSkpIGNvbnRpbnVlO1xuICAgICAgICBjb25zdCBtYXRjaCA9IGNoaWxkLm5hbWUubWF0Y2gocGF0dGVybik7XG4gICAgICAgIGlmICghbWF0Y2gpIGNvbnRpbnVlO1xuICAgICAgICBjb25zdCBkYXkgPSBwYXJzZUludChtYXRjaFsxXSwgMTApO1xuXG4gICAgICAgIGNvbnN0IGNoaWxkRm0gPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShjaGlsZCk/LmZyb250bWF0dGVyO1xuICAgICAgICBsZXQgdmFsdWU6IHVua25vd24gPSB1bmRlZmluZWQ7XG5cbiAgICAgICAgaWYgKGNvbmZpZy5wcm9wZXJ0eSA9PT0gbnVsbCB8fCBjb25maWcucHJvcGVydHkgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIC8vIEZpbGUtZXhpc3RlbmNlIG1vZGUgKGUuZy4gTW9ybmluZyBKb3VybmFsIGZvbGRlcilcbiAgICAgICAgICB2YWx1ZSA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFsdWUgPSBjaGlsZEZtPy5bY29uZmlnLnByb3BlcnR5XTtcbiAgICAgICAgfVxuXG4gICAgICAgIGRhdGEuc2V0KGRheSwgeyBkYXksIHZhbHVlLCBmaWxlUGF0aDogY2hpbGQucGF0aCB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCByZW5kZXJlZCA9IHJlbmRlclRyYWNrZXIoY29uZmlnLCBkYXRhLCBkYXlzSW5Nb250aCk7XG4gICAgZWwuYXBwZW5kQ2hpbGQocmVuZGVyZWQpO1xuICB9XG5cbiAgYXN5bmMgbG9hZFNldHRpbmdzKCkge1xuICAgIHRoaXMuc2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKHt9LCBERUZBVUxUX1NFVFRJTkdTLCBhd2FpdCB0aGlzLmxvYWREYXRhKCkpO1xuICB9XG5cbiAgYXN5bmMgc2F2ZVNldHRpbmdzKCkge1xuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zZXR0aW5ncyk7XG4gIH1cbn1cbiJdLCJuYW1lcyI6WyJQbHVnaW5TZXR0aW5nVGFiIiwiU2V0dGluZyIsIlBsdWdpbiIsInBhcnNlWWFtbCIsIlRGaWxlIl0sIm1hcHBpbmdzIjoiOzs7O0FBNENPLE1BQU0sZ0JBQWdCLEdBQW1CO0FBQzlDLElBQUEsZ0JBQWdCLEVBQUUsRUFBRTtBQUNwQixJQUFBLFVBQVUsRUFBRSxZQUFZO0NBQ3pCOztBQ3pCRCxNQUFNLEVBQUUsR0FBYTtBQUNuQixJQUFBLFdBQVcsRUFBRSx1QkFBdUI7QUFDcEMsSUFBQSxjQUFjLEVBQUUsNkRBQTZEO0FBQzdFLElBQUEsa0JBQWtCLEVBQUUsa0NBQWtDO0FBQ3RELElBQUEsZ0JBQWdCLEVBQUUsK0RBQStEO0FBQ2pGLElBQUEsb0JBQW9CLEVBQUUsNkJBQTZCO0FBQ25ELElBQUEsbUJBQW1CLEVBQUUsMERBQTBEO0FBQy9FLElBQUEsZ0JBQWdCLEVBQUUsbURBQW1EO0lBQ3JFLGVBQWUsRUFBRSxDQUFDLEtBQUssS0FBSyxDQUFBLGVBQUEsRUFBa0IsS0FBSyxDQUFpQixlQUFBLENBQUE7QUFDcEUsSUFBQSxjQUFjLEVBQUUsb0RBQW9EO0lBQ3BFLGVBQWUsRUFBRSxDQUFDLEtBQUssS0FBSyxDQUFBLGtDQUFBLEVBQXFDLEtBQUssQ0FBRyxDQUFBLENBQUE7QUFDekUsSUFBQSxnQkFBZ0IsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEtBQUssQ0FBd0MscUNBQUEsRUFBQSxJQUFJLENBQUssRUFBQSxFQUFBLElBQUksQ0FBRyxDQUFBLENBQUE7QUFDMUYsSUFBQSxVQUFVLEVBQUUsS0FBSztBQUNqQixJQUFBLFVBQVUsRUFBRSxPQUFPO0FBQ25CLElBQUEsa0JBQWtCLEVBQUUsb0JBQW9CO0FBQ3hDLElBQUEsa0JBQWtCLEVBQUUsb0RBQW9EO0FBQ3hFLElBQUEsc0JBQXNCLEVBQUUsYUFBYTtBQUNyQyxJQUFBLHNCQUFzQixFQUFFLDBFQUEwRTtDQUNuRyxDQUFDO0FBRUYsTUFBTSxFQUFFLEdBQWE7QUFDbkIsSUFBQSxXQUFXLEVBQUUsb0JB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
