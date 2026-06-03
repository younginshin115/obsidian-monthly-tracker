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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsic3JjL3R5cGVzLnRzIiwic3JjL2kxOG4udHMiLCJzcmMvc2V0dGluZ3MudHMiLCJzcmMvcHJlc2V0cy50cyIsInNyYy9yZW5kZXJlci50cyIsInNyYy9tYWluLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBpbnRlcmZhY2UgQm9vbGVhbkNvbmZpZyB7XG4gIHR5cGU6ICdib29sZWFuJztcbiAgdGl0bGU/OiBzdHJpbmc7XG4gIHByb3BlcnR5Pzogc3RyaW5nO1xuICBzb3VyY2U/OiBzdHJpbmc7XG4gIC8qKiBoZXggY29sb3Igc3RyaW5nIG9yIHByZXNldCBuYW1lIChlLmcuIFwiYmx1ZVwiKSAqL1xuICBjb2xvcjogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIENvbG9ybWFwQ29uZmlnIHtcbiAgdHlwZTogJ2NvbG9ybWFwJztcbiAgdGl0bGU/OiBzdHJpbmc7XG4gIHByb3BlcnR5OiBzdHJpbmc7XG4gIHNvdXJjZT86IHN0cmluZztcbiAgY29sb3JzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEhlYXRtYXBDb25maWcge1xuICB0eXBlOiAnaGVhdG1hcCc7XG4gIHRpdGxlPzogc3RyaW5nO1xuICBwcm9wZXJ0eTogc3RyaW5nO1xuICBzb3VyY2U/OiBzdHJpbmc7XG4gIHVuaXQ/OiBzdHJpbmc7XG4gIC8qKlxuICAgKiBUaHJlc2hvbGRzIHNlcGFyYXRpbmcgaW50ZW5zaXR5IGxldmVscy5cbiAgICogZS5nLiBbMywgNSwgNywgMTBdIOKGkiA1IGJ1Y2tldHM6IFswLDMpLCBbMyw1KSwgWzUsNyksIFs3LDEwKSwgWzEwLOKInilcbiAgICovXG4gIGJpbnM/OiBudW1iZXJbXTtcbiAgLyoqIGFycmF5IG9mIGhleCBjb2xvcnMsIGxlbmd0aCA9IGJpbnMubGVuZ3RoICsgMSwgb3Igb21pdCBhbmQgdXNlIGNvbG9yU2NoZW1lICovXG4gIGNvbG9ycz86IHN0cmluZ1tdO1xuICAvKiogYnVpbHQtaW4gaGVhdG1hcCBjb2xvciBzY2hlbWUgbmFtZSAoZS5nLiBcImluZGlnb1wiKSAqL1xuICBjb2xvclNjaGVtZT86IHN0cmluZztcbiAgc2hvd1RvdGFsPzogYm9vbGVhbjtcbiAgLyoqIGxhYmVsIHNob3duIG5leHQgdG8gdG90YWwsIGRlZmF1bHRzIHRvIHByb3BlcnR5IG5hbWUgKi9cbiAgdG90YWxMYWJlbD86IHN0cmluZztcbn1cblxuZXhwb3J0IHR5cGUgVHJhY2tlckNvbmZpZyA9IEJvb2xlYW5Db25maWcgfCBDb2xvcm1hcENvbmZpZyB8IEhlYXRtYXBDb25maWc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGx1Z2luU2V0dGluZ3Mge1xuICBkYWlseU5vdGVzRm9sZGVyOiBzdHJpbmc7XG4gIGRhdGVGb3JtYXQ6IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IERFRkFVTFRfU0VUVElOR1M6IFBsdWdpblNldHRpbmdzID0ge1xuICBkYWlseU5vdGVzRm9sZGVyOiAnJyxcbiAgZGF0ZUZvcm1hdDogJ1lZWVktTU0tREQnLFxufTtcbiIsImltcG9ydCB7IGdldExhbmd1YWdlIH0gZnJvbSAnb2JzaWRpYW4nO1xuXG50eXBlIExvY2FsZSA9ICdlbicgfCAna28nO1xuXG5leHBvcnQgaW50ZXJmYWNlIE1lc3NhZ2VzIHtcbiAgZXJyb3JQcmVmaXg6IHN0cmluZztcbiAgZXJyTWlzc2luZ1R5cGU6IHN0cmluZztcbiAgZXJyTWlzc2luZ1Byb3BlcnR5OiBzdHJpbmc7XG4gIGVyck1pc3NpbmdDb2xvcnM6IHN0cmluZztcbiAgZXJyQ2Fubm90UmVzb2x2ZUZpbGU6IHN0cmluZztcbiAgZXJyTWlzc2luZ1llYXJNb250aDogc3RyaW5nO1xuICBlcnJZZWFyTW9udGhUeXBlOiBzdHJpbmc7XG4gIGVyckludmFsaWRNb250aDogKG1vbnRoOiBudW1iZXIpID0+IHN0cmluZztcbiAgZXJySGVhdG1hcEJpbnM6IHN0cmluZztcbiAgZXJyQmluc1Bvc2l0aXZlOiAodmFsdWU6IG51bWJlcikgPT4gc3RyaW5nO1xuICBlcnJCaW5zQXNjZW5kaW5nOiAocHJldjogbnVtYmVyLCBuZXh0OiBudW1iZXIpID0+IHN0cmluZztcbiAgdG9vbHRpcFllczogc3RyaW5nO1xuICB0b3RhbExhYmVsOiBzdHJpbmc7XG4gIHNldHRpbmdzRm9sZGVyTmFtZTogc3RyaW5nO1xuICBzZXR0aW5nc0ZvbGRlckRlc2M6IHN0cmluZztcbiAgc2V0dGluZ3NEYXRlRm9ybWF0TmFtZTogc3RyaW5nO1xuICBzZXR0aW5nc0RhdGVGb3JtYXREZXNjOiBzdHJpbmc7XG59XG5cbmNvbnN0IGVuOiBNZXNzYWdlcyA9IHtcbiAgZXJyb3JQcmVmaXg6ICdNb250aGx5IFRyYWNrZXIgRXJyb3InLFxuICBlcnJNaXNzaW5nVHlwZTogJ01pc3NpbmcgcmVxdWlyZWQgZmllbGQ6IHR5cGUgKGJvb2xlYW4gfCBjb2xvcm1hcCB8IGhlYXRtYXApJyxcbiAgZXJyTWlzc2luZ1Byb3BlcnR5OiAnTWlzc2luZyByZXF1aXJlZCBmaWVsZDogcHJvcGVydHknLFxuICBlcnJNaXNzaW5nQ29sb3JzOiAnTWlzc2luZyByZXF1aXJlZCBmaWVsZDogY29sb3JzIChlLmcuIGNvbG9yczoge3ZhbHVlOiBcIiNoZXhcIn0pJyxcbiAgZXJyQ2Fubm90UmVzb2x2ZUZpbGU6ICdDYW5ub3QgcmVzb2x2ZSBjdXJyZW50IGZpbGUnLFxuICBlcnJNaXNzaW5nWWVhck1vbnRoOiBcIkN1cnJlbnQgbm90ZSBtdXN0IGhhdmUgJ3llYXInIGFuZCAnbW9udGgnIGluIGZyb250bWF0dGVyXCIsXG4gIGVyclllYXJNb250aFR5cGU6IFwiJ3llYXInIGFuZCAnbW9udGgnIG11c3QgYmUgbnVtYmVycyBpbiBmcm9udG1hdHRlclwiLFxuICBlcnJJbnZhbGlkTW9udGg6IChtb250aCkgPT4gYEludmFsaWQgbW9udGg6ICR7bW9udGh9IChtdXN0IGJlIDHigJMxMilgLFxuICBlcnJIZWF0bWFwQmluczogJ2hlYXRtYXAgcmVxdWlyZXMgXCJiaW5zXCIgKGUuZy4gYmluczogWzMsIDUsIDcsIDEwXSknLFxuICBlcnJCaW5zUG9zaXRpdmU6ICh2YWx1ZSkgPT4gYGJpbnMgdmFsdWVzIG11c3QgYmUgcG9zaXRpdmUgKGdvdCAke3ZhbHVlfSlgLFxuICBlcnJCaW5zQXNjZW5kaW5nOiAocHJldiwgbmV4dCkgPT4gYGJpbnMgbXVzdCBiZSBpbiBhc2NlbmRpbmcgb3JkZXIgKGdvdCAke3ByZXZ9LCAke25leHR9KWAsXG4gIHRvb2x0aXBZZXM6ICdZZXMnLFxuICB0b3RhbExhYmVsOiAnVG90YWwnLFxuICBzZXR0aW5nc0ZvbGRlck5hbWU6ICdEYWlseSBub3RlcyBmb2xkZXInLFxuICBzZXR0aW5nc0ZvbGRlckRlc2M6ICdGb2xkZXIgY29udGFpbmluZyBkYWlseSBub3RlcyAoZS5nLiBDYWxlbmRhci9EYXlzKScsXG4gIHNldHRpbmdzRGF0ZUZvcm1hdE5hbWU6ICdEYXRlIGZvcm1hdCcsXG4gIHNldHRpbmdzRGF0ZUZvcm1hdERlc2M6ICdGaWxlIG5hbWUgZGF0ZSBmb3JtYXQuIE11c3QgbWF0Y2ggWVlZWS1NTS1ERCBhdCB0aGUgc3RhcnQgb2YgZmlsZSBuYW1lcy4nLFxufTtcblxuY29uc3Qga286IE1lc3NhZ2VzID0ge1xuICBlcnJvclByZWZpeDogJ01vbnRobHkgVHJhY2tlciDsmKTrpZgnLFxuICBlcnJNaXNzaW5nVHlwZTogJ+2VhOyImCDtla3rqqkg64iE6529OiB0eXBlIChib29sZWFuIHwgY29sb3JtYXAgfCBoZWF0bWFwKScsXG4gIGVyck1pc3NpbmdQcm9wZXJ0eTogJ+2VhOyImCDtla3rqqkg64iE6529OiBwcm9wZXJ0eScsXG4gIGVyck1pc3NpbmdDb2xvcnM6ICftlYTsiJgg7ZWt66qpIOuIhOudvTogY29sb3JzICjsmIg6IGNvbG9yczoge3ZhbHVlOiBcIiNoZXhcIn0pJyxcbiAgZXJyQ2Fubm90UmVzb2x2ZUZpbGU6ICftmITsnqwg7YyM7J287J2EIOywvuydhCDsiJgg7JeG7Iq164uI64ukJyxcbiAgZXJyTWlzc2luZ1llYXJNb250aDogXCLtmITsnqwg64W47Yq47J2YIO2UhOuhoO2KuOunpO2EsOyXkCAneWVhcifsmYAgJ21vbnRoJ+qwgCDsnojslrTslbwg7ZWp64uI64ukXCIsXG4gIGVyclllYXJNb250aFR5cGU6IFwi7ZSE66Gg7Yq466ek7YSw7J2YICd5ZWFyJ+yZgCAnbW9udGgn64qUIOyIq+yekOyXrOyVvCDtlanri4jri6RcIixcbiAgZXJySW52YWxpZE1vbnRoOiAobW9udGgpID0+IGDsnpjrqrvrkJwgbW9udGg6ICR7bW9udGh9ICgx4oCTMTIg7IKs7J207Jes7JW8IO2VqeuLiOuLpClgLFxuICBlcnJIZWF0bWFwQmluczogJ2hlYXRtYXDsl5DripQgXCJiaW5zXCLqsIAg7ZWE7JqU7ZWp64uI64ukICjsmIg6IGJpbnM6IFszLCA1LCA3LCAxMF0pJyxcbiAgZXJyQmluc1Bvc2l0aXZlOiAodmFsdWUpID0+IGBiaW5zIOqwkuydgCDslpHsiJjsl6zslbwg7ZWp64uI64ukICjsnoXroKXqsJI6ICR7dmFsdWV9KWAsXG4gIGVyckJpbnNBc2NlbmRpbmc6IChwcmV2LCBuZXh0KSA9PiBgYmluc+uKlCDsmKTrpoTssKjsiJzsnbTslrTslbwg7ZWp64uI64ukICjsnoXroKXqsJI6ICR7cHJldn0sICR7bmV4dH0pYCxcbiAgdG9vbHRpcFllczogJ+yZhOujjCcsXG4gIHRvdGFsTGFiZWw6ICftlanqs4QnLFxuICBzZXR0aW5nc0ZvbGRlck5hbWU6ICfrjbDsnbzrpqwg64W47Yq4IO2PtOuNlCcsXG4gIHNldHRpbmdzRm9sZGVyRGVzYzogJ+uNsOydvOumrCDrhbjtirjqsIAg65Ok7Ja0IOyeiOuKlCDtj7TrjZQgKOyYiDogQ2FsZW5kYXIvRGF5cyknLFxuICBzZXR0aW5nc0RhdGVGb3JtYXROYW1lOiAn64Kg7KecIO2YleyLnScsXG4gIHNldHRpbmdzRGF0ZUZvcm1hdERlc2M6ICftjIzsnbwg7J2066aE7J2YIOuCoOynnCDtmJXsi50uIO2MjOydvCDsnbTrpoQg7JWe67aA67aE7J20IFlZWVktTU0tRETsmYAg7J287LmY7ZW07JW8IO2VqeuLiOuLpC4nLFxufTtcblxuZnVuY3Rpb24gY3VycmVudExvY2FsZSgpOiBMb2NhbGUge1xuICByZXR1cm4gZ2V0TGFuZ3VhZ2UoKSA9PT0gJ2tvJyA/ICdrbycgOiAnZW4nO1xufVxuXG4vKiogUmV0dXJucyB0aGUgbWVzc2FnZSB0YWJsZSBmb3IgdGhlIGN1cnJlbnQgT2JzaWRpYW4gVUkgbGFuZ3VhZ2UuICovXG5leHBvcnQgZnVuY3Rpb24gdCgpOiBNZXNzYWdlcyB7XG4gIHJldHVybiBjdXJyZW50TG9jYWxlKCkgPT09ICdrbycgPyBrbyA6IGVuO1xufVxuIiwiaW1wb3J0IHsgQXBwLCBQbHVnaW5TZXR0aW5nVGFiLCBTZXR0aW5nIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHR5cGUgTW9udGhseVRyYWNrZXJQbHVnaW4gZnJvbSAnLi9tYWluJztcbmltcG9ydCB7IHQgfSBmcm9tICcuL2kxOG4nO1xuXG5leHBvcnQgY2xhc3MgTW9udGhseVRyYWNrZXJTZXR0aW5nVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG4gIHBsdWdpbjogTW9udGhseVRyYWNrZXJQbHVnaW47XG5cbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHBsdWdpbjogTW9udGhseVRyYWNrZXJQbHVnaW4pIHtcbiAgICBzdXBlcihhcHAsIHBsdWdpbik7XG4gICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG4gIH1cblxuICBkaXNwbGF5KCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XG4gICAgY29uc3QgbSA9IHQoKTtcbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShtLnNldHRpbmdzRm9sZGVyTmFtZSlcbiAgICAgIC5zZXREZXNjKG0uc2V0dGluZ3NGb2xkZXJEZXNjKVxuICAgICAgLmFkZFRleHQodGV4dCA9PlxuICAgICAgICB0ZXh0XG4gICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG9ic2lkaWFubWQvdWkvc2VudGVuY2UtY2FzZSAtLSBmb2xkZXIgcGF0aCBleGFtcGxlLCBub3QgcHJvc2VcbiAgICAgICAgICAuc2V0UGxhY2Vob2xkZXIoJ0NhbGVuZGFyL0RheXMnKVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5kYWlseU5vdGVzRm9sZGVyKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmRhaWx5Tm90ZXNGb2xkZXIgPSB2YWx1ZS50cmltKCk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KSxcbiAgICAgICk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKG0uc2V0dGluZ3NEYXRlRm9ybWF0TmFtZSlcbiAgICAgIC5zZXREZXNjKG0uc2V0dGluZ3NEYXRlRm9ybWF0RGVzYylcbiAgICAgIC5hZGRUZXh0KHRleHQgPT5cbiAgICAgICAgdGV4dFxuICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBvYnNpZGlhbm1kL3VpL3NlbnRlbmNlLWNhc2UgLS0gZGF0ZS1mb3JtYXQgdG9rZW4sIG11c3Qgc3RheSB1cHBlcmNhc2VcbiAgICAgICAgICAuc2V0UGxhY2Vob2xkZXIoJ1lZWVktTU0tREQnKVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5kYXRlRm9ybWF0KVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmRhdGVGb3JtYXQgPSB2YWx1ZS50cmltKCk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KSxcbiAgICAgICk7XG4gIH1cbn1cbiIsIi8qKiBTaW5nbGUtY29sb3IgcHJlc2V0cyBmb3IgYm9vbGVhbiB0cmFja2VyICovXG5leHBvcnQgY29uc3QgQ09MT1JfUFJFU0VUUzogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgYmx1ZTogJyM2NGI1ZjYnLFxuICBncmVlbjogJyM2NmJiNmEnLFxuICByZWQ6ICcjZTU3MzczJyxcbiAgcHVycGxlOiAnI2JhNjhjOCcsXG4gIG9yYW5nZTogJyNmZmI3NGQnLFxuICB5ZWxsb3c6ICcjZmZkNTRmJyxcbiAgdGVhbDogJyM0ZGI2YWMnLFxuICBpbmRpZ286ICcjNzk4NmNiJyxcbiAgcGluazogJyNmMDYyOTInLFxufTtcblxuLyoqXG4gKiBIZWF0bWFwIGNvbG9yLXNjaGVtZSBwcmVzZXRzLlxuICogSW5kZXggMCA9IG5vIGRhdGEsIGluZGV4IDEuLm4gPSBpbmNyZWFzaW5nIGludGVuc2l0eS5cbiAqL1xuZXhwb3J0IGNvbnN0IEhFQVRNQVBfU0NIRU1FUzogUmVjb3JkPHN0cmluZywgc3RyaW5nW10+ID0ge1xuICBibHVlOiBbJyNlYmVkZjAnLCAnI2JiZGVmYicsICcjOTBjYWY5JywgJyM2NGI1ZjYnLCAnIzQyYTVmNScsICcjMWU4OGU1J10sXG4gIGdyZWVuOiBbJyNlYmVkZjAnLCAnI2M4ZTZjOScsICcjYTVkNmE3JywgJyM4MWM3ODQnLCAnIzY2YmI2YScsICcjNDNhMDQ3J10sXG4gIHJlZDogWycjZWJlZGYwJywgJyNmZmNkZDInLCAnI2VmOWE5YScsICcjZTU3MzczJywgJyNlZjUzNTAnLCAnI2U1MzkzNSddLFxuICBwdXJwbGU6IFsnI2ViZWRmMCcsICcjZTFiZWU3JywgJyNjZTkzZDgnLCAnI2JhNjhjOCcsICcjYWI0N2JjJywgJyM4ZTI0YWEnXSxcbiAgb3JhbmdlOiBbJyNlYmVkZjAnLCAnI2ZmZTBiMicsICcjZmZjYzgwJywgJyNmZmI3NGQnLCAnI2ZmYTcyNicsICcjZmI4YzAwJ10sXG4gIHllbGxvdzogWycjZWJlZGYwJywgJyNmZmY5YzQnLCAnI2ZmZjU5ZCcsICcjZmZmMTc2JywgJyNmZmVlNTgnLCAnI2ZkZDgzNSddLFxuICB0ZWFsOiBbJyNlYmVkZjAnLCAnI2IyZGZkYicsICcjODBjYmM0JywgJyM0ZGI2YWMnLCAnIzI2YTY5YScsICcjMDA4OTdiJ10sXG4gIGluZGlnbzogWycjZWJlZGYwJywgJyNlOGVhZjYnLCAnI2M1Y2FlOScsICcjOWZhOGRhJywgJyM3OTg2Y2InLCAnIzVjNmJjMCddLFxuICBwaW5rOiBbJyNlYmVkZjAnLCAnI2ZjZTRlYycsICcjZjQ4ZmIxJywgJyNmMDYyOTInLCAnI2VjNDA3YScsICcjZDgxYjYwJ10sXG59O1xuXG4vKiogUmVzb2x2ZSBhIGNvbG9yIHN0cmluZzogaWYgaXQncyBhIGtub3duIHByZXNldCBuYW1lLCByZXR1cm4gdGhlIGhleDsgb3RoZXJ3aXNlIHJldHVybiBhcy1pcy4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlQ29sb3IoY29sb3I/OiBzdHJpbmcpOiBzdHJpbmcge1xuICBpZiAoIWNvbG9yKSByZXR1cm4gQ09MT1JfUFJFU0VUUy5ibHVlO1xuICByZXR1cm4gQ09MT1JfUFJFU0VUU1tjb2xvci50b0xvd2VyQ2FzZSgpXSA/PyBjb2xvcjtcbn1cblxuLyoqIFJlc29sdmUgaGVhdG1hcCBjb2xvcnMgYXJyYXkgZnJvbSBjb2xvclNjaGVtZSBwcmVzZXQgb3IgZXhwbGljaXQgY29sb3JzIGFycmF5LiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVIZWF0bWFwQ29sb3JzKGNvbG9ycz86IHN0cmluZ1tdLCBjb2xvclNjaGVtZT86IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgaWYgKGNvbG9ycyAmJiBjb2xvcnMubGVuZ3RoID4gMCkgcmV0dXJuIGNvbG9ycztcbiAgaWYgKGNvbG9yU2NoZW1lKSB7XG4gICAgY29uc3Qgc2NoZW1lID0gSEVBVE1BUF9TQ0hFTUVTW2NvbG9yU2NoZW1lLnRvTG93ZXJDYXNlKCldO1xuICAgIGlmIChzY2hlbWUpIHJldHVybiBzY2hlbWU7XG4gIH1cbiAgcmV0dXJuIEhFQVRNQVBfU0NIRU1FU1snaW5kaWdvJ107XG59XG5cbiIsImltcG9ydCB7IHNldFRvb2x0aXAgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBUcmFja2VyQ29uZmlnLCBCb29sZWFuQ29uZmlnLCBDb2xvcm1hcENvbmZpZywgSGVhdG1hcENvbmZpZyB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgcmVzb2x2ZUNvbG9yLCByZXNvbHZlSGVhdG1hcENvbG9ycyB9IGZyb20gJy4vcHJlc2V0cyc7XG5pbXBvcnQgeyB0IH0gZnJvbSAnLi9pMThuJztcblxuZXhwb3J0IGludGVyZmFjZSBEYXlEYXRhIHtcbiAgZGF5OiBudW1iZXI7XG4gIHZhbHVlOiB1bmtub3duO1xuICBmaWxlUGF0aD86IHN0cmluZztcbn1cblxuLyoqXG4gKiBCdWlsZCBhIHNpbmdsZSBkYXkgY2VsbC5cbiAqIEBwYXJhbSBiZ0NvbG9yIGlubGluZSBiYWNrZ3JvdW5kIGNvbG9yIGZvciBhY3RpdmUgY2VsbHM7IG51bGwgbGV0cyB0aGUgdGhlbWVcbiAqICAgKGAuaXMtZW1wdHlgKSBzdHlsZSBlbXB0eSBjZWxscyBzbyBkYXJrIG1vZGUgaXMgcmVzcGVjdGVkLlxuICovXG5mdW5jdGlvbiBkYXlDZWxsKFxuICBkYXk6IG51bWJlcixcbiAgYmdDb2xvcjogc3RyaW5nIHwgbnVsbCxcbiAgYWN0aXZlOiBib29sZWFuLFxuICBmaWxlUGF0aDogc3RyaW5nIHwgdW5kZWZpbmVkLFxuICB0b29sdGlwOiBzdHJpbmcsXG4pOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IGVsOiBIVE1MRWxlbWVudCA9IGZpbGVQYXRoXG4gICAgPyBhY3RpdmVEb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJylcbiAgICA6IGFjdGl2ZURvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXG4gIGVsLmNsYXNzTGlzdC5hZGQoJ21vbnRobHktdHJhY2tlci1jZWxsJywgYWN0aXZlID8gJ2lzLWFjdGl2ZScgOiAnaXMtZW1wdHknKTtcbiAgaWYgKGJnQ29sb3IpIGVsLnN0eWxlLmJhY2tncm91bmRDb2xvciA9IGJnQ29sb3I7XG5cbiAgaWYgKGZpbGVQYXRoKSB7XG4gICAgY29uc3QgYW5jaG9yID0gZWwgYXMgSFRNTEFuY2hvckVsZW1lbnQ7XG4gICAgYW5jaG9yLmNsYXNzTGlzdC5hZGQoJ2ludGVybmFsLWxpbmsnKTtcbiAgICBhbmNob3Iuc2V0QXR0cmlidXRlKCdocmVmJywgZmlsZVBhdGgpO1xuICAgIGFuY2hvci5kYXRhc2V0LmhyZWYgPSBmaWxlUGF0aDtcbiAgfVxuXG4gIGlmICh0b29sdGlwKSBzZXRUb29sdGlwKGVsLCB0b29sdGlwKTtcbiAgZWwudGV4dENvbnRlbnQgPSBTdHJpbmcoZGF5KTtcbiAgcmV0dXJuIGVsO1xufVxuXG5mdW5jdGlvbiB3cmFwR3JpZChjZWxsczogSFRNTEVsZW1lbnRbXSk6IEhUTUxFbGVtZW50IHtcbiAgY29uc3Qgcm93ID0gYWN0aXZlRG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIHJvdy5jbGFzc0xpc3QuYWRkKCdtb250aGx5LXRyYWNrZXItcm93Jyk7XG4gIGZvciAoY29uc3QgY2VsbCBvZiBjZWxscykgcm93LmFwcGVuZENoaWxkKGNlbGwpO1xuICByZXR1cm4gcm93O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyQm9vbGVhbihjb25maWc6IEJvb2xlYW5Db25maWcsIGRhdGE6IE1hcDxudW1iZXIsIERheURhdGE+LCBkYXlzSW5Nb250aDogbnVtYmVyKTogSFRNTEVsZW1lbnQge1xuICBjb25zdCBhY3RpdmVDb2xvciA9IHJlc29sdmVDb2xvcihjb25maWcuY29sb3IpO1xuICBjb25zdCBjZWxsczogSFRNTEVsZW1lbnRbXSA9IFtdO1xuXG4gIGZvciAobGV0IGRheSA9IDE7IGRheSA8PSBkYXlzSW5Nb250aDsgZGF5KyspIHtcbiAgICBjb25zdCBlbnRyeSA9IGRhdGEuZ2V0KGRheSk7XG4gICAgY29uc3QgYWN0aXZlID0gZW50cnkgIT09IHVuZGVmaW5lZCAmJiAhIWVudHJ5LnZhbHVlO1xuICAgIGNlbGxzLnB1c2goZGF5Q2VsbChkYXksIGFjdGl2ZSA/IGFjdGl2ZUNvbG9yIDogbnVsbCwgYWN0aXZlLCBlbnRyeT8uZmlsZVBhdGgsIGFjdGl2ZSA/IHQoKS50b29sdGlwWWVzIDogJycpKTtcbiAgfVxuXG4gIHJldHVybiB3cmFwR3JpZChjZWxscyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJDb2xvcm1hcChjb25maWc6IENvbG9ybWFwQ29uZmlnLCBkYXRhOiBNYXA8bnVtYmVyLCBEYXlEYXRhPiwgZGF5c0luTW9udGg6IG51bWJlcik6IEhUTUxFbGVtZW50IHtcbiAgY29uc3QgY29sb3JNYXAgPSBjb25maWcuY29sb3JzO1xuICBjb25zdCBjZWxsczogSFRNTEVsZW1lbnRbXSA9IFtdO1xuXG4gIGZvciAobGV0IGRheSA9IDE7IGRheSA8PSBkYXlzSW5Nb250aDsgZGF5KyspIHtcbiAgICBjb25zdCBlbnRyeSA9IGRhdGEuZ2V0KGRheSk7XG4gICAgY29uc3QgcmF3ID0gZW50cnk/LnZhbHVlO1xuICAgIC8vIE9ubHkgc2NhbGFyIGZyb250bWF0dGVyIHZhbHVlcyBtYXAgdG8gYSBjb2xvciBrZXk7IG9iamVjdHMvYXJyYXlzIGFyZSBpZ25vcmVkLlxuICAgIGNvbnN0IGtleSA9IHR5cGVvZiByYXcgPT09ICdzdHJpbmcnIHx8IHR5cGVvZiByYXcgPT09ICdudW1iZXInIHx8IHR5cGVvZiByYXcgPT09ICdib29sZWFuJ1xuICAgICAgPyBTdHJpbmcocmF3KVxuICAgICAgOiB1bmRlZmluZWQ7XG4gICAgY29uc3QgbWFwcGVkQ29sb3IgPSBrZXkgIT0gbnVsbCA/IGNvbG9yTWFwW2tleV0gOiB1bmRlZmluZWQ7XG4gICAgY2VsbHMucHVzaChkYXlDZWxsKGRheSwgbWFwcGVkQ29sb3IgPz8gbnVsbCwgISFtYXBwZWRDb2xvciwgZW50cnk/LmZpbGVQYXRoLCBrZXkgPz8gJycpKTtcbiAgfVxuXG4gIHJldHVybiB3cmFwR3JpZChjZWxscyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJIZWF0bWFwKGNvbmZpZzogSGVhdG1hcENvbmZpZywgZGF0YTogTWFwPG51bWJlciwgRGF5RGF0YT4sIGRheXNJbk1vbnRoOiBudW1iZXIpOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IGNvbG9ycyA9IHJlc29sdmVIZWF0bWFwQ29sb3JzKGNvbmZpZy5jb2xvcnMsIGNvbmZpZy5jb2xvclNjaGVtZSk7XG4gIC8vIGJpbnMgYXJlIHZhbGlkYXRlZCB1cHN0cmVhbSBpbiBwcm9jZXNzQmxvY2s7IG5vbi1udWxsIGFzc2VydGlvbiBpcyBzYWZlIGhlcmUuXG4gIGNvbnN0IGJpbnMgPSBjb25maWcuYmlucyE7XG4gIGNvbnN0IHVuaXQgPSBjb25maWcudW5pdCA/PyAnJztcblxuICBmdW5jdGlvbiBnZXRJbnRlbnNpdHkodmFsOiBudW1iZXIpOiBudW1iZXIge1xuICAgIGlmICh2YWwgPD0gMCkgcmV0dXJuIDA7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBiaW5zLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAodmFsIDwgYmluc1tpXSkgcmV0dXJuIGkgKyAxO1xuICAgIH1cbiAgICByZXR1cm4gYmlucy5sZW5ndGggKyAxO1xuICB9XG5cbiAgY29uc3QgbWF4SW50ZW5zaXR5ID0gYmlucy5sZW5ndGggKyAxO1xuICBjb25zdCBmaWxsQ29sb3IgPSBjb2xvcnNbY29sb3JzLmxlbmd0aCAtIDFdID8/ICcnO1xuICBjb25zdCBwYWRkaW5nID0gbmV3IEFycmF5PHN0cmluZz4oTWF0aC5tYXgoMCwgbWF4SW50ZW5zaXR5ICsgMSAtIGNvbG9ycy5sZW5ndGgpKS5maWxsKGZpbGxDb2xvcik7XG4gIGNvbnN0IHNhZmVDb2xvcnMgPSBjb2xvcnMubGVuZ3RoID49IG1heEludGVuc2l0eSArIDEgPyBjb2xvcnMgOiBbLi4uY29sb3JzLCAuLi5wYWRkaW5nXTtcblxuICBsZXQgdG90YWwgPSAwO1xuICBjb25zdCBjZWxsczogSFRNTEVsZW1lbnRbXSA9IFtdO1xuXG4gIGZvciAobGV0IGRheSA9IDE7IGRheSA8PSBkYXlzSW5Nb250aDsgZGF5KyspIHtcbiAgICBjb25zdCBlbnRyeSA9IGRhdGEuZ2V0KGRheSk7XG4gICAgY29uc3QgcmF3ID0gZW50cnk/LnZhbHVlO1xuICAgIGNvbnN0IHZhbCA9IHR5cGVvZiByYXcgPT09ICdudW1iZXInICYmIGlzRmluaXRlKHJhdykgPyByYXcgOiAwO1xuICAgIHRvdGFsICs9IHZhbDtcbiAgICBjb25zdCBpbnRlbnNpdHkgPSBnZXRJbnRlbnNpdHkodmFsKTtcbiAgICBjb25zdCBhY3RpdmUgPSBpbnRlbnNpdHkgPiAwO1xuICAgIGNvbnN0IGJnQ29sb3IgPSBhY3RpdmUgPyAoc2FmZUNvbG9yc1tpbnRlbnNpdHldIHx8IG51bGwpIDogbnVsbDtcbiAgICBjZWxscy5wdXNoKGRheUNlbGwoZGF5LCBiZ0NvbG9yLCBhY3RpdmUsIGVudHJ5Py5maWxlUGF0aCwgdmFsID4gMCA/IGAke3ZhbH0ke3VuaXR9YCA6ICcnKSk7XG4gIH1cblxuICBjb25zdCBjb250YWluZXIgPSBhY3RpdmVEb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblxuICBpZiAoY29uZmlnLnNob3dUb3RhbCkge1xuICAgIGNvbnN0IGxhYmVsID0gY29uZmlnLnRvdGFsTGFiZWwgPz8gdCgpLnRvdGFsTGFiZWw7XG4gICAgY29uc3Qgc3VtbWFyeSA9IGFjdGl2ZURvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIHN1bW1hcnkuY2xhc3NMaXN0LmFkZCgnbW9udGhseS10cmFja2VyLXN1bW1hcnknKTtcbiAgICBzdW1tYXJ5LnRleHRDb250ZW50ID0gYCR7bGFiZWx9OiBgO1xuICAgIGNvbnN0IHZhbHVlID0gYWN0aXZlRG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICAgIHZhbHVlLmNsYXNzTGlzdC5hZGQoJ21vbnRobHktdHJhY2tlci1zdW1tYXJ5LXZhbHVlJyk7XG4gICAgY29uc3QgZGlzcGxheVRvdGFsID0gTnVtYmVyLmlzSW50ZWdlcih0b3RhbCkgPyBTdHJpbmcodG90YWwpIDogdG90YWwudG9GaXhlZCgxKTtcbiAgICB2YWx1ZS50ZXh0Q29udGVudCA9IGAke2Rpc3BsYXlUb3RhbH0ke3VuaXR9YDtcbiAgICBzdW1tYXJ5LmFwcGVuZENoaWxkKHZhbHVlKTtcbiAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQoc3VtbWFyeSk7XG4gIH1cblxuICBjb250YWluZXIuYXBwZW5kQ2hpbGQod3JhcEdyaWQoY2VsbHMpKTtcbiAgcmV0dXJuIGNvbnRhaW5lcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlclRyYWNrZXIoXG4gIGNvbmZpZzogVHJhY2tlckNvbmZpZyxcbiAgZGF0YTogTWFwPG51bWJlciwgRGF5RGF0YT4sXG4gIGRheXNJbk1vbnRoOiBudW1iZXIsXG4pOiBIVE1MRWxlbWVudCB7XG4gIGNvbnN0IGNvbnRhaW5lciA9IGFjdGl2ZURvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBjb250YWluZXIuY2xhc3NMaXN0LmFkZCgnbW9udGhseS10cmFja2VyJyk7XG5cbiAgbGV0IGlubmVyOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICBpZiAoY29uZmlnLnR5cGUgPT09ICdib29sZWFuJykge1xuICAgIGlubmVyID0gcmVuZGVyQm9vbGVhbihjb25maWcsIGRhdGEsIGRheXNJbk1vbnRoKTtcbiAgfSBlbHNlIGlmIChjb25maWcudHlwZSA9PT0gJ2NvbG9ybWFwJykge1xuICAgIGlubmVyID0gcmVuZGVyQ29sb3JtYXAoY29uZmlnLCBkYXRhLCBkYXlzSW5Nb250aCk7XG4gIH0gZWxzZSBpZiAoY29uZmlnLnR5cGUgPT09ICdoZWF0bWFwJykge1xuICAgIGlubmVyID0gcmVuZGVySGVhdG1hcChjb25maWcsIGRhdGEsIGRheXNJbk1vbnRoKTtcbiAgfVxuXG4gIGlmIChpbm5lcikgY29udGFpbmVyLmFwcGVuZENoaWxkKGlubmVyKTtcbiAgcmV0dXJuIGNvbnRhaW5lcjtcbn1cbiIsImltcG9ydCB7IEFwcCwgUGx1Z2luLCBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0LCBURmlsZSwgVEZvbGRlciwgcGFyc2VZYW1sIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgUGx1Z2luU2V0dGluZ3MsIERFRkFVTFRfU0VUVElOR1MsIFRyYWNrZXJDb25maWcgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IE1vbnRobHlUcmFja2VyU2V0dGluZ1RhYiB9IGZyb20gJy4vc2V0dGluZ3MnO1xuaW1wb3J0IHsgcmVuZGVyVHJhY2tlciwgRGF5RGF0YSB9IGZyb20gJy4vcmVuZGVyZXInO1xuaW1wb3J0IHsgdCB9IGZyb20gJy4vaTE4bic7XG5cbmZ1bmN0aW9uIGJ1aWxkRGF0ZVBhdHRlcm4oZGF0ZUZvcm1hdDogc3RyaW5nLCB5ZWFyOiBudW1iZXIsIG1vbnRoOiBudW1iZXIpOiBSZWdFeHAge1xuICBjb25zdCBtbSA9IFN0cmluZyhtb250aCkucGFkU3RhcnQoMiwgJzAnKTtcbiAgY29uc3QgZXNjYXBlZCA9IGRhdGVGb3JtYXRcbiAgICAucmVwbGFjZSgnWVlZWScsICdcXHgwMFlcXHgwMCcpXG4gICAgLnJlcGxhY2UoJ01NJywgJ1xceDAwTVxceDAwJylcbiAgICAucmVwbGFjZSgnREQnLCAnXFx4MDBEXFx4MDAnKVxuICAgIC5yZXBsYWNlKC9bLiorP14ke30oKXxbXFxdXFxcXF0vZywgJ1xcXFwkJicpXG4gICAgLnJlcGxhY2UoJ1xceDAwWVxceDAwJywgU3RyaW5nKHllYXIpKVxuICAgIC5yZXBsYWNlKCdcXHgwME1cXHgwMCcsIG1tKVxuICAgIC5yZXBsYWNlKCdcXHgwMERcXHgwMCcsICcoXFxcXGR7Mn0pJyk7XG4gIHJldHVybiBuZXcgUmVnRXhwKGBeJHtlc2NhcGVkfWApO1xufVxuXG4vKiogTWluaW1hbCBzaGFwZXMgZm9yIHRoZSB1bnR5cGVkIGludGVybmFsL2NvbW11bml0eSBwbHVnaW4gQVBJcyB3ZSByZWFkIGZyb20uICovXG5pbnRlcmZhY2UgRGFpbHlOb3Rlc0ludGVybmFsUGx1Z2luIHtcbiAgaW5zdGFuY2U/OiB7IG9wdGlvbnM/OiB7IGZvbGRlcj86IHN0cmluZyB9IH07XG59XG5pbnRlcmZhY2UgUGVyaW9kaWNOb3Rlc1BsdWdpbiB7XG4gIHNldHRpbmdzPzogeyBkYWlseT86IHsgZm9sZGVyPzogc3RyaW5nIH0gfTtcbn1cbmludGVyZmFjZSBBcHBXaXRoUGx1Z2lucyBleHRlbmRzIEFwcCB7XG4gIGludGVybmFsUGx1Z2lucz86IHsgcGx1Z2lucz86IFJlY29yZDxzdHJpbmcsIERhaWx5Tm90ZXNJbnRlcm5hbFBsdWdpbiB8IHVuZGVmaW5lZD4gfTtcbiAgcGx1Z2lucz86IHsgcGx1Z2lucz86IFJlY29yZDxzdHJpbmcsIFBlcmlvZGljTm90ZXNQbHVnaW4gfCB1bmRlZmluZWQ+IH07XG59XG5cbmZ1bmN0aW9uIGRldGVjdERhaWx5Tm90ZXNGb2xkZXIoYXBwOiBBcHApOiBzdHJpbmcge1xuICBjb25zdCBhID0gYXBwIGFzIEFwcFdpdGhQbHVnaW5zO1xuICBjb25zdCBpbnRlcm5hbCA9IGEuaW50ZXJuYWxQbHVnaW5zPy5wbHVnaW5zPy5bJ2RhaWx5LW5vdGVzJ10/Lmluc3RhbmNlPy5vcHRpb25zPy5mb2xkZXI7XG4gIGlmIChpbnRlcm5hbCkgcmV0dXJuIGludGVybmFsO1xuICBjb25zdCBwZXJpb2RpYyA9IGEucGx1Z2lucz8ucGx1Z2lucz8uWydwZXJpb2RpYy1ub3RlcyddPy5zZXR0aW5ncz8uZGFpbHk/LmZvbGRlcjtcbiAgaWYgKHBlcmlvZGljKSByZXR1cm4gcGVyaW9kaWM7XG4gIHJldHVybiAnJztcbn1cblxuLyoqIFZhbGlkYXRlIGNvbmZpZy1sZXZlbCBpbnZhcmlhbnRzIHVwIGZyb250IHNvIHJlbmRlcmVycyBjYW4gYXNzdW1lIHZhbGlkIGlucHV0LiAqL1xuZnVuY3Rpb24gdmFsaWRhdGVDb25maWcoY29uZmlnOiBUcmFja2VyQ29uZmlnKTogdm9pZCB7XG4gIGNvbnN0IG0gPSB0KCk7XG4gIGlmICghY29uZmlnPy50eXBlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKG0uZXJyTWlzc2luZ1R5cGUpO1xuICB9XG4gIGlmICghY29uZmlnLnByb3BlcnR5ICYmIGNvbmZpZy50eXBlICE9PSAnYm9vbGVhbicpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IobS5lcnJNaXNzaW5nUHJvcGVydHkpO1xuICB9XG4gIGlmIChjb25maWcudHlwZSA9PT0gJ2NvbG9ybWFwJyAmJiAhY29uZmlnLmNvbG9ycykge1xuICAgIHRocm93IG5ldyBFcnJvcihtLmVyck1pc3NpbmdDb2xvcnMpO1xuICB9XG4gIGlmIChjb25maWcudHlwZSA9PT0gJ2hlYXRtYXAnKSB7XG4gICAgY29uc3QgYmlucyA9IGNvbmZpZy5iaW5zO1xuICAgIGlmICghYmlucyB8fCBiaW5zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKG0uZXJySGVhdG1hcEJpbnMpO1xuICAgIH1cbiAgICBpZiAoYmluc1swXSA8PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IobS5lcnJCaW5zUG9zaXRpdmUoYmluc1swXSkpO1xuICAgIH1cbiAgICBmb3IgKGxldCBpID0gMTsgaSA8IGJpbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChiaW5zW2ldIDw9IGJpbnNbaSAtIDFdKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihtLmVyckJpbnNBc2NlbmRpbmcoYmluc1tpIC0gMV0sIGJpbnNbaV0pKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTW9udGhseVRyYWNrZXJQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuICBzZXR0aW5ncyE6IFBsdWdpblNldHRpbmdzO1xuXG4gIGFzeW5jIG9ubG9hZCgpIHtcbiAgICBhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xuICAgIHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgTW9udGhseVRyYWNrZXJTZXR0aW5nVGFiKHRoaXMuYXBwLCB0aGlzKSk7XG5cbiAgICB0aGlzLnJlZ2lzdGVyTWFya2Rvd25Db2RlQmxvY2tQcm9jZXNzb3IoXG4gICAgICAnbW9udGhseS10cmFja2VyJyxcbiAgICAgIGFzeW5jIChzb3VyY2UsIGVsLCBjdHgpID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBhd2FpdCB0aGlzLnByb2Nlc3NCbG9jayhzb3VyY2UsIGVsLCBjdHgpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBlbC5jcmVhdGVFbCgncHJlJywge1xuICAgICAgICAgICAgdGV4dDogYCR7dCgpLmVycm9yUHJlZml4fTpcXG4ke2VyciBpbnN0YW5jZW9mIEVycm9yID8gZXJyLm1lc3NhZ2UgOiBTdHJpbmcoZXJyKX1gLFxuICAgICAgICAgICAgY2xzOiAnbW9udGhseS10cmFja2VyLWVycm9yJyxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICApO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBwcm9jZXNzQmxvY2soXG4gICAgc291cmNlOiBzdHJpbmcsXG4gICAgZWw6IEhUTUxFbGVtZW50LFxuICAgIGN0eDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgY29uZmlnID0gcGFyc2VZYW1sKHNvdXJjZS50cmltKCkpIGFzIFRyYWNrZXJDb25maWc7XG4gICAgdmFsaWRhdGVDb25maWcoY29uZmlnKTtcblxuICAgIC8vIFJlYWQgeWVhci9tb250aCBmcm9tIHRoZSBjdXJyZW50IG5vdGUncyBmcm9udG1hdHRlclxuICAgIGNvbnN0IGN1cnJlbnRGaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGN0eC5zb3VyY2VQYXRoKTtcbiAgICBpZiAoIShjdXJyZW50RmlsZSBpbnN0YW5jZW9mIFRGaWxlKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKHQoKS5lcnJDYW5ub3RSZXNvbHZlRmlsZSk7XG4gICAgfVxuICAgIGNvbnN0IGZtID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoY3VycmVudEZpbGUpPy5mcm9udG1hdHRlcjtcbiAgICBjb25zdCB5ZWFyOiB1bmtub3duID0gZm0/LnllYXI7XG4gICAgY29uc3QgbW9udGg6IHVua25vd24gPSBmbT8ubW9udGg7XG4gICAgaWYgKHllYXIgPT0gbnVsbCB8fCBtb250aCA9PSBudWxsKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IodCgpLmVyck1pc3NpbmdZZWFyTW9udGgpO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIHllYXIgIT09ICdudW1iZXInIHx8IHR5cGVvZiBtb250aCAhPT0gJ251bWJlcicpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcih0KCkuZXJyWWVhck1vbnRoVHlwZSk7XG4gICAgfVxuICAgIGlmIChtb250aCA8IDEgfHwgbW9udGggPiAxMikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKHQoKS5lcnJJbnZhbGlkTW9udGgobW9udGgpKTtcbiAgICB9XG5cbiAgICBjb25zdCBkYXlzSW5Nb250aCA9IG5ldyBEYXRlKHllYXIsIG1vbnRoLCAwKS5nZXREYXRlKCk7XG4gICAgY29uc3QgZm9sZGVyID0gY29uZmlnLnNvdXJjZSA/PyAodGhpcy5zZXR0aW5ncy5kYWlseU5vdGVzRm9sZGVyIHx8IGRldGVjdERhaWx5Tm90ZXNGb2xkZXIodGhpcy5hcHApKTtcbiAgICBjb25zdCBwYXR0ZXJuID0gYnVpbGREYXRlUGF0dGVybih0aGlzLnNldHRpbmdzLmRhdGVGb3JtYXQsIHllYXIsIG1vbnRoKTtcblxuICAgIC8vIFNjYW4gdmF1bHQgZm9sZGVyIGZvciBtYXRjaGluZyBkYWlseSBub3Rlc1xuICAgIGNvbnN0IGRhdGEgPSBuZXcgTWFwPG51bWJlciwgRGF5RGF0YT4oKTtcbiAgICBjb25zdCBhYnN0cmFjdEZvbGRlciA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChmb2xkZXIpO1xuXG4gICAgaWYgKGFic3RyYWN0Rm9sZGVyIGluc3RhbmNlb2YgVEZvbGRlcikge1xuICAgICAgZm9yIChjb25zdCBjaGlsZCBvZiBhYnN0cmFjdEZvbGRlci5jaGlsZHJlbikge1xuICAgICAgICBpZiAoIShjaGlsZCBpbnN0YW5jZW9mIFRGaWxlKSkgY29udGludWU7XG4gICAgICAgIGNvbnN0IG1hdGNoID0gY2hpbGQubmFtZS5tYXRjaChwYXR0ZXJuKTtcbiAgICAgICAgaWYgKCFtYXRjaCkgY29udGludWU7XG4gICAgICAgIGNvbnN0IGRheSA9IHBhcnNlSW50KG1hdGNoWzFdLCAxMCk7XG5cbiAgICAgICAgY29uc3QgY2hpbGRGbSA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGNoaWxkKT8uZnJvbnRtYXR0ZXI7XG4gICAgICAgIC8vIEZpbGUtZXhpc3RlbmNlIG1vZGUgKHByb3BlcnR5IG9taXR0ZWQpIG1hcmtzIGV2ZXJ5IG1hdGNoaW5nIG5vdGUgYXMgdHJ1ZS5cbiAgICAgICAgY29uc3QgdmFsdWU6IHVua25vd24gPSBjb25maWcucHJvcGVydHkgPT0gbnVsbCA/IHRydWUgOiBjaGlsZEZtPy5bY29uZmlnLnByb3BlcnR5XTtcblxuICAgICAgICBkYXRhLnNldChkYXksIHsgZGF5LCB2YWx1ZSwgZmlsZVBhdGg6IGNoaWxkLnBhdGggfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgcmVuZGVyZWQgPSByZW5kZXJUcmFja2VyKGNvbmZpZywgZGF0YSwgZGF5c0luTW9udGgpO1xuXG4gICAgLy8gRGVsZWdhdGUgaW50ZXJuYWwtbGluayBjbGlja3MgdG8gT2JzaWRpYW4gc28gZGF5IGNlbGxzIG9wZW4gdGhlIG5vdGUuXG4gICAgdGhpcy5yZWdpc3RlckRvbUV2ZW50KHJlbmRlcmVkLCAnY2xpY2snLCAoZXZ0KSA9PiB7XG4gICAgICBjb25zdCBsaW5rID0gKGV2dC50YXJnZXQgYXMgSFRNTEVsZW1lbnQpLmNsb3Nlc3QoJ2EuaW50ZXJuYWwtbGluaycpO1xuICAgICAgY29uc3QgcGF0aCA9IGxpbms/LmdldEF0dHJpYnV0ZSgnZGF0YS1ocmVmJyk7XG4gICAgICBpZiAoIXBhdGgpIHJldHVybjtcbiAgICAgIGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgdm9pZCB0aGlzLmFwcC53b3Jrc3BhY2Uub3BlbkxpbmtUZXh0KHBhdGgsIGN0eC5zb3VyY2VQYXRoLCBldnQuY3RybEtleSB8fCBldnQubWV0YUtleSk7XG4gICAgfSk7XG5cbiAgICAvLyBUcmlnZ2VyIE9ic2lkaWFuJ3MgcGFnZS1wcmV2aWV3IG9uIGhvdmVyIChkYXRhLWhyZWYgYWxvbmUgZG9lc24ndCBlbmFibGUgaXQpLlxuICAgIHRoaXMucmVnaXN0ZXJEb21FdmVudChyZW5kZXJlZCwgJ21vdXNlb3ZlcicsIChldnQpID0+IHtcbiAgICAgIGNvbnN0IGxpbmsgPSAoZXZ0LnRhcmdldCBhcyBIVE1MRWxlbWVudCkuY2xvc2VzdCgnYS5pbnRlcm5hbC1saW5rJyk7XG4gICAgICBjb25zdCBwYXRoID0gbGluaz8uZ2V0QXR0cmlidXRlKCdkYXRhLWhyZWYnKTtcbiAgICAgIGlmICghcGF0aCkgcmV0dXJuO1xuICAgICAgdGhpcy5hcHAud29ya3NwYWNlLnRyaWdnZXIoJ2hvdmVyLWxpbmsnLCB7XG4gICAgICAgIGV2ZW50OiBldnQsXG4gICAgICAgIHNvdXJjZTogJ21vbnRobHktdHJhY2tlcicsXG4gICAgICAgIGhvdmVyUGFyZW50OiByZW5kZXJlZCxcbiAgICAgICAgdGFyZ2V0RWw6IGxpbmssXG4gICAgICAgIGxpbmt0ZXh0OiBwYXRoLFxuICAgICAgICBzb3VyY2VQYXRoOiBjdHguc291cmNlUGF0aCxcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgZWwuYXBwZW5kQ2hpbGQocmVuZGVyZWQpO1xuICB9XG5cbiAgYXN5bmMgbG9hZFNldHRpbmdzKCkge1xuICAgIGNvbnN0IGRhdGEgPSAoYXdhaXQgdGhpcy5sb2FkRGF0YSgpKSBhcyBQYXJ0aWFsPFBsdWdpblNldHRpbmdzPiB8IG51bGw7XG4gICAgdGhpcy5zZXR0aW5ncyA9IE9iamVjdC5hc3NpZ24oe30sIERFRkFVTFRfU0VUVElOR1MsIGRhdGEpO1xuICB9XG5cbiAgYXN5bmMgc2F2ZVNldHRpbmdzKCkge1xuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zZXR0aW5ncyk7XG4gIH1cbn1cbiJdLCJuYW1lcyI6WyJnZXRMYW5ndWFnZSIsIlBsdWdpblNldHRpbmdUYWIiLCJTZXR0aW5nIiwic2V0VG9vbHRpcCIsIlBsdWdpbiIsInBhcnNlWWFtbCIsIlRGaWxlIiwiVEZvbGRlciJdLCJtYXBwaW5ncyI6Ijs7OztBQTRDTyxNQUFNLGdCQUFnQixHQUFtQjtBQUM5QyxJQUFBLGdCQUFnQixFQUFFLEVBQUU7QUFDcEIsSUFBQSxVQUFVLEVBQUUsWUFBWTtDQUN6Qjs7QUN2QkQsTUFBTSxFQUFFLEdBQWE7QUFDbkIsSUFBQSxXQUFXLEVBQUUsdUJBQXVCO0FBQ3BDLElBQUEsY0FBYyxFQUFFLDZEQUE2RDtBQUM3RSxJQUFBLGtCQUFrQixFQUFFLGtDQUFrQztBQUN0RCxJQUFBLGdCQUFnQixFQUFFLCtEQUErRDtBQUNqRixJQUFBLG9CQUFvQixFQUFFLDZCQUE2QjtBQUNuRCxJQUFBLG1CQUFtQixFQUFFLDBEQUEwRDtBQUMvRSxJQUFBLGdCQUFnQixFQUFFLG1EQUFtRDtJQUNyRSxlQUFlLEVBQUUsQ0FBQyxLQUFLLEtBQUssQ0FBQSxlQUFBLEVBQWtCLEtBQUssQ0FBaUIsZUFBQSxDQUFBO0FBQ3BFLElBQUEsY0FBYyxFQUFFLG9EQUFvRDtJQUNwRSxlQUFlLEVBQUUsQ0FBQyxLQUFLLEtBQUssQ0FBQSxrQ0FBQSxFQUFxQyxLQUFLLENBQUcsQ0FBQSxDQUFBO0FBQ3pFLElBQUEsZ0JBQWdCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxLQUFLLENBQXdDLHFDQUFBLEVBQUEsSUFBSSxDQUFLLEVBQUEsRUFBQSxJQUFJLENBQUcsQ0FBQSxDQUFBO0FBQzFGLElBQUEsVUFBVSxFQUFFLEtBQUs7QUFDakIsSUFBQSxVQUFVLEVBQUUsT0FBTztBQUNuQixJQUFBLGtCQUFrQixFQUFFLG9CQUFvQjtBQUN4QyxJQUFBLGtCQUFrQixFQUFFLG9E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
