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
    return obsidian.getLanguage() === 'ko' ? 'ko' : 'en';
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
            // eslint-disable-next-line obsidianmd/ui/sentence-case -- folder path example, not prose
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
            // eslint-disable-next-line obsidianmd/ui/sentence-case -- date-format token, must stay uppercase
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
        ? activeDocument.createElement('a')
        : activeDocument.createElement('div');
    el.classList.add('monthly-tracker-cell', active ? 'is-active' : 'is-empty');
    if (bgColor)
        el.style.backgroundColor = bgColor;
    if (filePath) {
        const anchor = el;
        anchor.classList.add('internal-link');
        anchor.setAttribute('href', filePath);
        anchor.dataset.href = filePath;
    }
    if (tooltip)
        obsidian.setTooltip(el, tooltip);
    el.textContent = String(day);
    return el;
}
function wrapGrid(cells) {
    const row = activeDocument.createElement('div');
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
        const raw = entry === null || entry === void 0 ? void 0 : entry.value;
        // Only scalar frontmatter values map to a color key; objects/arrays are ignored.
        const key = typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean'
            ? String(raw)
            : undefined;
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
    const fillColor = (_b = colors[colors.length - 1]) !== null && _b !== void 0 ? _b : '';
    const padding = new Array(Math.max(0, maxIntensity + 1 - colors.length)).fill(fillColor);
    const safeColors = colors.length >= maxIntensity + 1 ? colors : [...colors, ...padding];
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
    const container = activeDocument.createElement('div');
    if (config.showTotal) {
        const label = (_c = config.totalLabel) !== null && _c !== void 0 ? _c : t().totalLabel;
        const summary = activeDocument.createElement('div');
        summary.classList.add('monthly-tracker-summary');
        summary.textContent = `${label}: `;
        const value = activeDocument.createElement('span');
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
    const container = activeDocument.createElement('div');
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
    const a = app;
    const internal = (_e = (_d = (_c = (_b = (_a = a.internalPlugins) === null || _a === void 0 ? void 0 : _a.plugins) === null || _b === void 0 ? void 0 : _b['daily-notes']) === null || _c === void 0 ? void 0 : _c.instance) === null || _d === void 0 ? void 0 : _d.options) === null || _e === void 0 ? void 0 : _e.folder;
    if (internal)
        return internal;
    const periodic = (_k = (_j = (_h = (_g = (_f = a.plugins) === null || _f === void 0 ? void 0 : _f.plugins) === null || _g === void 0 ? void 0 : _g['periodic-notes']) === null || _h === void 0 ? void 0 : _h.settings) === null || _j === void 0 ? void 0 : _j.daily) === null || _k === void 0 ? void 0 : _k.folder;
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
        const folder = obsidian.normalizePath((_b = config.source) !== null && _b !== void 0 ? _b : (this.settings.dailyNotesFolder || detectDailyNotesFolder(this.app)));
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
                // File-existence mode (property omitted) marks every matching note as true.
                const value = config.property == null ? true : childFm === null || childFm === void 0 ? void 0 : childFm[config.property];
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
            void this.app.workspace.openLinkText(path, ctx.sourcePath, evt.ctrlKey || evt.metaKey);
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
        const data = (await this.loadData());
        this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
    }
    async saveSettings() {
        await this.saveData(this.settings);
    }
}

module.exports = MonthlyTrackerPlugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsic3JjL3R5cGVzLnRzIiwic3JjL2kxOG4udHMiLCJzcmMvc2V0dGluZ3MudHMiLCJzcmMvcHJlc2V0cy50cyIsInNyYy9yZW5kZXJlci50cyIsInNyYy9tYWluLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBpbnRlcmZhY2UgQm9vbGVhbkNvbmZpZyB7XG4gIHR5cGU6ICdib29sZWFuJztcbiAgdGl0bGU/OiBzdHJpbmc7XG4gIHByb3BlcnR5Pzogc3RyaW5nO1xuICBzb3VyY2U/OiBzdHJpbmc7XG4gIC8qKiBoZXggY29sb3Igc3RyaW5nIG9yIHByZXNldCBuYW1lIChlLmcuIFwiYmx1ZVwiKSAqL1xuICBjb2xvcjogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIENvbG9ybWFwQ29uZmlnIHtcbiAgdHlwZTogJ2NvbG9ybWFwJztcbiAgdGl0bGU/OiBzdHJpbmc7XG4gIHByb3BlcnR5OiBzdHJpbmc7XG4gIHNvdXJjZT86IHN0cmluZztcbiAgY29sb3JzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEhlYXRtYXBDb25maWcge1xuICB0eXBlOiAnaGVhdG1hcCc7XG4gIHRpdGxlPzogc3RyaW5nO1xuICBwcm9wZXJ0eTogc3RyaW5nO1xuICBzb3VyY2U/OiBzdHJpbmc7XG4gIHVuaXQ/OiBzdHJpbmc7XG4gIC8qKlxuICAgKiBUaHJlc2hvbGRzIHNlcGFyYXRpbmcgaW50ZW5zaXR5IGxldmVscy5cbiAgICogZS5nLiBbMywgNSwgNywgMTBdIOKGkiA1IGJ1Y2tldHM6IFswLDMpLCBbMyw1KSwgWzUsNyksIFs3LDEwKSwgWzEwLOKInilcbiAgICovXG4gIGJpbnM/OiBudW1iZXJbXTtcbiAgLyoqIGFycmF5IG9mIGhleCBjb2xvcnMsIGxlbmd0aCA9IGJpbnMubGVuZ3RoICsgMSwgb3Igb21pdCBhbmQgdXNlIGNvbG9yU2NoZW1lICovXG4gIGNvbG9ycz86IHN0cmluZ1tdO1xuICAvKiogYnVpbHQtaW4gaGVhdG1hcCBjb2xvciBzY2hlbWUgbmFtZSAoZS5nLiBcImluZGlnb1wiKSAqL1xuICBjb2xvclNjaGVtZT86IHN0cmluZztcbiAgc2hvd1RvdGFsPzogYm9vbGVhbjtcbiAgLyoqIGxhYmVsIHNob3duIG5leHQgdG8gdG90YWwsIGRlZmF1bHRzIHRvIHByb3BlcnR5IG5hbWUgKi9cbiAgdG90YWxMYWJlbD86IHN0cmluZztcbn1cblxuZXhwb3J0IHR5cGUgVHJhY2tlckNvbmZpZyA9IEJvb2xlYW5Db25maWcgfCBDb2xvcm1hcENvbmZpZyB8IEhlYXRtYXBDb25maWc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGx1Z2luU2V0dGluZ3Mge1xuICBkYWlseU5vdGVzRm9sZGVyOiBzdHJpbmc7XG4gIGRhdGVGb3JtYXQ6IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IERFRkFVTFRfU0VUVElOR1M6IFBsdWdpblNldHRpbmdzID0ge1xuICBkYWlseU5vdGVzRm9sZGVyOiAnJyxcbiAgZGF0ZUZvcm1hdDogJ1lZWVktTU0tREQnLFxufTtcbiIsImltcG9ydCB7IGdldExhbmd1YWdlIH0gZnJvbSAnb2JzaWRpYW4nO1xuXG50eXBlIExvY2FsZSA9ICdlbicgfCAna28nO1xuXG5leHBvcnQgaW50ZXJmYWNlIE1lc3NhZ2VzIHtcbiAgZXJyb3JQcmVmaXg6IHN0cmluZztcbiAgZXJyTWlzc2luZ1R5cGU6IHN0cmluZztcbiAgZXJyTWlzc2luZ1Byb3BlcnR5OiBzdHJpbmc7XG4gIGVyck1pc3NpbmdDb2xvcnM6IHN0cmluZztcbiAgZXJyQ2Fubm90UmVzb2x2ZUZpbGU6IHN0cmluZztcbiAgZXJyTWlzc2luZ1llYXJNb250aDogc3RyaW5nO1xuICBlcnJZZWFyTW9udGhUeXBlOiBzdHJpbmc7XG4gIGVyckludmFsaWRNb250aDogKG1vbnRoOiBudW1iZXIpID0+IHN0cmluZztcbiAgZXJySGVhdG1hcEJpbnM6IHN0cmluZztcbiAgZXJyQmluc1Bvc2l0aXZlOiAodmFsdWU6IG51bWJlcikgPT4gc3RyaW5nO1xuICBlcnJCaW5zQXNjZW5kaW5nOiAocHJldjogbnVtYmVyLCBuZXh0OiBudW1iZXIpID0+IHN0cmluZztcbiAgdG9vbHRpcFllczogc3RyaW5nO1xuICB0b3RhbExhYmVsOiBzdHJpbmc7XG4gIHNldHRpbmdzRm9sZGVyTmFtZTogc3RyaW5nO1xuICBzZXR0aW5nc0ZvbGRlckRlc2M6IHN0cmluZztcbiAgc2V0dGluZ3NEYXRlRm9ybWF0TmFtZTogc3RyaW5nO1xuICBzZXR0aW5nc0RhdGVGb3JtYXREZXNjOiBzdHJpbmc7XG59XG5cbmNvbnN0IGVuOiBNZXNzYWdlcyA9IHtcbiAgZXJyb3JQcmVmaXg6ICdNb250aGx5IFRyYWNrZXIgRXJyb3InLFxuICBlcnJNaXNzaW5nVHlwZTogJ01pc3NpbmcgcmVxdWlyZWQgZmllbGQ6IHR5cGUgKGJvb2xlYW4gfCBjb2xvcm1hcCB8IGhlYXRtYXApJyxcbiAgZXJyTWlzc2luZ1Byb3BlcnR5OiAnTWlzc2luZyByZXF1aXJlZCBmaWVsZDogcHJvcGVydHknLFxuICBlcnJNaXNzaW5nQ29sb3JzOiAnTWlzc2luZyByZXF1aXJlZCBmaWVsZDogY29sb3JzIChlLmcuIGNvbG9yczoge3ZhbHVlOiBcIiNoZXhcIn0pJyxcbiAgZXJyQ2Fubm90UmVzb2x2ZUZpbGU6ICdDYW5ub3QgcmVzb2x2ZSBjdXJyZW50IGZpbGUnLFxuICBlcnJNaXNzaW5nWWVhck1vbnRoOiBcIkN1cnJlbnQgbm90ZSBtdXN0IGhhdmUgJ3llYXInIGFuZCAnbW9udGgnIGluIGZyb250bWF0dGVyXCIsXG4gIGVyclllYXJNb250aFR5cGU6IFwiJ3llYXInIGFuZCAnbW9udGgnIG11c3QgYmUgbnVtYmVycyBpbiBmcm9udG1hdHRlclwiLFxuICBlcnJJbnZhbGlkTW9udGg6IChtb250aCkgPT4gYEludmFsaWQgbW9udGg6ICR7bW9udGh9IChtdXN0IGJlIDHigJMxMilgLFxuICBlcnJIZWF0bWFwQmluczogJ2hlYXRtYXAgcmVxdWlyZXMgXCJiaW5zXCIgKGUuZy4gYmluczogWzMsIDUsIDcsIDEwXSknLFxuICBlcnJCaW5zUG9zaXRpdmU6ICh2YWx1ZSkgPT4gYGJpbnMgdmFsdWVzIG11c3QgYmUgcG9zaXRpdmUgKGdvdCAke3ZhbHVlfSlgLFxuICBlcnJCaW5zQXNjZW5kaW5nOiAocHJldiwgbmV4dCkgPT4gYGJpbnMgbXVzdCBiZSBpbiBhc2NlbmRpbmcgb3JkZXIgKGdvdCAke3ByZXZ9LCAke25leHR9KWAsXG4gIHRvb2x0aXBZZXM6ICdZZXMnLFxuICB0b3RhbExhYmVsOiAnVG90YWwnLFxuICBzZXR0aW5nc0ZvbGRlck5hbWU6ICdEYWlseSBub3RlcyBmb2xkZXInLFxuICBzZXR0aW5nc0ZvbGRlckRlc2M6ICdGb2xkZXIgY29udGFpbmluZyBkYWlseSBub3RlcyAoZS5nLiBDYWxlbmRhci9EYXlzKScsXG4gIHNldHRpbmdzRGF0ZUZvcm1hdE5hbWU6ICdEYXRlIGZvcm1hdCcsXG4gIHNldHRpbmdzRGF0ZUZvcm1hdERlc2M6ICdGaWxlIG5hbWUgZGF0ZSBmb3JtYXQuIE11c3QgbWF0Y2ggWVlZWS1NTS1ERCBhdCB0aGUgc3RhcnQgb2YgZmlsZSBuYW1lcy4nLFxufTtcblxuY29uc3Qga286IE1lc3NhZ2VzID0ge1xuICBlcnJvclByZWZpeDogJ01vbnRobHkgVHJhY2tlciDsmKTrpZgnLFxuICBlcnJNaXNzaW5nVHlwZTogJ+2VhOyImCDtla3rqqkg64iE6529OiB0eXBlIChib29sZWFuIHwgY29sb3JtYXAgfCBoZWF0bWFwKScsXG4gIGVyck1pc3NpbmdQcm9wZXJ0eTogJ+2VhOyImCDtla3rqqkg64iE6529OiBwcm9wZXJ0eScsXG4gIGVyck1pc3NpbmdDb2xvcnM6ICftlYTsiJgg7ZWt66qpIOuIhOudvTogY29sb3JzICjsmIg6IGNvbG9yczoge3ZhbHVlOiBcIiNoZXhcIn0pJyxcbiAgZXJyQ2Fubm90UmVzb2x2ZUZpbGU6ICftmITsnqwg7YyM7J287J2EIOywvuydhCDsiJgg7JeG7Iq164uI64ukJyxcbiAgZXJyTWlzc2luZ1llYXJNb250aDogXCLtmITsnqwg64W47Yq47J2YIO2UhOuhoO2KuOunpO2EsOyXkCAneWVhcifsmYAgJ21vbnRoJ+qwgCDsnojslrTslbwg7ZWp64uI64ukXCIsXG4gIGVyclllYXJNb250aFR5cGU6IFwi7ZSE66Gg7Yq466ek7YSw7J2YICd5ZWFyJ+yZgCAnbW9udGgn64qUIOyIq+yekOyXrOyVvCDtlanri4jri6RcIixcbiAgZXJySW52YWxpZE1vbnRoOiAobW9udGgpID0+IGDsnpjrqrvrkJwgbW9udGg6ICR7bW9udGh9ICgx4oCTMTIg7IKs7J207Jes7JW8IO2VqeuLiOuLpClgLFxuICBlcnJIZWF0bWFwQmluczogJ2hlYXRtYXDsl5DripQgXCJiaW5zXCLqsIAg7ZWE7JqU7ZWp64uI64ukICjsmIg6IGJpbnM6IFszLCA1LCA3LCAxMF0pJyxcbiAgZXJyQmluc1Bvc2l0aXZlOiAodmFsdWUpID0+IGBiaW5zIOqwkuydgCDslpHsiJjsl6zslbwg7ZWp64uI64ukICjsnoXroKXqsJI6ICR7dmFsdWV9KWAsXG4gIGVyckJpbnNBc2NlbmRpbmc6IChwcmV2LCBuZXh0KSA9PiBgYmluc+uKlCDsmKTrpoTssKjsiJzsnbTslrTslbwg7ZWp64uI64ukICjsnoXroKXqsJI6ICR7cHJldn0sICR7bmV4dH0pYCxcbiAgdG9vbHRpcFllczogJ+yZhOujjCcsXG4gIHRvdGFsTGFiZWw6ICftlanqs4QnLFxuICBzZXR0aW5nc0ZvbGRlck5hbWU6ICfrjbDsnbzrpqwg64W47Yq4IO2PtOuNlCcsXG4gIHNldHRpbmdzRm9sZGVyRGVzYzogJ+uNsOydvOumrCDrhbjtirjqsIAg65Ok7Ja0IOyeiOuKlCDtj7TrjZQgKOyYiDogQ2FsZW5kYXIvRGF5cyknLFxuICBzZXR0aW5nc0RhdGVGb3JtYXROYW1lOiAn64Kg7KecIO2YleyLnScsXG4gIHNldHRpbmdzRGF0ZUZvcm1hdERlc2M6ICftjIzsnbwg7J2066aE7J2YIOuCoOynnCDtmJXsi50uIO2MjOydvCDsnbTrpoQg7JWe67aA67aE7J20IFlZWVktTU0tRETsmYAg7J287LmY7ZW07JW8IO2VqeuLiOuLpC4nLFxufTtcblxuZnVuY3Rpb24gY3VycmVudExvY2FsZSgpOiBMb2NhbGUge1xuICByZXR1cm4gZ2V0TGFuZ3VhZ2UoKSA9PT0gJ2tvJyA/ICdrbycgOiAnZW4nO1xufVxuXG4vKiogUmV0dXJucyB0aGUgbWVzc2FnZSB0YWJsZSBmb3IgdGhlIGN1cnJlbnQgT2JzaWRpYW4gVUkgbGFuZ3VhZ2UuICovXG5leHBvcnQgZnVuY3Rpb24gdCgpOiBNZXNzYWdlcyB7XG4gIHJldHVybiBjdXJyZW50TG9jYWxlKCkgPT09ICdrbycgPyBrbyA6IGVuO1xufVxuIiwiaW1wb3J0IHsgQXBwLCBQbHVnaW5TZXR0aW5nVGFiLCBTZXR0aW5nIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHR5cGUgTW9udGhseVRyYWNrZXJQbHVnaW4gZnJvbSAnLi9tYWluJztcbmltcG9ydCB7IHQgfSBmcm9tICcuL2kxOG4nO1xuXG5leHBvcnQgY2xhc3MgTW9udGhseVRyYWNrZXJTZXR0aW5nVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG4gIHBsdWdpbjogTW9udGhseVRyYWNrZXJQbHVnaW47XG5cbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHBsdWdpbjogTW9udGhseVRyYWNrZXJQbHVnaW4pIHtcbiAgICBzdXBlcihhcHAsIHBsdWdpbik7XG4gICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG4gIH1cblxuICBkaXNwbGF5KCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XG4gICAgY29uc3QgbSA9IHQoKTtcbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShtLnNldHRpbmdzRm9sZGVyTmFtZSlcbiAgICAgIC5zZXREZXNjKG0uc2V0dGluZ3NGb2xkZXJEZXNjKVxuICAgICAgLmFkZFRleHQodGV4dCA9PlxuICAgICAgICB0ZXh0XG4gICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG9ic2lkaWFubWQvdWkvc2VudGVuY2UtY2FzZSAtLSBmb2xkZXIgcGF0aCBleGFtcGxlLCBub3QgcHJvc2VcbiAgICAgICAgICAuc2V0UGxhY2Vob2xkZXIoJ0NhbGVuZGFyL0RheXMnKVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5kYWlseU5vdGVzRm9sZGVyKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmRhaWx5Tm90ZXNGb2xkZXIgPSB2YWx1ZS50cmltKCk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KSxcbiAgICAgICk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKG0uc2V0dGluZ3NEYXRlRm9ybWF0TmFtZSlcbiAgICAgIC5zZXREZXNjKG0uc2V0dGluZ3NEYXRlRm9ybWF0RGVzYylcbiAgICAgIC5hZGRUZXh0KHRleHQgPT5cbiAgICAgICAgdGV4dFxuICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBvYnNpZGlhbm1kL3VpL3NlbnRlbmNlLWNhc2UgLS0gZGF0ZS1mb3JtYXQgdG9rZW4sIG11c3Qgc3RheSB1cHBlcmNhc2VcbiAgICAgICAgICAuc2V0UGxhY2Vob2xkZXIoJ1lZWVktTU0tREQnKVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5kYXRlRm9ybWF0KVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmRhdGVGb3JtYXQgPSB2YWx1ZS50cmltKCk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KSxcbiAgICAgICk7XG4gIH1cbn1cbiIsIi8qKiBTaW5nbGUtY29sb3IgcHJlc2V0cyBmb3IgYm9vbGVhbiB0cmFja2VyICovXG5leHBvcnQgY29uc3QgQ09MT1JfUFJFU0VUUzogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgYmx1ZTogJyM2NGI1ZjYnLFxuICBncmVlbjogJyM2NmJiNmEnLFxuICByZWQ6ICcjZTU3MzczJyxcbiAgcHVycGxlOiAnI2JhNjhjOCcsXG4gIG9yYW5nZTogJyNmZmI3NGQnLFxuICB5ZWxsb3c6ICcjZmZkNTRmJyxcbiAgdGVhbDogJyM0ZGI2YWMnLFxuICBpbmRpZ286ICcjNzk4NmNiJyxcbiAgcGluazogJyNmMDYyOTInLFxufTtcblxuLyoqXG4gKiBIZWF0bWFwIGNvbG9yLXNjaGVtZSBwcmVzZXRzLlxuICogSW5kZXggMCA9IG5vIGRhdGEsIGluZGV4IDEuLm4gPSBpbmNyZWFzaW5nIGludGVuc2l0eS5cbiAqL1xuZXhwb3J0IGNvbnN0IEhFQVRNQVBfU0NIRU1FUzogUmVjb3JkPHN0cmluZywgc3RyaW5nW10+ID0ge1xuICBibHVlOiBbJyNlYmVkZjAnLCAnI2JiZGVmYicsICcjOTBjYWY5JywgJyM2NGI1ZjYnLCAnIzQyYTVmNScsICcjMWU4OGU1J10sXG4gIGdyZWVuOiBbJyNlYmVkZjAnLCAnI2M4ZTZjOScsICcjYTVkNmE3JywgJyM4MWM3ODQnLCAnIzY2YmI2YScsICcjNDNhMDQ3J10sXG4gIHJlZDogWycjZWJlZGYwJywgJyNmZmNkZDInLCAnI2VmOWE5YScsICcjZTU3MzczJywgJyNlZjUzNTAnLCAnI2U1MzkzNSddLFxuICBwdXJwbGU6IFsnI2ViZWRmMCcsICcjZTFiZWU3JywgJyNjZTkzZDgnLCAnI2JhNjhjOCcsICcjYWI0N2JjJywgJyM4ZTI0YWEnXSxcbiAgb3JhbmdlOiBbJyNlYmVkZjAnLCAnI2ZmZTBiMicsICcjZmZjYzgwJywgJyNmZmI3NGQnLCAnI2ZmYTcyNicsICcjZmI4YzAwJ10sXG4gIHllbGxvdzogWycjZWJlZGYwJywgJyNmZmY5YzQnLCAnI2ZmZjU5ZCcsICcjZmZmMTc2JywgJyNmZmVlNTgnLCAnI2ZkZDgzNSddLFxuICB0ZWFsOiBbJyNlYmVkZjAnLCAnI2IyZGZkYicsICcjODBjYmM0JywgJyM0ZGI2YWMnLCAnIzI2YTY5YScsICcjMDA4OTdiJ10sXG4gIGluZGlnbzogWycjZWJlZGYwJywgJyNlOGVhZjYnLCAnI2M1Y2FlOScsICcjOWZhOGRhJywgJyM3OTg2Y2InLCAnIzVjNmJjMCddLFxuICBwaW5rOiBbJyNlYmVkZjAnLCAnI2ZjZTRlYycsICcjZjQ4ZmIxJywgJyNmMDYyOTInLCAnI2VjNDA3YScsICcjZDgxYjYwJ10sXG59O1xuXG4vKiogUmVzb2x2ZSBhIGNvbG9yIHN0cmluZzogaWYgaXQncyBhIGtub3duIHByZXNldCBuYW1lLCByZXR1cm4gdGhlIGhleDsgb3RoZXJ3aXNlIHJldHVybiBhcy1pcy4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlQ29sb3IoY29sb3I/OiBzdHJpbmcpOiBzdHJpbmcge1xuICBpZiAoIWNvbG9yKSByZXR1cm4gQ09MT1JfUFJFU0VUUy5ibHVlO1xuICByZXR1cm4gQ09MT1JfUFJFU0VUU1tjb2xvci50b0xvd2VyQ2FzZSgpXSA/PyBjb2xvcjtcbn1cblxuLyoqIFJlc29sdmUgaGVhdG1hcCBjb2xvcnMgYXJyYXkgZnJvbSBjb2xvclNjaGVtZSBwcmVzZXQgb3IgZXhwbGljaXQgY29sb3JzIGFycmF5LiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVIZWF0bWFwQ29sb3JzKGNvbG9ycz86IHN0cmluZ1tdLCBjb2xvclNjaGVtZT86IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgaWYgKGNvbG9ycyAmJiBjb2xvcnMubGVuZ3RoID4gMCkgcmV0dXJuIGNvbG9ycztcbiAgaWYgKGNvbG9yU2NoZW1lKSB7XG4gICAgY29uc3Qgc2NoZW1lID0gSEVBVE1BUF9TQ0hFTUVTW2NvbG9yU2NoZW1lLnRvTG93ZXJDYXNlKCldO1xuICAgIGlmIChzY2hlbWUpIHJldHVybiBzY2hlbWU7XG4gIH1cbiAgcmV0dXJuIEhFQVRNQVBfU0NIRU1FU1snaW5kaWdvJ107XG59XG5cbiIsImltcG9ydCB7IHNldFRvb2x0aXAgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBUcmFja2VyQ29uZmlnLCBCb29sZWFuQ29uZmlnLCBDb2xvcm1hcENvbmZpZywgSGVhdG1hcENvbmZpZyB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgcmVzb2x2ZUNvbG9yLCByZXNvbHZlSGVhdG1hcENvbG9ycyB9IGZyb20gJy4vcHJlc2V0cyc7XG5pbXBvcnQgeyB0IH0gZnJvbSAnLi9pMThuJztcblxuZXhwb3J0IGludGVyZmFjZSBEYXlEYXRhIHtcbiAgZGF5OiBudW1iZXI7XG4gIHZhbHVlOiB1bmtub3duO1xuICBmaWxlUGF0aD86IHN0cmluZztcbn1cblxuLyoqXG4gKiBCdWlsZCBhIHNpbmdsZSBkYXkgY2VsbC5cbiAqIEBwYXJhbSBiZ0NvbG9yIGlubGluZSBiYWNrZ3JvdW5kIGNvbG9yIGZvciBhY3RpdmUgY2VsbHM7IG51bGwgbGV0cyB0aGUgdGhlbWVcbiAqICAgKGAuaXMtZW1wdHlgKSBzdHlsZSBlbXB0eSBjZWxscyBzbyBkYXJrIG1vZGUgaXMgcmVzcGVjdGVkLlxuICovXG5mdW5jdGlvbiBkYXlDZWxsKFxuICBkYXk6IG51bWJlcixcbiAgYmdDb2xvcjogc3RyaW5nIHwgbnVsbCxcbiAgYWN0aXZlOiBib29sZWFuLFxuICBmaWxlUGF0aDogc3RyaW5nIHwgdW5kZWZpbmVkLFxuICB0b29sdGlwOiBzdHJpbmcsXG4pOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IGVsOiBIVE1MRWxlbWVudCA9IGZpbGVQYXRoXG4gICAgPyBhY3RpdmVEb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJylcbiAgICA6IGFjdGl2ZURvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXG4gIGVsLmNsYXNzTGlzdC5hZGQoJ21vbnRobHktdHJhY2tlci1jZWxsJywgYWN0aXZlID8gJ2lzLWFjdGl2ZScgOiAnaXMtZW1wdHknKTtcbiAgaWYgKGJnQ29sb3IpIGVsLnN0eWxlLmJhY2tncm91bmRDb2xvciA9IGJnQ29sb3I7XG5cbiAgaWYgKGZpbGVQYXRoKSB7XG4gICAgY29uc3QgYW5jaG9yID0gZWwgYXMgSFRNTEFuY2hvckVsZW1lbnQ7XG4gICAgYW5jaG9yLmNsYXNzTGlzdC5hZGQoJ2ludGVybmFsLWxpbmsnKTtcbiAgICBhbmNob3Iuc2V0QXR0cmlidXRlKCdocmVmJywgZmlsZVBhdGgpO1xuICAgIGFuY2hvci5kYXRhc2V0LmhyZWYgPSBmaWxlUGF0aDtcbiAgfVxuXG4gIGlmICh0b29sdGlwKSBzZXRUb29sdGlwKGVsLCB0b29sdGlwKTtcbiAgZWwudGV4dENvbnRlbnQgPSBTdHJpbmcoZGF5KTtcbiAgcmV0dXJuIGVsO1xufVxuXG5mdW5jdGlvbiB3cmFwR3JpZChjZWxsczogSFRNTEVsZW1lbnRbXSk6IEhUTUxFbGVtZW50IHtcbiAgY29uc3Qgcm93ID0gYWN0aXZlRG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIHJvdy5jbGFzc0xpc3QuYWRkKCdtb250aGx5LXRyYWNrZXItcm93Jyk7XG4gIGZvciAoY29uc3QgY2VsbCBvZiBjZWxscykgcm93LmFwcGVuZENoaWxkKGNlbGwpO1xuICByZXR1cm4gcm93O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyQm9vbGVhbihjb25maWc6IEJvb2xlYW5Db25maWcsIGRhdGE6IE1hcDxudW1iZXIsIERheURhdGE+LCBkYXlzSW5Nb250aDogbnVtYmVyKTogSFRNTEVsZW1lbnQge1xuICBjb25zdCBhY3RpdmVDb2xvciA9IHJlc29sdmVDb2xvcihjb25maWcuY29sb3IpO1xuICBjb25zdCBjZWxsczogSFRNTEVsZW1lbnRbXSA9IFtdO1xuXG4gIGZvciAobGV0IGRheSA9IDE7IGRheSA8PSBkYXlzSW5Nb250aDsgZGF5KyspIHtcbiAgICBjb25zdCBlbnRyeSA9IGRhdGEuZ2V0KGRheSk7XG4gICAgY29uc3QgYWN0aXZlID0gZW50cnkgIT09IHVuZGVmaW5lZCAmJiAhIWVudHJ5LnZhbHVlO1xuICAgIGNlbGxzLnB1c2goZGF5Q2VsbChkYXksIGFjdGl2ZSA/IGFjdGl2ZUNvbG9yIDogbnVsbCwgYWN0aXZlLCBlbnRyeT8uZmlsZVBhdGgsIGFjdGl2ZSA/IHQoKS50b29sdGlwWWVzIDogJycpKTtcbiAgfVxuXG4gIHJldHVybiB3cmFwR3JpZChjZWxscyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJDb2xvcm1hcChjb25maWc6IENvbG9ybWFwQ29uZmlnLCBkYXRhOiBNYXA8bnVtYmVyLCBEYXlEYXRhPiwgZGF5c0luTW9udGg6IG51bWJlcik6IEhUTUxFbGVtZW50IHtcbiAgY29uc3QgY29sb3JNYXAgPSBjb25maWcuY29sb3JzO1xuICBjb25zdCBjZWxsczogSFRNTEVsZW1lbnRbXSA9IFtdO1xuXG4gIGZvciAobGV0IGRheSA9IDE7IGRheSA8PSBkYXlzSW5Nb250aDsgZGF5KyspIHtcbiAgICBjb25zdCBlbnRyeSA9IGRhdGEuZ2V0KGRheSk7XG4gICAgY29uc3QgcmF3ID0gZW50cnk/LnZhbHVlO1xuICAgIC8vIE9ubHkgc2NhbGFyIGZyb250bWF0dGVyIHZhbHVlcyBtYXAgdG8gYSBjb2xvciBrZXk7IG9iamVjdHMvYXJyYXlzIGFyZSBpZ25vcmVkLlxuICAgIGNvbnN0IGtleSA9IHR5cGVvZiByYXcgPT09ICdzdHJpbmcnIHx8IHR5cGVvZiByYXcgPT09ICdudW1iZXInIHx8IHR5cGVvZiByYXcgPT09ICdib29sZWFuJ1xuICAgICAgPyBTdHJpbmcocmF3KVxuICAgICAgOiB1bmRlZmluZWQ7XG4gICAgY29uc3QgbWFwcGVkQ29sb3IgPSBrZXkgIT0gbnVsbCA/IGNvbG9yTWFwW2tleV0gOiB1bmRlZmluZWQ7XG4gICAgY2VsbHMucHVzaChkYXlDZWxsKGRheSwgbWFwcGVkQ29sb3IgPz8gbnVsbCwgISFtYXBwZWRDb2xvciwgZW50cnk/LmZpbGVQYXRoLCBrZXkgPz8gJycpKTtcbiAgfVxuXG4gIHJldHVybiB3cmFwR3JpZChjZWxscyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJIZWF0bWFwKGNvbmZpZzogSGVhdG1hcENvbmZpZywgZGF0YTogTWFwPG51bWJlciwgRGF5RGF0YT4sIGRheXNJbk1vbnRoOiBudW1iZXIpOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IGNvbG9ycyA9IHJlc29sdmVIZWF0bWFwQ29sb3JzKGNvbmZpZy5jb2xvcnMsIGNvbmZpZy5jb2xvclNjaGVtZSk7XG4gIC8vIGJpbnMgYXJlIHZhbGlkYXRlZCB1cHN0cmVhbSBpbiBwcm9jZXNzQmxvY2s7IG5vbi1udWxsIGFzc2VydGlvbiBpcyBzYWZlIGhlcmUuXG4gIGNvbnN0IGJpbnMgPSBjb25maWcuYmlucyE7XG4gIGNvbnN0IHVuaXQgPSBjb25maWcudW5pdCA/PyAnJztcblxuICBmdW5jdGlvbiBnZXRJbnRlbnNpdHkodmFsOiBudW1iZXIpOiBudW1iZXIge1xuICAgIGlmICh2YWwgPD0gMCkgcmV0dXJuIDA7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBiaW5zLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAodmFsIDwgYmluc1tpXSkgcmV0dXJuIGkgKyAxO1xuICAgIH1cbiAgICByZXR1cm4gYmlucy5sZW5ndGggKyAxO1xuICB9XG5cbiAgY29uc3QgbWF4SW50ZW5zaXR5ID0gYmlucy5sZW5ndGggKyAxO1xuICBjb25zdCBmaWxsQ29sb3IgPSBjb2xvcnNbY29sb3JzLmxlbmd0aCAtIDFdID8/ICcnO1xuICBjb25zdCBwYWRkaW5nID0gbmV3IEFycmF5PHN0cmluZz4oTWF0aC5tYXgoMCwgbWF4SW50ZW5zaXR5ICsgMSAtIGNvbG9ycy5sZW5ndGgpKS5maWxsKGZpbGxDb2xvcik7XG4gIGNvbnN0IHNhZmVDb2xvcnMgPSBjb2xvcnMubGVuZ3RoID49IG1heEludGVuc2l0eSArIDEgPyBjb2xvcnMgOiBbLi4uY29sb3JzLCAuLi5wYWRkaW5nXTtcblxuICBsZXQgdG90YWwgPSAwO1xuICBjb25zdCBjZWxsczogSFRNTEVsZW1lbnRbXSA9IFtdO1xuXG4gIGZvciAobGV0IGRheSA9IDE7IGRheSA8PSBkYXlzSW5Nb250aDsgZGF5KyspIHtcbiAgICBjb25zdCBlbnRyeSA9IGRhdGEuZ2V0KGRheSk7XG4gICAgY29uc3QgcmF3ID0gZW50cnk/LnZhbHVlO1xuICAgIGNvbnN0IHZhbCA9IHR5cGVvZiByYXcgPT09ICdudW1iZXInICYmIGlzRmluaXRlKHJhdykgPyByYXcgOiAwO1xuICAgIHRvdGFsICs9IHZhbDtcbiAgICBjb25zdCBpbnRlbnNpdHkgPSBnZXRJbnRlbnNpdHkodmFsKTtcbiAgICBjb25zdCBhY3RpdmUgPSBpbnRlbnNpdHkgPiAwO1xuICAgIGNvbnN0IGJnQ29sb3IgPSBhY3RpdmUgPyAoc2FmZUNvbG9yc1tpbnRlbnNpdHldIHx8IG51bGwpIDogbnVsbDtcbiAgICBjZWxscy5wdXNoKGRheUNlbGwoZGF5LCBiZ0NvbG9yLCBhY3RpdmUsIGVudHJ5Py5maWxlUGF0aCwgdmFsID4gMCA/IGAke3ZhbH0ke3VuaXR9YCA6ICcnKSk7XG4gIH1cblxuICBjb25zdCBjb250YWluZXIgPSBhY3RpdmVEb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblxuICBpZiAoY29uZmlnLnNob3dUb3RhbCkge1xuICAgIGNvbnN0IGxhYmVsID0gY29uZmlnLnRvdGFsTGFiZWwgPz8gdCgpLnRvdGFsTGFiZWw7XG4gICAgY29uc3Qgc3VtbWFyeSA9IGFjdGl2ZURvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIHN1bW1hcnkuY2xhc3NMaXN0LmFkZCgnbW9udGhseS10cmFja2VyLXN1bW1hcnknKTtcbiAgICBzdW1tYXJ5LnRleHRDb250ZW50ID0gYCR7bGFiZWx9OiBgO1xuICAgIGNvbnN0IHZhbHVlID0gYWN0aXZlRG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICAgIHZhbHVlLmNsYXNzTGlzdC5hZGQoJ21vbnRobHktdHJhY2tlci1zdW1tYXJ5LXZhbHVlJyk7XG4gICAgY29uc3QgZGlzcGxheVRvdGFsID0gTnVtYmVyLmlzSW50ZWdlcih0b3RhbCkgPyBTdHJpbmcodG90YWwpIDogdG90YWwudG9GaXhlZCgxKTtcbiAgICB2YWx1ZS50ZXh0Q29udGVudCA9IGAke2Rpc3BsYXlUb3RhbH0ke3VuaXR9YDtcbiAgICBzdW1tYXJ5LmFwcGVuZENoaWxkKHZhbHVlKTtcbiAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQoc3VtbWFyeSk7XG4gIH1cblxuICBjb250YWluZXIuYXBwZW5kQ2hpbGQod3JhcEdyaWQoY2VsbHMpKTtcbiAgcmV0dXJuIGNvbnRhaW5lcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlclRyYWNrZXIoXG4gIGNvbmZpZzogVHJhY2tlckNvbmZpZyxcbiAgZGF0YTogTWFwPG51bWJlciwgRGF5RGF0YT4sXG4gIGRheXNJbk1vbnRoOiBudW1iZXIsXG4pOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IGNvbnRhaW5lciA9IGFjdGl2ZURvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBjb250YWluZXIuY2xhc3NMaXN0LmFkZCgnbW9udGhseS10cmFja2VyJyk7XG5cbiAgbGV0IGlubmVyOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICBpZiAoY29uZmlnLnR5cGUgPT09ICdib29sZWFuJykge1xuICAgIGlubmVyID0gcmVuZGVyQm9vbGVhbihjb25maWcsIGRhdGEsIGRheXNJbk1vbnRoKTtcbiAgfSBlbHNlIGlmIChjb25maWcudHlwZSA9PT0gJ2NvbG9ybWFwJykge1xuICAgIGlubmVyID0gcmVuZGVyQ29sb3JtYXAoY29uZmlnLCBkYXRhLCBkYXlzSW5Nb250aCk7XG4gIH0gZWxzZSBpZiAoY29uZmlnLnR5cGUgPT09ICdoZWF0bWFwJykge1xuICAgIGlubmVyID0gcmVuZGVySGVhdG1hcChjb25maWcsIGRhdGEsIGRheXNJbk1vbnRoKTtcbiAgfVxuXG4gIGlmIChpbm5lcikgY29udGFpbmVyLmFwcGVuZENoaWxkKGlubmVyKTtcbiAgcmV0dXJuIGNvbnRhaW5lcjtcbn1cbiIsImltcG9ydCB7IEFwcCwgUGx1Z2luLCBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0LCBURmlsZSwgVEZvbGRlciwgcGFyc2VZYW1sLCBub3JtYWxpemVQYXRoIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgUGx1Z2luU2V0dGluZ3MsIERFRkFVTFRfU0VUVElOR1MsIFRyYWNrZXJDb25maWcgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IE1vbnRobHlUcmFja2VyU2V0dGluZ1RhYiB9IGZyb20gJy4vc2V0dGluZ3MnO1xuaW1wb3J0IHsgcmVuZGVyVHJhY2tlciwgRGF5RGF0YSB9IGZyb20gJy4vcmVuZGVyZXInO1xuaW1wb3J0IHsgdCB9IGZyb20gJy4vaTE4bic7XG5cbmZ1bmN0aW9uIGJ1aWxkRGF0ZVBhdHRlcm4oZGF0ZUZvcm1hdDogc3RyaW5nLCB5ZWFyOiBudW1iZXIsIG1vbnRoOiBudW1iZXIpOiBSZWdFeHAge1xuICBjb25zdCBtbSA9IFN0cmluZyhtb250aCkucGFkU3RhcnQoMiwgJzAnKTtcbiAgY29uc3QgZXNjYXBlZCA9IGRhdGVGb3JtYXRcbiAgICAucmVwbGFjZSgnWVlZWScsICdcXHgwMFlcXHgwMCcpXG4gICAgLnJlcGxhY2UoJ01NJywgJ1xceDAwTVxceDAwJylcbiAgICAucmVwbGFjZSgnREQnLCAnXFx4MDBEXFx4MDAnKVxuICAgIC5yZXBsYWNlKC9bLiorP14ke30oKXxbXFxdXFxcXF0vZywgJ1xcXFwkJicpXG4gICAgLnJlcGxhY2UoJ1xceDAwWVxceDAwJywgU3RyaW5nKHllYXIpKVxuICAgIC5yZXBsYWNlKCdcXHgwME1cXHgwMCcsIG1tKVxuICAgIC5yZXBsYWNlKCdcXHgwMERcXHgwMCcsICcoXFxcXGR7Mn0pJyk7XG4gIHJldHVybiBuZXcgUmVnRXhwKGBeJHtlc2NhcGVkfWApO1xufVxuXG4vKiogTWluaW1hbCBzaGFwZXMgZm9yIHRoZSB1bnR5cGVkIGludGVybmFsL2NvbW11bml0eSBwbHVnaW4gQVBJcyB3ZSByZWFkIGZyb20uICovXG5pbnRlcmZhY2UgRGFpbHlOb3Rlc0ludGVybmFsUGx1Z2luIHtcbiAgaW5zdGFuY2U/OiB7IG9wdGlvbnM/OiB7IGZvbGRlcj86IHN0cmluZyB9IH07XG59XG5pbnRlcmZhY2UgUGVyaW9kaWNOb3Rlc1BsdWdpbiB7XG4gIHNldHRpbmdzPzogeyBkYWlseT86IHsgZm9sZGVyPzogc3RyaW5nIH0gfTtcbn1cbmludGVyZmFjZSBBcHBXaXRoUGx1Z2lucyBleHRlbmRzIEFwcCB7XG4gIGludGVybmFsUGx1Z2lucz86IHsgcGx1Z2lucz86IFJlY29yZDxzdHJpbmcsIERhaWx5Tm90ZXNJbnRlcm5hbFBsdWdpbiB8IHVuZGVmaW5lZD4gfTtcbiAgcGx1Z2lucz86IHsgcGx1Z2lucz86IFJlY29yZDxzdHJpbmcsIFBlcmlvZGljTm90ZXNQbHVnaW4gfCB1bmRlZmluZWQ+IH07XG59XG5cbmZ1bmN0aW9uIGRldGVjdERhaWx5Tm90ZXNGb2xkZXIoYXBwOiBBcHApOiBzdHJpbmcge1xuICBjb25zdCBhID0gYXBwIGFzIEFwcFdpdGhQbHVnaW5zO1xuICBjb25zdCBpbnRlcm5hbCA9IGEuaW50ZXJuYWxQbHVnaW5zPy5wbHVnaW5zPy5bJ2RhaWx5LW5vdGVzJ10/Lmluc3RhbmNlPy5vcHRpb25zPy5mb2xkZXI7XG4gIGlmIChpbnRlcm5hbCkgcmV0dXJuIGludGVybmFsO1xuICBjb25zdCBwZXJpb2RpYyA9IGEucGx1Z2lucz8ucGx1Z2lucz8uWydwZXJpb2RpYy1ub3RlcyddPy5zZXR0aW5ncz8uZGFpbHk/LmZvbGRlcjtcbiAgaWYgKHBlcmlvZGljKSByZXR1cm4gcGVyaW9kaWM7XG4gIHJldHVybiAnJztcbn1cblxuLyoqIFZhbGlkYXRlIGNvbmZpZy1sZXZlbCBpbnZhcmlhbnRzIHVwIGZyb250IHNvIHJlbmRlcmVycyBjYW4gYXNzdW1lIHZhbGlkIGlucHV0LiAqL1xuZnVuY3Rpb24gdmFsaWRhdGVDb25maWcoY29uZmlnOiBUcmFja2VyQ29uZmlnKTogdm9pZCB7XG4gIGNvbnN0IG0gPSB0KCk7XG4gIGlmICghY29uZmlnPy50eXBlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKG0uZXJyTWlzc2luZ1R5cGUpO1xuICB9XG4gIGlmICghY29uZmlnLnByb3BlcnR5ICYmIGNvbmZpZy50eXBlICE9PSAnYm9vbGVhbicpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IobS5lcnJNaXNzaW5nUHJvcGVydHkpO1xuICB9XG4gIGlmIChjb25maWcudHlwZSA9PT0gJ2NvbG9ybWFwJyAmJiAhY29uZmlnLmNvbG9ycykge1xuICAgIHRocm93IG5ldyBFcnJvcihtLmVyck1pc3NpbmdDb2xvcnMpO1xuICB9XG4gIGlmIChjb25maWcudHlwZSA9PT0gJ2hlYXRtYXAnKSB7XG4gICAgY29uc3QgYmlucyA9IGNvbmZpZy5iaW5zO1xuICAgIGlmICghYmlucyB8fCBiaW5zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKG0uZXJySGVhdG1hcEJpbnMpO1xuICAgIH1cbiAgICBpZiAoYmluc1swXSA8PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IobS5lcnJCaW5zUG9zaXRpdmUoYmluc1swXSkpO1xuICAgIH1cbiAgICBmb3IgKGxldCBpID0gMTsgaSA8IGJpbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChiaW5zW2ldIDw9IGJpbnNbaSAtIDFdKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihtLmVyckJpbnNBc2NlbmRpbmcoYmluc1tpIC0gMV0sIGJpbnNbaV0pKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTW9udGhseVRyYWNrZXJQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuICBzZXR0aW5ncyE6IFBsdWdpblNldHRpbmdzO1xuXG4gIGFzeW5jIG9ubG9hZCgpIHtcbiAgICBhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xuICAgIHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgTW9udGhseVRyYWNrZXJTZXR0aW5nVGFiKHRoaXMuYXBwLCB0aGlzKSk7XG5cbiAgICB0aGlzLnJlZ2lzdGVyTWFya2Rvd25Db2RlQmxvY2tQcm9jZXNzb3IoXG4gICAgICAnbW9udGhseS10cmFja2VyJyxcbiAgICAgIGFzeW5jIChzb3VyY2UsIGVsLCBjdHgpID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBhd2FpdCB0aGlzLnByb2Nlc3NCbG9jayhzb3VyY2UsIGVsLCBjdHgpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBlbC5jcmVhdGVFbCgncHJlJywge1xuICAgICAgICAgICAgdGV4dDogYCR7dCgpLmVycm9yUHJlZml4fTpcXG4ke2VyciBpbnN0YW5jZW9mIEVycm9yID8gZXJyLm1lc3NhZ2UgOiBTdHJpbmcoZXJyKX1gLFxuICAgICAgICAgICAgY2xzOiAnbW9udGhseS10cmFja2VyLWVycm9yJyxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICApO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBwcm9jZXNzQmxvY2soXG4gICAgc291cmNlOiBzdHJpbmcsXG4gICAgZWw6IEhUTUxFbGVtZW50LFxuICAgIGN0eDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgY29uZmlnID0gcGFyc2VZYW1sKHNvdXJjZS50cmltKCkpIGFzIFRyYWNrZXJDb25maWc7XG4gICAgdmFsaWRhdGVDb25maWcoY29uZmlnKTtcblxuICAgIC8vIFJlYWQgeWVhci9tb250aCBmcm9tIHRoZSBjdXJyZW50IG5vdGUncyBmcm9udG1hdHRlclxuICAgIGNvbnN0IGN1cnJlbnRGaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGN0eC5zb3VyY2VQYXRoKTtcbiAgICBpZiAoIShjdXJyZW50RmlsZSBpbnN0YW5jZW9mIFRGaWxlKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKHQoKS5lcnJDYW5ub3RSZXNvbHZlRmlsZSk7XG4gICAgfVxuICAgIGNvbnN0IGZtID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoY3VycmVudEZpbGUpPy5mcm9udG1hdHRlcjtcbiAgICBjb25zdCB5ZWFyOiB1bmtub3duID0gZm0/LnllYXI7XG4gICAgY29uc3QgbW9udGg6IHVua25vd24gPSBmbT8ubW9udGg7XG4gICAgaWYgKHllYXIgPT0gbnVsbCB8fCBtb250aCA9PSBudWxsKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IodCgpLmVyck1pc3NpbmdZZWFyTW9udGgpO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIHllYXIgIT09ICdudW1iZXInIHx8IHR5cGVvZiBtb250aCAhPT0gJ251bWJlcicpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcih0KCkuZXJyWWVhck1vbnRoVHlwZSk7XG4gICAgfVxuICAgIGlmIChtb250aCA8IDEgfHwgbW9udGggPiAxMikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKHQoKS5lcnJJbnZhbGlkTW9udGgobW9udGgpKTtcbiAgICB9XG5cbiAgICBjb25zdCBkYXlzSW5Nb250aCA9IG5ldyBEYXRlKHllYXIsIG1vbnRoLCAwKS5nZXREYXRlKCk7XG4gICAgY29uc3QgZm9sZGVyID0gbm9ybWFsaXplUGF0aChcbiAgICAgIGNvbmZpZy5zb3VyY2UgPz8gKHRoaXMuc2V0dGluZ3MuZGFpbHlOb3Rlc0ZvbGRlciB8fCBkZXRlY3REYWlseU5vdGVzRm9sZGVyKHRoaXMuYXBwKSksXG4gICAgKTtcbiAgICBjb25zdCBwYXR0ZXJuID0gYnVpbGREYXRlUGF0dGVybih0aGlzLnNldHRpbmdzLmRhdGVGb3JtYXQsIHllYXIsIG1vbnRoKTtcblxuICAgIC8vIFNjYW4gdmF1bHQgZm9sZGVyIGZvciBtYXRjaGluZyBkYWlseSBub3Rlc1xuICAgIGNvbnN0IGRhdGEgPSBuZXcgTWFwPG51bWJlciwgRGF5RGF0YT4oKTtcbiAgICBjb25zdCBhYnN0cmFjdEZvbGRlciA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChmb2xkZXIpO1xuXG4gICAgaWYgKGFic3RyYWN0Rm9sZGVyIGluc3RhbmNlb2YgVEZvbGRlcikge1xuICAgICAgZm9yIChjb25zdCBjaGlsZCBvZiBhYnN0cmFjdEZvbGRlci5jaGlsZHJlbikge1xuICAgICAgICBpZiAoIShjaGlsZCBpbnN0YW5jZW9mIFRGaWxlKSkgY29udGludWU7XG4gICAgICAgIGNvbnN0IG1hdGNoID0gY2hpbGQubmFtZS5tYXRjaChwYXR0ZXJuKTtcbiAgICAgICAgaWYgKCFtYXRjaCkgY29udGludWU7XG4gICAgICAgIGNvbnN0IGRheSA9IHBhcnNlSW50KG1hdGNoWzFdLCAxMCk7XG5cbiAgICAgICAgY29uc3QgY2hpbGRGbSA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGNoaWxkKT8uZnJvbnRtYXR0ZXI7XG4gICAgICAgIC8vIEZpbGUtZXhpc3RlbmNlIG1vZGUgKHByb3BlcnR5IG9taXR0ZWQpIG1hcmtzIGV2ZXJ5IG1hdGNoaW5nIG5vdGUgYXMgdHJ1ZS5cbiAgICAgICAgY29uc3QgdmFsdWU6IHVua25vd24gPSBjb25maWcucHJvcGVydHkgPT0gbnVsbCA/IHRydWUgOiBjaGlsZEZtPy5bY29uZmlnLnByb3BlcnR5XTtcblxuICAgICAgICBkYXRhLnNldChkYXksIHsgZGF5LCB2YWx1ZSwgZmlsZVBhdGg6IGNoaWxkLnBhdGggfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgcmVuZGVyZWQgPSByZW5kZXJUcmFja2VyKGNvbmZpZywgZGF0YSwgZGF5c0luTW9udGgpO1xuXG4gICAgLy8gRGVsZWdhdGUgaW50ZXJuYWwtbGluayBjbGlja3MgdG8gT2JzaWRpYW4gc28gZGF5IGNlbGxzIG9wZW4gdGhlIG5vdGUuXG4gICAgdGhpcy5yZWdpc3RlckRvbUV2ZW50KHJlbmRlcmVkLCAnY2xpY2snLCAoZXZ0KSA9PiB7XG4gICAgICBjb25zdCBsaW5rID0gKGV2dC50YXJnZXQgYXMgSFRNTEVsZW1lbnQpLmNsb3Nlc3QoJ2EuaW50ZXJuYWwtbGluaycpO1xuICAgICAgY29uc3QgcGF0aCA9IGxpbms/LmdldEF0dHJpYnV0ZSgnZGF0YS1ocmVmJyk7XG4gICAgICBpZiAoIXBhdGgpIHJldHVybjtcbiAgICAgIGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgdm9pZCB0aGlzLmFwcC53b3Jrc3BhY2Uub3BlbkxpbmtUZXh0KHBhdGgsIGN0eC5zb3VyY2VQYXRoLCBldnQuY3RybEtleSB8fCBldnQubWV0YUtleSk7XG4gICAgfSk7XG5cbiAgICAvLyBUcmlnZ2VyIE9ic2lkaWFuJ3MgcGFnZS1wcmV2aWV3IG9uIGhvdmVyIChkYXRhLWhyZWYgYWxvbmUgZG9lc24ndCBlbmFibGUgaXQpLlxuICAgIHRoaXMucmVnaXN0ZXJEb21FdmVudChyZW5kZXJlZCwgJ21vdXNlb3ZlcicsIChldnQpID0+IHtcbiAgICAgIGNvbnN0IGxpbmsgPSAoZXZ0LnRhcmdldCBhcyBIVE1MRWxlbWVudCkuY2xvc2VzdCgnYS5pbnRlcm5hbC1saW5rJyk7XG4gICAgICBjb25zdCBwYXRoID0gbGluaz8uZ2V0QXR0cmlidXRlKCdkYXRhLWhyZWYnKTtcbiAgICAgIGlmICghcGF0aCkgcmV0dXJuO1xuICAgICAgdGhpcy5hcHAud29ya3NwYWNlLnRyaWdnZXIoJ2hvdmVyLWxpbmsnLCB7XG4gICAgICAgIGV2ZW50OiBldnQsXG4gICAgICAgIHNvdXJjZTogJ21vbnRobHktdHJhY2tlcicsXG4gICAgICAgIGhvdmVyUGFyZW50OiByZW5kZXJlZCxcbiAgICAgICAgdGFyZ2V0RWw6IGxpbmssXG4gICAgICAgIGxpbmt0ZXh0OiBwYXRoLFxuICAgICAgICBzb3VyY2VQYXRoOiBjdHguc291cmNlUGF0aCxcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgZWwuYXBwZW5kQ2hpbGQocmVuZGVyZWQpO1xuICB9XG5cbiAgYXN5bmMgbG9hZFNldHRpbmdzKCkge1xuICAgIGNvbnN0IGRhdGEgPSAoYXdhaXQgdGhpcy5sb2FkRGF0YSgpKSBhcyBQYXJ0aWFsPFBsdWdpblNldHRpbmdzPiB8IG51bGw7XG4gICAgdGhpcy5zZXR0aW5ncyA9IE9iamVjdC5hc3NpZ24oe30sIERFRkFVTFRfU0VUVElOR1MsIGRhdGEpO1xuICB9XG5cbiAgYXN5bmMgc2F2ZVNldHRpbmdzKCkge1xuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zZXR0aW5ncyk7XG4gIH1cbn1cbiJdLCJuYW1lcyI6WyJnZXRMYW5ndWFnZSIsIlBsdWdpblNldHRpbmdUYWIiLCJTZXR0aW5nIiwic2V0VG9vbHRpcCIsIlBsdWdpbiIsInBhcnNlWWFtbCIsIlRGaWxlIiwibm9ybWFsaXplUGF0aCIsIlRGb2xkZXIiXSwibWFwcGluZ3MiOiI7Ozs7QUE0Q08sTUFBTSxnQkFBZ0IsR0FBbUI7QUFDOUMsSUFBQSxnQkFBZ0IsRUFBRSxFQUFFO0FBQ3BCLElBQUEsVUFBVSxFQUFFLFlBQVk7Q0FDekI7O0FDdkJELE1BQU0sRUFBRSxHQUFhO0FBQ25CLElBQUEsV0FBVyxFQUFFLHVCQUF1QjtBQUNwQyxJQUFBLGNBQWMsRUFBRSw2REFBNkQ7QUFDN0UsSUFBQSxrQkFBa0IsRUFBRSxrQ0FBa0M7QUFDdEQsSUFBQSxnQkFBZ0IsRUFBRSwrREFBK0Q7QUFDakYsSUFBQSxvQkFBb0IsRUFBRSw2QkFBNkI7QUFDbkQsSUFBQSxtQkFBbUIsRUFBRSwwREFBMEQ7QUFDL0UsSUFBQSxnQkFBZ0IsRUFBRSxtREFBbUQ7SUFDckUsZUFBZSxFQUFFLENBQUMsS0FBSyxLQUFLLENBQUEsZUFBQSxFQUFrQixLQUFLLENBQWlCLGVBQUEsQ0FBQTtBQUNwRSxJQUFBLGNBQWMsRUFBRSxvREFBb0Q7SUFDcEUsZUFBZSxFQUFFLENBQUMsS0FBSyxLQUFLLENBQUEsa0NBQUEsRUFBcUMsS0FBSyxDQUFHLENBQUEsQ0FBQTtBQUN6RSxJQUFBLGdCQUFnQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksS0FBSyxDQUF3QyxxQ0FBQSxFQUFBLElBQUksQ0FBSyxFQUFBLEVBQUEsSUFBSSxDQUFHLENBQUEsQ0FBQTtBQUMxRixJQUFBLFVBQVUsRUFBRSxLQUFLO0FBQ2pCLElBQUEsVUFBVSxFQUFF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
